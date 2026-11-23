import { useEffect, useRef, useState } from 'react'
import type { Token } from '../lib/config.ts'
import { NATIVE } from '../lib/config.ts'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function TokenLogo({ token, size = 26 }: { token: Token; size?: number }) {
  return token.logo ? (
    <img className="tok-logo" src={token.logo} alt="" width={size} height={size} />
  ) : (
    <span className="tok-logo tok-fallback" style={{ width: size, height: size }} aria-hidden>
      {token.symbol.slice(0, 1)}
    </span>
  )
}

/** A static chip (the USDG side) or a styled picker for the other side of the pair. */
export function TokenPicker({
  token,
  options,
  onSelect,
}: {
  token: Token
  options?: Token[]
  onSelect?: (t: Token) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!options || !onSelect) {
    return (
      <span className="token with-icon">
        <TokenLogo token={token} />
        {token.symbol}
      </span>
    )
  }

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className="token with-icon picker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <TokenLogo token={token} />
        {token.symbol}
        <svg className="chev" width="12" height="8" viewBox="0 0 12 8" aria-hidden>
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="picker-list" role="listbox" aria-label="Choose a token">
          {options.map((t) => (
            <li key={t.symbol}>
              <button
                type="button"
                role="option"
                aria-selected={t.symbol === token.symbol}
                className={t.symbol === token.symbol ? 'picker-opt on' : 'picker-opt'}
                onClick={() => {
                  onSelect(t)
                  setOpen(false)
                }}
              >
                <TokenLogo token={t} size={32} />
                <span className="opt-text">
                  <b>{t.symbol}</b>
                  <span>{t.name}</span>
                </span>
                <span className="opt-addr mono">{t.address === NATIVE ? 'native' : short(t.address)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
