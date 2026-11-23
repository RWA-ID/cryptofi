import { SwapCard } from '../components/SwapCard.tsx'
import { ASSETS, FEE_RECIPIENT, POOLS, TOKENS } from '../lib/config.ts'
import { TokenLogo } from '../components/TokenPicker.tsx'
import { addrUrl, short } from '../lib/links.ts'

const steps = [
  { n: '1', t: 'Connect your wallet', d: 'Any wallet through Reown AppKit or WalletConnect. No sign-up, no email.' },
  { n: '2', t: 'Approve the exact amount', d: 'A one-time ERC-20 approval to Permit2 — for this amount only, never unlimited.' },
  { n: '3', t: 'Sign a 30-minute permit', d: 'A gasless Permit2 signature scoped to the Universal Router and this amount.' },
  { n: '4', t: 'Swap via Universal Router', d: 'Your wallet sends the swap directly to Uniswap v4. Minimum received is enforced onchain.' },
]

const fees = [
  { v: 'Dynamic', t: 'Pool LP fee', d: 'Set per swap by a pool’s hook, or a fixed rate on hookless pools. Shown for every pool on your route. Paid to liquidity providers.' },
  { v: '0.25%', t: 'CryptoFi interface fee', d: 'Taken from the output by the router’s TAKE_PORTION action and sent to the 2-of-3 Safe.' },
  { v: 'Gas', t: 'Network fee', d: 'Paid in ETH to Robinhood Chain. Your wallet shows the estimate before you confirm.' },
  { v: 'None', t: 'Hidden spread', d: 'The quote is the Quoter’s output. No markup, no “best price” label, no route recommendation.' },
]

const limits = [
  { t: 'Third-party contracts.', d: 'Pools, hooks, Permit2 and every token are not CryptoFi’s. A hook can set the fee and may carry its own admin permissions.' },
  { t: 'RPC providers.', d: 'Quotes and balances are read through a public Robinhood Chain RPC or Alchemy. They see the requests your browser makes.' },
  { t: 'Gateways and DNS.', d: 'eth.limo and eth.link resolve the ENS name to IPFS. ENS is how you find CryptoFi, not something the swap depends on.' },
  { t: 'Your wallet and device.', d: 'If either is compromised, no interface can protect you. Read every prompt.' },
]

export function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="pill-note">
            <span className="live-dot" />
            cryptofi.eth · live on Robinhood Chain
          </span>
          <h1>Nothing to trust but the code.</h1>
          <p className="subhead">Self-custodial USDG swaps on Robinhood Chain.</p>
          <p className="hero-lede">
            A frontend-only interface for swapping USDG with ETH, cbBTC and Robinhood Chain community tokens against existing Uniswap v4 pools. No backend,
            no database, no accounts. Your wallet signs every transaction and talks to the contracts directly.
          </p>
          <div className="ctas">
            <a className="btn btn-dark" href="#swap">Start a swap</a>
            <a className="btn btn-light" href="#/transparency">Verify every contract</a>
          </div>
          <div className="stats">
            <div><b>0</b><span>project servers</span></div>
            <div><b>100%</b><span>self-custody</span></div>
            <div><b>2 of 3</b><span>Safe signers</span></div>
            <div><b>0.25%</b><span>interface fee, onchain</span></div>
          </div>
        </div>
        <SwapCard />
      </section>

      <section className="features">
        <article className="feature green">
          <p className="kicker">Architecture</p>
          <h2>No backend. No accounts. No custody.</h2>
          <p>
            CryptoFi is a static site pinned to IPFS and served at cryptofi.eth. There is no project-operated server,
            database or account system processing your swaps. Your wallet talks to the chain; you sign; your assets
            stay yours.
          </p>
          <div className="reasons">
            {['NO_SERVER', 'NO_DATABASE', 'NO_ORDER_MATCHING', 'NO_LIQUIDITY_HELD'].map((r) => (
              <span key={r} className="reason">{r}</span>
            ))}
          </div>
        </article>
        <article className="feature pink">
          <svg viewBox="0 0 240 240" aria-hidden="true" className="rings">
            <circle cx="120" cy="120" r="118" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="88" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="58" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="34" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="120" cy="120" r="17" fill="#D1F38F" />
          </svg>
          <p className="kicker rose">Governance</p>
          <h2>2-of-3 Safe multisig.</h2>
          <p className="narrow">
            The interface fee goes to a Safe v1.5.0 with three owners and a threshold of two. No single signer can move
            it. CryptoFi deploys no contracts of its own, so there are no CryptoFi admin keys or upgrade switches on
            your swap.
          </p>
          <a href={addrUrl(FEE_RECIPIENT)} target="_blank" rel="noopener noreferrer" className="mono safe-link">
            {short(FEE_RECIPIENT)} ↗
          </a>
        </article>
      </section>

      <section className="band">
        <p className="kicker">What happens when you swap</p>
        <div className="steps">
          {steps.map((s) => (
            <div key={s.n} className="step">
              <span className="step-num">{s.n}</span>
              <div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="small">
          Selling ETH needs no approval — it’s sent as the transaction value. Every deadline is computed from chain
          time, not your device clock.
        </p>
      </section>

      <section className="section">
        <p className="kicker">Fees, itemized</p>
        <h2 className="section-title">Every fee shown before you sign.</h2>
        <div className="fees">
          {fees.map((f) => (
            <div key={f.t} className="fee">
              <b>{f.v}</b>
              <span className="fee-t">{f.t}</span>
              <span className="fee-d">{f.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section pairs-wrap">
        <div>
          <p className="kicker">Pairs</p>
          <h2 className="section-title">USDG meets onchain liquidity.</h2>
          <p className="body">
            CryptoFi holds no liquidity. It quotes every listed Uniswap v4 pool for a pair, directly against USDG or
            through ETH, and routes through whichever returns the most output, then shows you which pools and hooks
            that is. Out of hundreds of pools per token, only those with real depth, a sane fee and a hook that can’t
            change swap amounts are listed.
          </p>
          <p className="small">
            <b>cbBTC</b> is Coinbase Wrapped BTC on Robinhood Chain — a token representation, not native bitcoin.{' '}
            <b>ETH</b> is the chain’s native gas asset. PONS, CASHCAT, HOOKR, PRIORS and ORBIO are community tokens:
            volatile, thinner markets. Copies with the same symbol exist; CryptoFi pins each contract address.
          </p>
        </div>
        <div className="assets">
          {ASSETS.map((a) => {
            const p = POOLS[a]
            const n = p.usdg.length + p.eth.length
            return (
              <div key={a} className="asset">
                <TokenLogo token={TOKENS[a]} size={36} />
                <div>
                  <b>USDG ↔ {a}</b>
                  <span>
                    {n} pool{n > 1 ? 's' : ''}
                    {p.eth.length > 0 ? ' · also via ETH' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="limits">
        <div>
          <p className="kicker lime">Honest limits</p>
          <h2>A static frontend removes custody risk. It doesn’t make contracts safe.</h2>
          <p>Don’t trust the interface — verify it. Here’s what still sits between you and the chain.</p>
        </div>
        <ul>
          {limits.map((l) => (
            <li key={l.t}>
              <span className="limit-dot" />
              <span>
                <b>{l.t}</b> <span className="limit-d">{l.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
