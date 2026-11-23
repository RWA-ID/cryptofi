import { CONTRACTS, FEE_RECIPIENT, NATIVE, POOLS, TOKENS } from '../lib/config.ts'
import { addrUrl } from '../lib/links.ts'

type RowT = { name: string; role: string; addr: string; url: string }
const row = (name: string, role: string, addr: string): RowT => ({ name, role, addr, url: addrUrl(addr) })

// Generated from src/lib/config.ts, the same addresses the swap code uses.
const hookRows: RowT[] = [...POOLS.ETH, ...POOLS.cbBTC].map((p) => {
  const pair = p.key.currency0 === NATIVE ? 'ETH/USDG' : 'cbBTC/USDG'
  const spacing = `tick spacing ${p.key.tickSpacing}`
  return p.key.hooks === NATIVE
    ? { name: `${pair} · ${spacing}`, role: `${p.key.fee / 10_000}% fixed fee`, addr: 'No hook (0x0)', url: addrUrl(CONTRACTS.poolManager) }
    : row(`${pair} · ${spacing}`, 'Dynamic-fee hook', p.key.hooks)
})

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
    note: 'ETH is native and has no contract. cbBTC is a token representation of BTC, not native bitcoin.',
    rows: [
      row(`USDG · ${TOKENS.USDG.name}`, `${TOKENS.USDG.decimals} decimals`, TOKENS.USDG.address),
      row(`cbBTC · ${TOKENS.cbBTC.name}`, `${TOKENS.cbBTC.decimals} decimals`, TOKENS.cbBTC.address),
    ],
  },
  {
    title: 'Pool hooks',
    note: 'Third-party hooks set the dynamic LP fee. Inspect each one’s owner and permissions before trading.',
    rows: hookRows,
  },
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
