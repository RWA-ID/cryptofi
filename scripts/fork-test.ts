// End-to-end check of src/lib/swap.ts against a local Anvil fork of Robinhood Chain.
// Start the fork first:  anvil --fork-url https://rpc.mainnet.chain.robinhood.com --port 8547
// Then:                  npm run fork-test
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type PublicClient,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { ASSETS, CONTRACTS, FEE_RECIPIENT, POOLS, TOKENS, isNative, robinhood, type Token } from '../src/lib/config.ts'
import { buildSwap, erc20Abi, getQuotes, makePermit, permit2Abi, permitTypedData, poolId } from '../src/lib/swap.ts'

const RPC = process.env.FORK_RPC ?? 'http://127.0.0.1:8547'
// A fresh key per run, funded on the fork only. Anvil's default account #0 (0xf39F…) is NOT
// usable here: it has code on the real Robinhood Chain, so Permit2 treats it as a contract
// wallet (EIP-1271) and rejects plain signatures.
const account = privateKeyToAccount(generatePrivateKey())
const chain = { ...robinhood, rpcUrls: { default: { http: [RPC] } } }
const pub = createPublicClient({ chain, transport: http(RPC) }) as PublicClient
const wallet = createWalletClient({ account, chain, transport: http(RPC) })

const EXPECTED_IDS = [
  '0xa791e5169faf703c0b63fd9552c33ec1128a773a00f5dc33a640da62a022cd35',
  '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551',
  '0xf50a897ae1b4dfdac5a8d573f0d0f59c75832b7832b7e631e1192d1e64019039',
  '0x94c62eebf6454231b2fcd0259ede448ae3c6ad8617718cd88dab20b30cfae48a',
]

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${msg}`)
  if (!ok) failures++
}

const balance = (t: Token, who: Address) =>
  isNative(t)
    ? pub.getBalance({ address: who })
    : pub.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })

async function swap(tokenIn: Token, tokenOut: Token, amountIn: bigint) {
  console.log(`\n${formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol} -> ${tokenOut.symbol}`)
  const quotes = await getQuotes(pub, tokenIn, tokenOut, amountIn)
  check(quotes.length > 0, `got ${quotes.length} quote(s)`)
  const q = quotes[0]
  console.log(`        route: ${q.route.label} (${q.route.hops.length} hop) | impact ${(q.priceImpact * 100).toFixed(3)}%`)

  const block = await pub.getBlock()
  const now = Number(block.timestamp) // chain time, not this machine's clock
  let permit
  if (!isNative(tokenIn)) {
    const allowance = await pub.readContract({
      address: tokenIn.address, abi: erc20Abi, functionName: 'allowance', args: [account.address, CONTRACTS.permit2],
    })
    if (allowance < amountIn) {
      const h = await wallet.writeContract({
        address: tokenIn.address, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.permit2, amountIn],
      })
      const r = await pub.waitForTransactionReceipt({ hash: h })
      check(r.status === 'success', `ERC-20 approve to Permit2 (exact amount) status=${r.status}`)
    }
    const [, , nonce] = await pub.readContract({
      address: CONTRACTS.permit2, abi: permit2Abi, functionName: 'allowance',
      args: [account.address, tokenIn.address, CONTRACTS.universalRouter],
    })
    const p = makePermit(tokenIn.address, amountIn, nonce, now)
    const signature = await wallet.signTypedData(permitTypedData(chain.id, p))
    permit = { permit: p, signature }
  }

  const tx = buildSwap({ quote: q, tokenIn, tokenOut, slippageBips: 50n, deadline: BigInt(now + 1200), permit })
  const [userBefore, safeBefore] = await Promise.all([balance(tokenOut, account.address), balance(tokenOut, FEE_RECIPIENT)])
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value })
  const rcpt = await pub.waitForTransactionReceipt({ hash })
  check(rcpt.status === 'success', `swap status=${rcpt.status} gas=${rcpt.gasUsed}`)
  const [userAfter, safeAfter] = await Promise.all([balance(tokenOut, account.address), balance(tokenOut, FEE_RECIPIENT)])

  let got = userAfter - userBefore
  if (isNative(tokenOut)) got += rcpt.gasUsed * rcpt.effectiveGasPrice // add back gas paid in ETH
  const fee = safeAfter - safeBefore
  const fmt = (v: bigint) => `${formatUnits(v, tokenOut.decimals)} ${tokenOut.symbol}`
  console.log(`        user received ${fmt(got)} | Safe received ${fmt(fee)} | quoted user ${fmt(q.userAmountOut)}`)
  check(got >= tx.minUserOut, `user got >= minimum (${fmt(tx.minUserOut)})`)
  const total = got + fee
  const feeBips = Number((fee * 1_000_000n) / total) / 100
  check(Math.abs(feeBips - 25) < 0.05, `fee = ${feeBips.toFixed(3)} bips of gross output (want 25)`)
  return got
}

async function main() {
  await pub.request({ method: 'anvil_setBalance' as never, params: [account.address, '0x56BC75E2D63100000'] as never }) // 100 ETH
  console.log(`Test account ${account.address} (fresh key, 100 ETH on the fork)\n`)
  console.log('Pool IDs match the on-chain Initialize events:')
  const ids = [...POOLS.ETH.usdg, ...POOLS.cbBTC.usdg].map((p) => poolId(p.key))
  ids.forEach((id, i) => check(id === EXPECTED_IDS[i], `${id.slice(0, 12)}...`))

  // Fund with USDG, then buy and fully sell back every listed asset through its best route.
  await swap(TOKENS.ETH, TOKENS.USDG, parseUnits('1', 18))
  for (const a of ASSETS) {
    const t = TOKENS[a]
    const bought = await swap(TOKENS.USDG, t, parseUnits('150', 6))
    if (bought > 0n) await swap(t, TOKENS.USDG, isNative(t) ? bought / 2n : bought)
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
