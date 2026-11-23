import { CONTRACTS } from '../lib/config.ts'
import { REPO_URL, short } from '../lib/links.ts'

const pillars = [
  { n: '01', t: 'Self-custody by design', d: 'CryptoFi never takes possession of funds. Tokens move from your wallet to the pool and back in one transaction you sign.' },
  { n: '02', t: 'No project backend', d: 'No servers, databases, accounts or centralized transaction processing. The site is static files on IPFS.' },
  { n: '03', t: 'Direct contract calls', d: 'Swaps call the Uniswap v4 Universal Router 2.1.2 directly. Quotes come from the official v4 Quoter.' },
  { n: '04', t: 'Exact-amount approvals', d: 'Permit2 approvals cover only the amount you’re swapping, and permits expire after 30 minutes.' },
  { n: '05', t: 'Onchain slippage guard', d: 'Your minimum received is encoded in the swap. If the pool can’t deliver it, the transaction reverts.' },
  { n: '06', t: 'Tested on a fork', d: 'Every pair is swapped on an anvil fork with the app’s own code, checking receipt status, minimums and the 25-bip fee.' },
]

const signs = [
  { n: '1', t: 'ERC-20 approve → Permit2', badge: 'Only if needed · gas', gas: true, d: 'Lets Permit2 move the exact input amount. Skipped if you already have enough allowance. Never unlimited.' },
  { n: '2', t: 'Permit2 signature', badge: 'No gas', gas: false, d: 'Typed-data message authorizing the Universal Router to pull that amount once, within 30 minutes.' },
  { n: '3', t: 'Swap transaction', badge: 'Gas', gas: true, d: 'Sent to the Universal Router with a 20-minute deadline (chain time) and your minimum received.' },
]

const safeScope = [
  { k: 'Receives the 0.25% interface fee', v: 'Yes', c: 'yes' },
  { k: 'Can move or freeze user funds', v: 'No', c: 'no' },
  { k: 'Can upgrade or pause your swap', v: 'No', c: 'no' },
  { k: 'Owns any CryptoFi-deployed contract', v: 'None exist', c: 'muted' },
  { k: 'Threshold', v: '2 of 3 owners', c: '' },
]

export function Security() {
  return (
    <article className="doc">
      <p className="kicker">Security</p>
      <h1>Built for self-custody.</h1>
      <p className="lede">
        CryptoFi’s security model is mostly about what isn’t there: no server to breach, no database to leak, no wallet
        holding your money, no contract of ours you have to trust.
      </p>
      <div className="pillars">
        {pillars.map((p) => (
          <div key={p.n} className="tile">
            <span className="num-badge mono">{p.n}</span>
            <h3>{p.t}</h3>
            <p>{p.d}</p>
          </div>
        ))}
      </div>

      <h2>What you sign, exactly</h2>
      <p>Selling USDG or cbBTC takes up to three wallet prompts. Each one is scoped to the single swap you’re making.</p>
      <div className="signs">
        {signs.map((s) => (
          <div key={s.n} className="sign">
            <span className="step-num">{s.n}</span>
            <div>
              <div className="sign-head">
                <b>{s.t}</b>
                <span className={s.gas ? 'badge gas' : 'badge nogas'}>{s.badge}</span>
              </div>
              <p>{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>2-of-3 multisig governance</h2>
      <p>The CryptoFi Safe (v1.5.0) has three owners and requires two signatures for any transaction. Its scope is deliberately narrow:</p>
      <div className="list scope">
        {safeScope.map((r) => (
          <div key={r.k} className="scope-row">
            <span>{r.k}</span>
            <span className={`scope-v ${r.c}`}>{r.v}</span>
          </div>
        ))}
      </div>
      <p className="small">
        The Safe does not govern Uniswap v4, the pools, their hooks, Permit2, USDG or cbBTC. Those are third-party
        contracts with their own owners and permissions — see <a href="#/transparency">Transparency</a>.
      </p>

      <h2>Protect yourself</h2>
      <ul className="protect">
        <li>
          Open CryptoFi only at <b>cryptofi.eth.limo</b> or <b>cryptofi.eth.link</b>, or resolve cryptofi.eth’s IPFS
          contenthash yourself.
        </li>
        <li>
          Check the spender in every approval prompt is Permit2 <code>{short(CONTRACTS.permit2)}</code>, and the swap
          target is the Universal Router <code>{short(CONTRACTS.universalRouter)}</code>.
        </li>
        <li>CryptoFi will never DM you, ask for a seed phrase, or ask you to sign an unlimited approval.</li>
        <li>
          Report vulnerabilities privately through GitHub security advisories on{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer"><b>RWA-ID/cryptofi</b></a>.
        </li>
      </ul>
    </article>
  )
}
