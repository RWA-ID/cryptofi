import { useEffect, useRef, useState } from 'react'
import { WalletButton } from './components/WalletButton.tsx'
import { Home } from './pages/Home.tsx'
import { Security } from './pages/Security.tsx'
import { Transparency } from './pages/Transparency.tsx'
import { ListToken } from './pages/ListToken.tsx'
import { Disclaimer, Privacy, Terms } from './pages/Legal.tsx'
import { CONTACT_EMAIL, REPO_URL, SITE_URL, X_URL } from './lib/links.ts'

// Hash routing, so every page works from an IPFS gateway path with no server rewrites.
const PAGES = ['security', 'transparency', 'list', 'terms', 'privacy', 'disclaimer'] as const
type Page = (typeof PAGES)[number] | ''

function readPage(): Page | null {
  const h = (location.hash || '').replace(/^#\/?/, '')
  if (h === 'swap') return null // in-page anchor, not a route
  return (PAGES as readonly string[]).includes(h) ? (h as Page) : ''
}

export function App() {
  const [page, setPage] = useState<Page>(() => readPage() ?? '')

  useEffect(() => {
    const onHash = () => {
      const next = readPage()
      if (next === null) {
        // "#swap" from another page: go home, then scroll to the card.
        if (page !== '') {
          setPage('')
          setTimeout(() => document.getElementById('swap')?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        return
      }
      if (next !== page) {
        setPage(next)
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [page])

  // Narrow screens: the nav collapses into a menu at the top right.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => setMenuOpen(false), [page])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [menuOpen])

  const nav: [string, string, Page | 'x'][] = [
    ['Swap', '#/', ''],
    ['Security', '#/security', 'security'],
    ['Transparency', '#/transparency', 'transparency'],
    ['List a token', '#/list', 'list'],
    ['Source', REPO_URL, 'x'],
  ]
  const navLinks = nav.map(([label, href, key]) => (
    <a
      key={label}
      href={href}
      className={key === page ? 'on' : ''}
      aria-current={key === page ? 'page' : undefined}
      onClick={() => setMenuOpen(false)}
      {...(key === 'x' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </a>
  ))

  return (
    <div className="wrap">
      <header className="top">
        <a href="#/" className="brand">
          <span className="mark" aria-hidden>C</span>
          <span className="word">CryptoFi</span>
          <span className="chain">Robinhood Chain</span>
        </a>
        <nav aria-label="Main" className="nav">
          {navLinks}
        </nav>
        <div className="top-right" ref={menuRef}>
          <WalletButton />
          <button
            type="button"
            className="menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              )}
            </svg>
          </button>
          {menuOpen && (
            <nav id="mobile-menu" aria-label="Menu" className="menu">
              {navLinks}
            </nav>
          )}
        </div>
      </header>

      <main>
        {page === '' && <Home />}
        {page === 'security' && <Security />}
        {page === 'transparency' && <Transparency />}
        {page === 'list' && <ListToken />}
        {page === 'terms' && <Terms />}
        {page === 'privacy' && <Privacy />}
        {page === 'disclaimer' && <Disclaimer />}
      </main>

      <footer className="foot">
        <div className="foot-top">
          <div className="foot-links">
            <a href={SITE_URL} rel="noopener">cryptofi.eth</a>
            <span className="sep" aria-hidden />
            <a href={X_URL} target="_blank" rel="noopener noreferrer">@cryptofidapp</a>
            <span className="sep" aria-hidden />
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">RWA-ID/cryptofi</a>
            <span className="sep" aria-hidden />
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
          <div className="foot-right">
            <div className="socials">
              <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="CryptoFi on X (@cryptofidapp)" title="@cryptofidapp">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                </svg>
              </a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="CryptoFi source on GitHub" title="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
            </div>
            <a className="badge-link" href="https://docs.robinhood.com/chain/" target="_blank" rel="noopener noreferrer">
              <span>Built on</span>
              <img src="./brand/robinhood-chain-logo-black.svg" alt="Robinhood Chain" width={152} height={20} className="rh-logo" />
            </a>
            <a className="badge-link" href="https://globaldollar.com" target="_blank" rel="noopener noreferrer">
              <span>Swaps in</span>
              <img src="./brand/usdg-brandmark-dark.svg" alt="Global Dollar USDG" width={106} height={35} className="usdg-logo" />
            </a>
          </div>
        </div>
        <nav aria-label="Legal" className="legal-nav">
          <a href="#/security">Security</a>
          <a href="#/transparency">Transparency</a>
          <a href="#/list">List a token</a>
          <a href="#/terms">Terms</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/disclaimer">Disclaimer</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source</a>
        </nav>
        <p className="foot-blurb">
          CryptoFi is an interface. You sign every transaction in your own wallet, and swaps execute directly against
          existing third-party Uniswap v4 pools on Robinhood Chain. CryptoFi holds no funds or liquidity and runs no
          server. Quotes can change before your transaction lands. Not investment advice. CryptoFi is independent and
          not affiliated with, endorsed by, or sponsored by Robinhood Markets, Inc. or its affiliates, Uniswap Labs,
          Coinbase, Paxos or the Global Dollar Network. USDG, cbBTC and the Robinhood Chain marks belong to their owners.
        </p>
      </footer>
    </div>
  )
}
