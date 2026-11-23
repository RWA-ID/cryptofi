import { ASSETS, CONTRACTS, DYNAMIC_FEE, FEE_RECIPIENT, NATIVE, POOLS, TOKENS, type Pool } from '../lib/config.ts'
import { addrUrl } from '../lib/links.ts'

type RowT = { name: string; role: string; addr: string; url: string }
const row = (name: string, role: string, addr: string): RowT => ({ name, role, addr, url: addrUrl(addr) })

// Generated from src/lib/config.ts, the same addresses the swap code uses.
const feeText = (p: Pool) => (p.key.fee === DYNAMIC_FEE ? 'dynamic fee' : `${p.key.fee / 10_000}% fixed fee`)
const poolRow = (p: Pool): RowT =>
  p.key.hooks === NATIVE
    ? { name: p.label, role: `${feeText(p)} · tick spacing ${p.key.tickSpacing} · no hook`, addr: 'No hook (0x0)', url: addrUrl(CONTRACTS.poolManager) }
    : row(p.label, `${feeText(p)} · tick spacing ${p.key.tickSpacing} · hook (no ReturnDelta)`, p.key.hooks)
const poolGroups = ASSETS.map((a) => ({
  title: `${a} pools`,
  note:
    POOLS[a].eth.length > 0
      ? `Direct USDG pools, plus ${a}/ETH pools used as USDG → ETH → ${a} (the first hop goes through an ETH/USDG pool).`
      : `Direct ${a}/USDG pools.`,
  rows: [...POOLS[a].usdg, ...POOLS[a].eth].map(poolRow),
}))
const tokenRows: RowT[] = ASSETS.filter((a) => a !== 'ETH').map((a) =>
  row(`${TOKENS[a].symbol} · ${TOKENS[a].name}`, `${TOKENS[a].decimals} decimals`, TOKENS[a].address),
)

const groups: { title: string; note: string; rows: RowT[] }[] = [
  {
    title: 'Uniswap v4 core',
    note: 'Deployed and owned by Uniswap. CryptoFi calls them; it does not control them.',
    rows: [
      row('Universal Router 2.1.2', 'Swap entry point · your transaction target', CONTRACTS.universalRouter),
      row('Permit2', 'Approval spender for USDG and cbBTC', CONTRACTS.permit2),
      row('PoolManager', 'Holds pool state and liquidity', CONTRACTS.poolManager),
      row('V4 Quoter', 'Read-only quotes', CONTRACTS.quoter),
      row('StateView', 'Read-only pool prices', CONTRACTS.stateView),
    ],
  },
  {
    title: 'Tokens',
    note: 'ETH is native and has no contract. cbBTC is a token representation of BTC, not native bitcoin. PONS, CASHCAT, HOOKR, PRIORS and ORBIO are community tokens; addresses confirmed against the Robinhood Wallet. Same-symbol copies exist; check the address.',
    rows: [row(`USDG · ${TOKENS.USDG.name}`, `${TOKENS.USDG.decimals} decimals`, TOKENS.USDG.address), ...tokenRows],
  },
  ...poolGroups,
  {
    title: 'CryptoFi',
    note: 'The only CryptoFi-controlled address. It receives fees; it has no role in executing your swap.',
    rows: [row('CryptoFi Safe v1.5.0', '2-of-3 multisig · interface fee recipient', FEE_RECIPIENT)],
  },
]

export function Transparency() {
  return (
    <article className="doc wide">
      <p className="kicker">Transparency</p>
      <h1>Verify everything.</h1>
      <p className="lede">
        Every address CryptoFi touches, checked onchain on Robinhood Chain (chain ID 4663) on November 22, 2026: each
        has code, and each pool was matched to its PoolManager Initialize event. Every link opens Blockscout.
      </p>
      {groups.map((g) => (
        <section key={g.title} className="group">
          <h2>{g.title}</h2>
          <p className="note">{g.note}</p>
          <div className="list">
            {g.rows.map((r) => (
              <div key={r.name} className="list-row">
                <div>
                  <b>{r.name}</b>
                  <span>{r.role}</span>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="mono addr-link">
                  {r.addr} ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="group">
        <h2>How pools are listed</h2>
        <p className="note">
          Most of these tokens have hundreds of Uniswap v4 pools, many of them spam: fees up to 99%, empty liquidity, or
          hooks that change what you receive. CryptoFi lists a pool only if it has real depth and a sane fee, its hook
          (if any) has no ReturnDelta permission, so it cannot change swap amounts, and it quotes in both directions.
          A pool whose hook allows buys but blocks sells is never listed. Third-party hooks still set dynamic fees and
          may have their own admins; inspect them above.
        </p>
      </section>
      <section className="group">
        <h2>Frontend</h2>
        <p className="note">
          The site is a static Vite build with relative paths, pinned to IPFS. The cryptofi.eth contenthash points at
          that CID. Build it yourself and compare.
        </p>
        <pre className="code">{`git clone https://github.com/RWA-ID/cryptofi
cd cryptofi && npm install
npm run build        # dist/, IPFS-ready
npm run fork-test    # real swaps on an anvil fork; checks min received + 25 bips to the Safe`}</pre>
      </section>
      <section className="questions">
        <h2>Five questions you can answer before signing</h2>
        <ol>
          <li>Which contract am I calling? <span>— the Universal Router.</span></li>
          <li>Which contract receives my approval? <span>— Permit2, for the exact amount.</span></li>
          <li>Which pool and hook fill my swap? <span>— shown as the Route before you sign.</span></li>
          <li>Who controls the fee recipient? <span>— the 2-of-3 Safe.</span></li>
          <li>What does CryptoFi control in my swap? <span>— nothing onchain. It only builds the calldata your wallet shows you.</span></li>
        </ol>
      </section>
    </article>
  )
}
