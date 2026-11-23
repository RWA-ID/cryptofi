import { useEffect, useMemo, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits, type Hex, type PublicClient } from 'viem'
import { CONTRACTS, FEE_BIPS, FEE_RECIPIENT, TOKENS, isNative, robinhood, type Token } from './lib/config.ts'
import {
  buildSwap,
  erc20Abi,
  getQuotes,
  makePermit,
  permit2Abi,
  permitTypedData,
  type Quote,
} from './lib/swap.ts'
import { WalletButton } from './WalletButton.tsx'

type Asset = 'ETH' | 'cbBTC'
type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; step: string }
  | { kind: 'done'; hash: Hex }
  | { kind: 'error'; message: string; hash?: Hex }

const EXPLORER = robinhood.blockExplorers.default.url
const SLIPPAGE_PRESETS = [10n, 50n, 100n] // bips
const ETH_GAS_RESERVE = parseUnits('0.0005', 18)

function fmt(v: bigint, t: Token, max = 6) {
  const n = Number(formatUnits(v, t.decimals))
  if (n === 0) return '0'
  if (n < 10 ** -max) return `<${10 ** -max}`
  return n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 2 : max })
}

function parseAmount(s: string, t: Token): bigint {
  const clean = s.trim()
  if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') return 0n
  const [i, f = ''] = clean.split('.')
  try {
    return parseUnits(`${i || '0'}.${f.slice(0, t.decimals)}`, t.decimals)
  } catch {
    return 0n
  }
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms)
    return () => clearTimeout(id)
  }, [v, ms])
  return d
}

function balanceOf(client: PublicClient, t: Token, who: `0x${string}`) {
  return isNative(t)
    ? client.getBalance({ address: who })
    : client.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] })
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function errorText(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string }
  if (err?.name === 'UserRejectedRequestError' || /reject|denied/i.test(err?.message ?? '')) return 'Request rejected in wallet.'
  return err?.shortMessage ?? err?.message ?? 'Something went wrong.'
}

