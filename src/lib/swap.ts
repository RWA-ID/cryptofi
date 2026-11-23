import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import {
  BIPS,
  CONTRACTS,
  FEE_BIPS,
  FEE_RECIPIENT,
  NATIVE,
  POOLS,
  TOKENS,
  isNative,
  type Asset,
  type Pool,
  type PoolKey,
  type Token,
} from './config.ts'

// ---- ABIs -------------------------------------------------------------------

const PATH_KEY = '(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)'

export const quoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)',
  `function quoteExactInput((address exactCurrency,${PATH_KEY}[] path,uint128 exactAmount) params) returns (uint256 amountOut,uint256 gasEstimate)`,
])

export const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
])

export const routerAbi = parseAbi(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable'])

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
])

export const permit2Abi = parseAbi([
  'function allowance(address user,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)',
])

// ---- Constants from the router's verified source ----------------------------

const CMD_PERMIT2_PERMIT = 0x0a
const CMD_V4_SWAP = 0x10

const ACT_SWAP_EXACT_IN = 0x07
const ACT_SETTLE_ALL = 0x0c
const ACT_TAKE_ALL = 0x0f
const ACT_TAKE_PORTION = 0x10

// ---- Pools and routes ---------------------------------------------------------

export function poolId(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'), [
      key.currency0,
      key.currency1,
      key.fee,
      key.tickSpacing,
      key.hooks,
    ]),
  )
}

export type PathKey = { intermediateCurrency: Address; fee: number; tickSpacing: number; hooks: Address; hookData: Hex }

/** One or two pools, walked from the input currency to the output currency. */
export type Route = { hops: Pool[]; path: PathKey[]; currencies: Address[]; label: string }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function makeRoute(currencyIn: Address, hops: Pool[]): Route {
  const path: PathKey[] = []
  const currencies: Address[] = [currencyIn]
  let cur = currencyIn
  for (const p of hops) {
    const next = same(p.key.currency0, cur) ? p.key.currency1 : p.key.currency0
    path.push({ intermediateCurrency: next, fee: p.key.fee, tickSpacing: p.key.tickSpacing, hooks: p.key.hooks, hookData: '0x' })
    currencies.push(next)
    cur = next
  }
  const sym = (a: Address) => Object.values(TOKENS).find((t) => same(t.address, a))?.symbol ?? a.slice(0, 6)
  const label = hops.length === 1 ? hops[0].label : `${currencies.map(sym).join(' → ')}`
  return { hops, path, currencies, label }
}

/** The non-USDG side of a pair. Only USDG pairs are supported. */
export function pairAsset(tokenIn: Token, tokenOut: Token): Asset {
  if (tokenIn.symbol !== 'USDG' && tokenOut.symbol !== 'USDG') throw new Error('One side must be USDG')
  const other = (tokenIn.symbol === 'USDG' ? tokenOut : tokenIn).symbol
  if (!(other in POOLS)) throw new Error(`Unsupported token ${other}`)
  return other as Asset
}

/** Every listed route for the pair: direct USDG pools, then USDG ↔ ETH ↔ asset. */
export function candidateRoutes(tokenIn: Token, tokenOut: Token): Route[] {
  const asset = pairAsset(tokenIn, tokenOut)
  const buying = tokenIn.symbol === 'USDG'
  const routes: Route[] = POOLS[asset].usdg.map((p) => makeRoute(tokenIn.address, [p]))
  for (const ethPool of POOLS.ETH.usdg) {
    for (const assetPool of POOLS[asset].eth) {
      routes.push(makeRoute(tokenIn.address, buying ? [ethPool, assetPool] : [assetPool, ethPool]))
    }
  }
  return routes
}

// ---- Quotes -------------------------------------------------------------------

export type Quote = {
  route: Route
  amountIn: bigint
  /** Gross output from the route, before the CryptoFi fee. */
  amountOut: bigint
  /** CryptoFi fee, taken from the output (TAKE_PORTION: floor(gross * bips / 10000)). */
  feeAmount: bigint
  /** What the user receives at the quoted price. */
  userAmountOut: bigint
  /** Output at the pools' mid prices, no fee and no price impact. */
  midAmountOut: bigint
  /** Fraction lost to price impact and LP fees vs. the mid prices (0.01 = 1%). */
  priceImpact: number
}

const Q192 = 2n ** 192n

async function midOut(client: PublicClient, route: Route, amountIn: bigint): Promise<bigint> {
  const slots = await Promise.all(
    route.hops.map((p) =>
      client.readContract({ address: CONTRACTS.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId(p.key)] }),
    ),
  )
  let amt = amountIn
  route.hops.forEach((p, i) => {
    const sq = slots[i][0]
    const zeroForOne = same(p.key.currency0, route.currencies[i])
    const price = sq * sq
    amt = zeroForOne ? (amt * price) / Q192 : (amt * Q192) / price
  })
  return amt
}

