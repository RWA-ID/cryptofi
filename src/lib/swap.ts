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
  POOLS,
  TOKENS,
  isNative,
  type Pool,
  type PoolKey,
  type Token,
} from './config.ts'

// ---- ABIs -------------------------------------------------------------------

export const quoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)',
])

export const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
])

export const routerAbi = parseAbi([
  'function execute(bytes commands,bytes[] inputs,uint256 deadline) payable',
])

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

const ACT_SWAP_EXACT_IN_SINGLE = 0x06
const ACT_SETTLE_ALL = 0x0c
const ACT_TAKE_ALL = 0x0f
const ACT_TAKE_PORTION = 0x10

const POOL_KEY = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'

// ---- Pool helpers -------------------------------------------------------------

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

/** The non-USDG side of a pair. Only USDG pairs are supported. */
export function pairAsset(tokenIn: Token, tokenOut: Token): 'ETH' | 'cbBTC' {
  const other = tokenIn.symbol === 'USDG' ? tokenOut : tokenIn
  if (other.symbol !== 'ETH' && other.symbol !== 'cbBTC') throw new Error('Only USDG pairs are supported')
  if (tokenIn.symbol !== 'USDG' && tokenOut.symbol !== 'USDG') throw new Error('One side must be USDG')
  return other.symbol
}

const zeroForOne = (key: PoolKey, tokenIn: Token) =>
  key.currency0.toLowerCase() === tokenIn.address.toLowerCase()

// ---- Quotes -------------------------------------------------------------------

export type Quote = {
  pool: Pool
  zeroForOne: boolean
  amountIn: bigint
  /** Gross output from the pool, before the CryptoFi fee. */
  amountOut: bigint
  /** CryptoFi fee, taken from the output (TAKE_PORTION: floor(gross * bips / 10000)). */
  feeAmount: bigint
  /** What the user receives at the quoted price. */
  userAmountOut: bigint
  /** The pool's current LP fee in hundredths of a bip (1_000_000 = 100%). */
  lpFee: number
  /** Output at the pool's mid price, no fee and no price impact. */
  midAmountOut: bigint
  /** Fraction lost to price impact and the LP fee vs. the mid price (0.01 = 1%). */
  priceImpact: number
}

const Q192 = 2n ** 192n

function midOut(sqrtPriceX96: bigint, amountIn: bigint, z4o: boolean): bigint {
  const p = sqrtPriceX96 * sqrtPriceX96
  return z4o ? (amountIn * p) / Q192 : (amountIn * Q192) / p
}

async function quotePool(
  client: PublicClient,
  pool: Pool,
  tokenIn: Token,
  amountIn: bigint,
): Promise<Quote | null> {
  const z4o = zeroForOne(pool.key, tokenIn)
  try {
    const [{ result }, slot0] = await Promise.all([
      client.simulateContract({
        address: CONTRACTS.quoter,
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ poolKey: pool.key, zeroForOne: z4o, exactAmount: amountIn, hookData: '0x' }],
      }),
      client.readContract({
        address: CONTRACTS.stateView,
        abi: stateViewAbi,
        functionName: 'getSlot0',
        args: [poolId(pool.key)],
      }),
    ])
    const amountOut = result[0]
    if (amountOut === 0n) return null
    const feeAmount = (amountOut * FEE_BIPS) / BIPS
    const mid = midOut(slot0[0], amountIn, z4o)
    const priceImpact = mid > 0n ? Math.max(0, 1 - Number((amountOut * 1_000_000n) / mid) / 1_000_000) : 0
    return {
      pool,
      zeroForOne: z4o,
      amountIn,
      amountOut,
      feeAmount,
      userAmountOut: amountOut - feeAmount,
      lpFee: slot0[3],
      midAmountOut: mid,
      priceImpact,
    }
  } catch {
    // A pool that cannot fill this size (or reverts in its hook) is skipped.
    return null
  }
}

/**
 * Quotes every known pool for the pair and returns all fills, highest output first.
 * The first entry is the one the swap routes through.
 */
export async function getQuotes(
  client: PublicClient,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: bigint,
): Promise<Quote[]> {
  if (amountIn <= 0n) return []
  const pools = POOLS[pairAsset(tokenIn, tokenOut)]
  const quotes = await Promise.all(pools.map((p) => quotePool(client, p, tokenIn, amountIn)))
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
 * Builds Universal Router calldata for an exact-input single-pool swap:
 *   [PERMIT2_PERMIT]  (ERC-20 input only)
 *   V4_SWAP: SWAP_EXACT_IN_SINGLE → SETTLE_ALL(in) → TAKE_PORTION(out, Safe, 25 bips) → TAKE_ALL(out, min)
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
  const minGross = (quote.amountOut * (BIPS - slippageBips)) / BIPS
  const minUserOut = minGross - (minGross * FEE_BIPS) / BIPS - 1n // -1 for TAKE_PORTION rounding

  const actions = ('0x' +
    [ACT_SWAP_EXACT_IN_SINGLE, ACT_SETTLE_ALL, ACT_TAKE_PORTION, ACT_TAKE_ALL]
      .map((a) => a.toString(16).padStart(2, '0'))
      .join('')) as Hex

  const swapParams = encodeAbiParameters(
    parseAbiParameters(
      `(${POOL_KEY} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)`,
    ),
    [
      {
        poolKey: quote.pool.key,
        zeroForOne: quote.zeroForOne,
        amountIn: quote.amountIn,
        amountOutMinimum: minGross,
        minHopPriceX36: 0n, // 0 disables the per-hop check; amountOutMinimum still applies
        hookData: '0x',
      },
    ],
  )
  const settleAll = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenIn.address, quote.amountIn])
  const takePortion = encodeAbiParameters(parseAbiParameters('address,address,uint256'), [
    tokenOut.address,
    FEE_RECIPIENT,
    FEE_BIPS,
  ])
  const takeAll = encodeAbiParameters(parseAbiParameters('address,uint256'), [tokenOut.address, minUserOut])

  const v4Input = encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), [
    actions,
    [swapParams, settleAll, takePortion, takeAll],
  ])

  const commands: number[] = []
  const inputs: Hex[] = []
  if (!isNative(tokenIn)) {
    if (!permit) throw new Error('ERC-20 input needs a Permit2 signature')
    commands.push(CMD_PERMIT2_PERMIT)
    inputs.push(
      encodeAbiParameters(
        parseAbiParameters(
          '((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline),bytes',
        ),
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

export const ALL_TOKENS: Token[] = [TOKENS.USDG, TOKENS.ETH, TOKENS.cbBTC]
