import { CONTACT_EMAIL, LIST_EMAIL, REPO_URL } from '../lib/links.ts'

// Listing is free and decided only by these published rules. No backend: requests go by email or a public
// GitHub issue, so the page stays a static file on IPFS.

const criteria = [
  { n: '01', t: 'On Robinhood Chain', d: 'An ERC-20 on Robinhood Chain (chain ID 4663) with code at its address. CryptoFi supports no other chains.' },
  { n: '02', t: 'A route to USDG', d: 'A Uniswap v4 pool against USDG, or against ETH so the swap can route USDG → ETH → token in one transaction.' },
  { n: '03', t: 'Real depth', d: 'A $100 swap must quote in both directions at under 2% price impact, measured with the official v4 Quoter (npm run verify-routes).' },
  { n: '04', t: 'A sane pool fee', d: 'A fixed fee of 1% or less, or a dynamic-fee hook whose live quotes stay in that range.' },
  { n: '05', t: 'A safe hook', d: 'No hook, or a hook without a ReturnDelta permission, so it cannot change what a swapper receives.' },
  { n: '06', t: 'Sells must work', d: 'The pool has to fill sells as well as buys. Every listing is swapped both ways on a fork before it ships.' },
]

const rejects = [
  'Same-symbol copies of a token that is already listed or already well known',
  'Pools whose hook allows buys but blocks sells',
  'Pools whose volume is wash-traded to make them look deeper than they are',
  'Fee-on-transfer or rebasing tokens, which break the minimum-received guard',
  'Requests from anyone who cannot show they speak for the token',
]

const steps = [
  { n: '1', t: 'You send the request', d: 'By email or a public GitHub issue, with the details below.' },
  { n: '2', t: 'We check it onchain', d: 'Token address, pool key and its Initialize event, hook permissions and live quotes in both directions.' },
  { n: '3', t: 'Fork test', d: 'Real swaps with the app’s own code on an anvil fork: minimum received, receipt status and the 0.25% fee.' },
  { n: '4', t: 'It ships', d: 'The token is added to the open-source config, the site is rebuilt and pinned, and cryptofi.eth points at the new build.' },
]

const fields = [
  'Token name, symbol and contract address',
  'The Uniswap v4 pool ID(s) to route through',
  'Official website and X account',
  'Proof you speak for the token (a post from the official X account, or a message signed by the deployer)',
  'A square logo, PNG or SVG, at least 256 × 256',
]

const body = `Token name:
Symbol:
Contract address (Robinhood Chain):

Uniswap v4 pool ID(s):

Website:
X account:

Proof you speak for the token (link to a post from the official X account, or a message signed by the deployer):

Logo: attach a square PNG or SVG, at least 256 x 256.
`

const mailto = `mailto:${LIST_EMAIL}?subject=${encodeURIComponent('Listing request: ')}&body=${encodeURIComponent(body)}`
const issueUrl = `${REPO_URL}/issues/new?template=listing-request.yml`

export function ListToken() {
  return (
    <article className="doc">
      <p className="kicker">List a token</p>
      <h1>Listing is free. The rules are public.</h1>
      <p className="lede">
        CryptoFi lists a token when it meets the criteria below, and only then. There is no listing fee, no paid
        placement and no ranking: every listed token appears in the picker the same way.
      </p>
      <div className="ctas list-ctas">
        <a className="btn btn-dark" href={mailto}>Email a request</a>
        <a className="btn btn-light" href={issueUrl} target="_blank" rel="noopener noreferrer">Open a GitHub issue</a>
      </div>
      <p className="small">
        Or write to <a href={`mailto:${LIST_EMAIL}`}><b>{LIST_EMAIL}</b></a>. CryptoFi never asks for payment to list a
        token. Anyone who does is not us.
      </p>

      <h2>Listing criteria</h2>
      <p>Each pool is checked against live Robinhood Chain state. A token needs at least one pool that passes all six.</p>
      <div className="pillars">
        {criteria.map((c) => (
          <div key={c.n} className="tile">
            <span className="num-badge mono">{c.n}</span>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
          </div>
        ))}
      </div>

      <h2>Rejected on sight</h2>
      <ul className="protect">
        {rejects.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2>What to send</h2>
      <ul className="protect">
        {fields.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h2>What happens next</h2>
      <div className="signs">
        {steps.map((s) => (
          <div key={s.n} className="sign">
            <span className="step-num">{s.n}</span>
            <div>
              <div className="sign-head">
                <b>{s.t}</b>
              </div>
              <p>{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="questions">
        <h2>Good to know</h2>
        <ol>
          <li>Listing is not an endorsement. <span>— it means a pool passed the checks above, nothing more.</span></li>
          <li>No timeline is promised. <span>— requests are reviewed in the order they arrive.</span></li>
          <li>A token can be delisted. <span>— if its pool drains, its hook changes or it stops passing a check.</span></li>
          <li>Every listing is public. <span>— see the addresses on <a href="#/transparency">Transparency</a> and the diff on GitHub.</span></li>
        </ol>
      </section>
      <p className="small">
        Anything else: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  )
}