export function App() {
  const { address, chainId, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: robinhood.id }) as PublicClient
  const { data: walletClient } = useWalletClient()
  const { switchChain, isPending: switching } = useSwitchChain()

  const [asset, setAsset] = useState<Asset>('ETH')
  const [buying, setBuying] = useState(true) // true: USDG → asset
  const [amountStr, setAmountStr] = useState('')
  const [slippage, setSlippage] = useState(50n)
  const [showSettings, setShowSettings] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const tokenIn: Token = buying ? TOKENS.USDG : TOKENS[asset]
  const tokenOut: Token = buying ? TOKENS[asset] : TOKENS.USDG
  const amountIn = useMemo(() => parseAmount(amountStr, tokenIn), [amountStr, tokenIn])
  const debouncedIn = useDebounced(amountIn, 350)

  const quotes = useQuery({
    queryKey: ['quote', tokenIn.symbol, tokenOut.symbol, debouncedIn.toString()],
    queryFn: () => getQuotes(publicClient, tokenIn, tokenOut, debouncedIn),
    enabled: debouncedIn > 0n && !!publicClient,
    refetchInterval: 15_000,
  })
  const quote: Quote | undefined = debouncedIn === amountIn ? quotes.data?.[0] : undefined

  const balIn = useQuery({
    queryKey: ['bal', tokenIn.symbol, address],
    queryFn: () => balanceOf(publicClient, tokenIn, address!),
    enabled: !!address && !!publicClient,
    refetchInterval: 20_000,
  })
  const balOut = useQuery({
    queryKey: ['bal', tokenOut.symbol, address],
    queryFn: () => balanceOf(publicClient, tokenOut, address!),
    enabled: !!address && !!publicClient,
    refetchInterval: 20_000,
  })

  const wrongChain = isConnected && chainId !== robinhood.id
  const insufficient = balIn.data !== undefined && amountIn > balIn.data
  const busy = status.kind === 'busy'

  const flip = () => {
    setBuying((b) => !b)
    setAmountStr('')
    setStatus({ kind: 'idle' })
  }

  const setMax = () => {
    if (balIn.data === undefined) return
    let v = balIn.data
    if (isNative(tokenIn)) v = v > ETH_GAS_RESERVE ? v - ETH_GAS_RESERVE : 0n
    setAmountStr(formatUnits(v, tokenIn.decimals))
  }

  async function swap() {
    if (!walletClient || !address || amountIn <= 0n) return
    let hash: Hex | undefined
    try {
      // Chain time, not the device clock, for every deadline.
      const now = Number((await publicClient.getBlock()).timestamp)

      let permit
      if (!isNative(tokenIn)) {
        const allowance = await publicClient.readContract({
          address: tokenIn.address, abi: erc20Abi, functionName: 'allowance', args: [address, CONTRACTS.permit2],
        })
        if (allowance < amountIn) {
          setStatus({ kind: 'busy', step: `Approve ${tokenIn.symbol} for Permit2 (exact amount)…` })
          const h = await walletClient.writeContract({
            address: tokenIn.address, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.permit2, amountIn],
            chain: robinhood, account: address,
          })
          setStatus({ kind: 'busy', step: 'Waiting for approval to confirm…' })
          const r = await publicClient.waitForTransactionReceipt({ hash: h })
          if (r.status !== 'success') throw new Error('Approval transaction failed on-chain.')
        }
        const [, , nonce] = await publicClient.readContract({
          address: CONTRACTS.permit2, abi: permit2Abi, functionName: 'allowance',
          args: [address, tokenIn.address, CONTRACTS.universalRouter],
        })
        setStatus({ kind: 'busy', step: 'Sign the Permit2 message (no gas)…' })
        const p = makePermit(tokenIn.address, amountIn, nonce, now)
        const signature = await walletClient.signTypedData({ account: address, ...permitTypedData(robinhood.id, p) })
        permit = { permit: p, signature }
      }

      setStatus({ kind: 'busy', step: 'Refreshing quote…' })
      const fresh = (await getQuotes(publicClient, tokenIn, tokenOut, amountIn))[0]
      if (!fresh) throw new Error('No pool can fill this amount right now.')

      const tx = buildSwap({ quote: fresh, tokenIn, tokenOut, slippageBips: slippage, deadline: BigInt(now + 20 * 60), permit })
      setStatus({ kind: 'busy', step: 'Confirm the swap in your wallet…' })
      hash = await walletClient.sendTransaction({
        account: address, chain: robinhood, to: tx.to, data: tx.data, value: tx.value,
      })
      setStatus({ kind: 'busy', step: 'Waiting for confirmation…' })
      const rcpt = await publicClient.waitForTransactionReceipt({ hash })
      if (rcpt.status !== 'success') throw new Error('The swap transaction reverted on-chain.')
      setStatus({ kind: 'done', hash })
      setAmountStr('')
      balIn.refetch()
      balOut.refetch()
    } catch (e) {
      setStatus({ kind: 'error', message: errorText(e), hash })
    }
  }

  let buttonLabel = 'Swap'
  let buttonAction: (() => void) | undefined = swap
  if (wrongChain) {
    buttonLabel = switching ? 'Switching…' : 'Switch to Robinhood Chain'
    buttonAction = () => switchChain({ chainId: robinhood.id })
  } else if (amountIn <= 0n) { buttonLabel = 'Enter an amount'; buttonAction = undefined }
  else if (insufficient) { buttonLabel = `Insufficient ${tokenIn.symbol}`; buttonAction = undefined }
  else if (quotes.isFetching && !quote) { buttonLabel = 'Fetching quote…'; buttonAction = undefined }
  else if (!quote) { buttonLabel = 'No quote for this amount'; buttonAction = undefined }
  else if (busy) { buttonLabel = 'Working…'; buttonAction = undefined }
  else if (!isNative(tokenIn)) buttonLabel = 'Approve & swap'

  const minReceived = quote
    ? (() => {
        const g = (quote.amountOut * (10_000n - slippage)) / 10_000n
        return g - (g * FEE_BIPS) / 10_000n
      })()
    : undefined
  const rate = quote
    ? Number(formatUnits(quote.userAmountOut, tokenOut.decimals)) / Number(formatUnits(quote.amountIn, tokenIn.decimals))
    : undefined
  const usdgPerAsset = rate ? (buying ? 1 / rate : rate) : undefined

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden>C</span>
          <span className="word">CryptoFi</span>
          <span className="chain">Robinhood Chain</span>
        </div>
        <WalletButton />
      </header>

      <main className="card" aria-label="Swap">
        <div className="card-head">
          <h1>Swap</h1>
          <button className="ghost" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
            Slippage {Number(slippage) / 100}%
          </button>
        </div>

        {showSettings && (
          <div className="settings">
            <span>Max slippage</span>
            <div className="chips">
              {SLIPPAGE_PRESETS.map((b) => (
                <button key={b.toString()} className={b === slippage ? 'chip on' : 'chip'} onClick={() => setSlippage(b)}>
                  {Number(b) / 100}%
                </button>
              ))}
              <input
                className="chip-input"
                inputMode="decimal"
                placeholder="Custom %"
                aria-label="Custom slippage percent"
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v > 0 && v <= 20) setSlippage(BigInt(Math.round(v * 100)))
                }}
              />
            </div>
          </div>
        )}

        <section className="leg">
          <div className="leg-top">
            <span>You pay</span>
            {balIn.data !== undefined && (
              <button className="bal" onClick={setMax}>
                Balance {fmt(balIn.data, tokenIn)} · Max
              </button>
            )}
          </div>
          <div className="leg-row">
            <input
              className="amount"
              inputMode="decimal"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(',', '.'))}
              aria-label={`Amount of ${tokenIn.symbol} to pay`}
            />
            <TokenPicker token={tokenIn} fixed={buying} asset={asset} onAsset={setAsset} />
          </div>
        </section>

        <button className="flip" onClick={flip} aria-label="Switch direction">↓↑</button>

        <section className="leg">
          <div className="leg-top">
            <span>You receive</span>
            {balOut.data !== undefined && <span className="muted">Balance {fmt(balOut.data, tokenOut)}</span>}
          </div>
          <div className="leg-row">
            <output className={quote ? 'amount' : 'amount empty'}>
              {quote ? fmt(quote.userAmountOut, tokenOut) : quotes.isFetching ? '…' : '0'}
            </output>
            <TokenPicker token={tokenOut} fixed={!buying} asset={asset} onAsset={setAsset} />
          </div>
        </section>

        {quote && (
          <dl className="details">
            <Row k="Rate" v={`1 ${asset} = ${usdgPerAsset?.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDG`} />
            <Row k="Route" v={quote.pool.label} />
            <Row
              k="Pool LP fee"
              v={
                quote.pool.key.fee === 0x800000
                  ? 'Dynamic, set per swap by the pool hook'
                  : `${quote.pool.key.fee / 10_000}%`
              }
            />
            <Row
              k="Price impact incl. LP fee"
              v={`${(quote.priceImpact * 100).toFixed(2)}%`}
              warn={quote.priceImpact > 0.02}
            />
            <Row k={`CryptoFi fee (${Number(FEE_BIPS) / 100}%)`} v={`${fmt(quote.feeAmount, tokenOut)} ${tokenOut.symbol}`} />
            <Row k="Max slippage" v={`${Number(slippage) / 100}%`} />
            <Row k="Minimum received" v={`${fmt(minReceived!, tokenOut)} ${tokenOut.symbol}`} />
          </dl>
        )}

        {isConnected ? (
          <button className="cta" disabled={!buttonAction} onClick={buttonAction}>
            {buttonLabel}
          </button>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button className="cta" onClick={openConnectModal}>Connect wallet</button>
            )}
          </ConnectButton.Custom>
        )}

        {status.kind === 'busy' && <p className="status">{status.step}</p>}
        {status.kind === 'done' && (
          <p className="status ok">
            Swap confirmed. <a href={`${EXPLORER}/tx/${status.hash}`} target="_blank" rel="noreferrer">View transaction</a>
          </p>
        )}
        {status.kind === 'error' && (
          <p className="status err">
            {status.message}{' '}
            {status.hash && <a href={`${EXPLORER}/tx/${status.hash}`} target="_blank" rel="noreferrer">View transaction</a>}
          </p>
        )}
      </main>

      <footer className="foot">
        <p>
          CryptoFi is an interface. You sign every transaction in your own wallet, and swaps execute directly against
          existing Uniswap v4 pools on Robinhood Chain. CryptoFi holds no funds or liquidity and runs no server.
          Quotes come from the Uniswap v4 Quoter and can change before your transaction lands.
        </p>
        <p>
          A {Number(FEE_BIPS) / 100}% interface fee is deducted from the output and sent to the CryptoFi multisig{' '}
          <a href={`${EXPLORER}/address/${FEE_RECIPIENT}`} target="_blank" rel="noreferrer">{short(FEE_RECIPIENT)}</a>.
          {' '}Router <a href={`${EXPLORER}/address/${CONTRACTS.universalRouter}`} target="_blank" rel="noreferrer">{short(CONTRACTS.universalRouter)}</a>
          {' · '}Permit2 <a href={`${EXPLORER}/address/${CONTRACTS.permit2}`} target="_blank" rel="noreferrer">{short(CONTRACTS.permit2)}</a>
        </p>
      </footer>
    </div>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={warn ? 'row warn' : 'row'}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function TokenPicker({ token, fixed, asset, onAsset }: { token: Token; fixed: boolean; asset: Asset; onAsset: (a: Asset) => void }) {
  if (fixed) return <span className="token">{token.symbol}</span>
  return (
    <select className="token" value={asset} onChange={(e) => onAsset(e.target.value as Asset)} aria-label="Asset">
      <option value="ETH">ETH</option>
      <option value="cbBTC">cbBTC</option>
    </select>
  )
}