async function quoteRoute(client: PublicClient, route: Route, amountIn: bigint): Promise<Quote | null> {
  try {
    const [{ result }, mid] = await Promise.all([
      client.simulateContract({
        address: CONTRACTS.quoter,
        abi: quoterAbi,
        functionName: 'quoteExactInput',
        args: [{ exactCurrency: route.currencies[0], path: route.path, exactAmount: amountIn }],
      }),
      midOut(client, route, amountIn),
    ])
    const amountOut = result[0]
    if (amountOut === 0n) return null
    const feeAmount = (amountOut * FEE_BIPS) / BIPS
    const priceImpact = mid > 0n ? Math.max(0, 1 - Number((amountOut * 1_000_000n) / mid) / 1_000_000) : 0
    return { route, amountIn, amountOut, feeAmount, userAmountOut: amountOut - feeAmount, midAmountOut: mid, priceImpact }
  } catch {
    // A route that cannot fill this size (or reverts in a hook) is skipped.
    return null
  }
}

/**
 * Quotes every listed route for the pair and returns all fills, highest output first.
 * The first entry is the one the swap uses.
 */
export async function getQuotes(client: PublicClient, tokenIn: Token, tokenOut: Token, amountIn: bigint): Promise<Quote[]> {
  if (amountIn <= 0n) return []
  const quotes = await Promise.all(candidateRoutes(tokenIn, tokenOut).map((r) => quoteRoute(client, r, amountIn)))
  return quotes.filter((q): q is Quote => q !== null).sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1))
}

// ---- Permit2 ------------------------------------------------------------------

export type PermitSingle = {
  details: { token: Address; amount: bigint; expiration: number; nonce: number }
  spender: Address
  sigDeadline: bigint
}

export function permitTypedData(chainId: number, permit: PermitSingle) {
  return {
    domain: { name: 'Permit2', chainId, verifyingContract: CONTRACTS.permit2 },
    types: {
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
    },
    primaryType: 'PermitSingle' as const,
    message: permit,
  }
}

/** A permit for exactly `amount`, valid for 30 minutes, for the Universal Router only. */
export function makePermit(token: Address, amount: bigint, nonce: number, nowSec: number): PermitSingle {
  const expiry = nowSec + 30 * 60
  return {
    details: { token, amount, expiration: expiry, nonce },
    spender: CONTRACTS.universalRouter,
    sigDeadline: BigInt(expiry),
  }
}

// ---- Calldata -------------------------------------------------------------------

export type SwapTx = { to: Address; data: Hex; value: bigint; minUserOut: bigint }

/**
 * Builds Universal Router calldata for an exact-input swap along `quote.route`:
 *   [PERMIT2_PERMIT]  (ERC-20 input only)
 *   V4_SWAP: SWAP_EXACT_IN → SETTLE_ALL(in) → TAKE_PORTION(out, Safe, 25 bips) → TAKE_ALL(out, min)
 * The user's minimum is enforced on what they receive after the fee.
 */
export function buildSwap(args: {
  quote: Quote
  tokenIn: Token
  tokenOut: Token
  slippageBips: bigint
  deadline: bigint
  permit?: { permit: PermitSingle; signature: Hex }
}): SwapTx {
  const { quote, tokenIn, tokenOut, slippageBips, deadline, permit } = args
  if (slippageBips < 0n || slippageBips >= BIPS) throw new Error('Bad slippage')
  if (!same(quote.route.currencies[0], tokenIn.address) || !same(quote.route.currencies.at(-1)!, tokenOut.address)) {
    throw new Error('Route does not match the tokens')
  }
  const minGross = (quote.amountOut * (BIPS - slippageBips)) / BIPS
  const minUserOut = minGross - (minGross * FEE_BIPS) / BIPS - 1n // -1 for TAKE_PORTION rounding

  const actions = ('0x' +
    [ACT_SWAP_EXACT_IN, ACT_SETTLE_ALL, ACT_TAKE_PORTION, ACT_TAKE_ALL].map((a) => a.toString(16).padStart(2, '0')).join('')) as Hex

  const swapParams = encodeAbiParameters(
    parseAbiParameters(
      `(address currencyIn,${PATH_KEY}[] path,uint256[] minHopPriceX36,uint128 amountIn,uint128 amountOutMinimum)`,
    ),
    [
      {
        currencyIn: tokenIn.address,
        path: quote.route.path,
        minHopPriceX36: [], // empty disables per-hop checks; amountOutMinimum still applies
        amountIn: quote.amountIn,
        amountOutMinimum: minGross,
      },
    ],
  )
  const settleAll = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenIn.address, quote.amountIn])
  const takePortion = encodeAbiParameters(parseAbiParameters('address,address,uint256'), [tokenOut.address, FEE_RECIPIENT, FEE_BIPS])
  const takeAll = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenOut.address, minUserOut])

  const v4Input = encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), [actions, [swapParams, settleAll, takePortion, takeAll]])

  const commands: number[] = []
  const inputs: Hex[] = []
  if (!isNative(tokenIn)) {
    if (!permit) throw new Error('ERC-20 input needs a Permit2 signature')
    commands.push(CMD_PERMIT2_PERMIT)
    inputs.push(
      encodeAbiParameters(
        parseAbiParameters('((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline),bytes'),
        [permit.permit, permit.signature],
      ),
    )
  }
  commands.push(CMD_V4_SWAP)
  inputs.push(v4Input)

  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: 'execute',
    args: [('0x' + commands.map((c) => c.toString(16).padStart(2, '0')).join('')) as Hex, inputs, deadline],
  })
  return { to: CONTRACTS.universalRouter, data, value: isNative(tokenIn) ? quote.amountIn : 0n, minUserOut }
}

export { NATIVE }
