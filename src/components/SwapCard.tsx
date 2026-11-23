import { useEffect, useMemo, useState } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits, type Hex, type PublicClient } from 'viem'
import {
  ASSETS,
  CONTRACTS,
  DYNAMIC_FEE,
  FEE_BIPS,
  FEE_RECIPIENT,
  NATIVE,
  TOKENS,
  isNative,
  robinhood,
  type Asset,
  type Token,
} from '../lib/config.ts'
import {
  buildSwap,
  erc20Abi,
  getQuotes,
  makePermit,
  permit2Abi,
  permitTypedData,
  type Quote,
} from '../lib/swap.ts'
import { EXPLORER, REPO_URL, addrUrl, short } from '../lib/links.ts'
import { TokenPicker } from './TokenPicker.tsx'
type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; step: string }
  | { kind: 'done'; hash: Hex }
  | { kind: 'error'; message: string; hash?: Hex }

const SLIPPAGE_PRESETS = [10n, 50n, 100n] // bips
const ETH_GAS_RESERVE = parseUnits('0.0005', 18)
const ASSET_TOKENS: Token[] = ASSETS.map((a) => TOKENS[a])

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

/** USDG per asset: cents for ETH/BTC, significant digits for sub-cent tokens. */
function fmtRate(v?: number) {
  if (v === undefined || !isFinite(v)) return '…'
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return v.toPrecision(4)
}

function errorText(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string }
  if (err?.name === 'UserRejectedRequestError' || /reject|denied/i.test(err?.message ?? '')) return 'Request rejected in wallet.'
  return err?.shortMessage ?? err?.message ?? 'Something went wrong.'
}

export function SwapCard() {
  const { address, chainId, isConnected, connector } = useAccount()
  const publicClient = usePublicClient({ chainId: robinhood.id }) as PublicClient
  const { data: walletClient } = useWalletClient()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { open } = useAppKit()

  const [asset, setAsset] = useState<Asset>('ETH')
  const [buying, setBuying] = useState(true) // true: USDG → asset
  const [amountStr, setAmountStr] = useState('')
  const [slippage, setSlippage] = useState(50n)
  const [showSettings, setShowSettings] = useState(false)
  const [showTx, setShowTx] = useState(false)
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
  // AppKit's email/social embedded wallet answers eth_chainId with a CAIP-2 string,
  // which viem's chain assertion cannot parse. For that connector only, skip the
  // assertion (chain: null). Injected and WalletConnect wallets keep it.
  const writeChain = connector?.id === 'AUTH' ? null : robinhood

  const pickAsset = (t: Token) => {
    setAsset(t.symbol as Asset)
    setStatus({ kind: 'idle' })
  }

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
            chain: writeChain, account: address,
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
        account: address, chain: writeChain, to: tx.to, data: tx.data, value: tx.value,
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
  if (!isConnected) { buttonLabel = 'Connect wallet'; buttonAction = () => open() }
  else if (wrongChain) {
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

  // The hooks shown are the quoted route's own pools.
  const hooks = quote?.route.hops.map((h) => h.key.hooks) ?? []
  const txRows: { k: string; v: string; url: string }[] = [
    { k: 'Network', v: `Robinhood Chain · ${robinhood.id}`, url: EXPLORER },
    { k: 'Router', v: short(CONTRACTS.universalRouter), url: addrUrl(CONTRACTS.universalRouter) },
    {
      k: 'Approval spender',
      v: isNative(tokenIn) ? 'none (native ETH)' : `Permit2 ${short(CONTRACTS.permit2)}`,
      url: addrUrl(CONTRACTS.permit2),
    },
    { k: 'PoolManager', v: short(CONTRACTS.poolManager), url: addrUrl(CONTRACTS.poolManager) },
    ...hooks.map((h, i) => ({
      k: hooks.length > 1 ? `Hook, pool ${i + 1}` : 'Hook',
      v: h === NATIVE ? 'none (hookless pool)' : short(h),
      url: addrUrl(h === NATIVE ? CONTRACTS.poolManager : h),
    })),
    { k: 'Fee recipient (Safe 2/3)', v: short(FEE_RECIPIENT), url: addrUrl(FEE_RECIPIENT) },
    { k: 'Frontend source', v: 'RWA-ID/cryptofi', url: REPO_URL },
  ]

  return (
    <div id="swap" className="card" aria-label="Swap">
      <div className="card-head">
        <h2>Swap</h2>
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
          {buying ? <TokenPicker token={tokenIn} /> : <TokenPicker token={tokenIn} options={ASSET_TOKENS} onSelect={(t) => pickAsset(t)} />}
        </div>
      </section>

      <button className="flip" onClick={flip} aria-label="Switch direction">↓↑</button>

      <section className="leg receive">
        <div className="leg-top">
          <span>You receive</span>
          {balOut.data !== undefined && <span className="leg-note">Balance {fmt(balOut.data, tokenOut)}</span>}
        </div>
        <div className="leg-row">
          <output className={quote ? 'amount' : 'amount empty'}>
            {quote ? fmt(quote.userAmountOut, tokenOut) : quotes.isFetching ? '…' : '0'}
          </output>
          {buying ? <TokenPicker token={tokenOut} options={ASSET_TOKENS} onSelect={(t) => pickAsset(t)} /> : <TokenPicker token={tokenOut} />}
        </div>
      </section>

      {quote && (
        <dl className="details">
          <Row k="Rate" v={`1 ${asset} = ${fmtRate(usdgPerAsset)} USDG`} />
          <Row k="Route" v={quote.route.hops.length > 1 ? `${quote.route.label} (2 pools)` : quote.route.label} />
          <Row
            k={quote.route.hops.length > 1 ? 'Pool LP fees' : 'Pool LP fee'}
            v={quote.route.hops
              .map((h) => (h.key.fee === DYNAMIC_FEE ? 'dynamic (hook)' : `${h.key.fee / 10_000}%`))
              .join(' + ')}
          />
          <Row k="Price impact incl. LP fee" v={`${(quote.priceImpact * 100).toFixed(2)}%`} warn={quote.priceImpact > 0.02} />
          <Row k={`CryptoFi fee (${Number(FEE_BIPS) / 100}%)`} v={`${fmt(quote.feeAmount, tokenOut)} ${tokenOut.symbol}`} />
          <Row k="Max slippage" v={`${Number(slippage) / 100}%`} />
          <Row k="Minimum received" v={`${fmt(minReceived!, tokenOut)} ${tokenOut.symbol}`} />
        </dl>
      )}

      <button className="cta" disabled={!buttonAction} onClick={buttonAction}>
        {buttonLabel}
      </button>
      <p className="cta-note">Your wallet authorizes every transaction.</p>

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

      <div className="inspect">
        <button className="inspect-toggle" onClick={() => setShowTx((s) => !s)} aria-expanded={showTx}>
          <span>Protocol transparency</span>
          <span className="mono muted-dark">{showTx ? 'Hide −' : 'Inspect +'}</span>
        </button>
        {showTx && (
          <div className="inspect-rows">
            {txRows.map((t) => (
              <div key={t.k} className="inspect-row">
                <span>{t.k}</span>
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="mono">{t.v}</a>
              </div>
            ))}
          </div>
        )}
      </div>
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
