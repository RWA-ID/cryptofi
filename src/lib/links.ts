import { robinhood } from './config.ts'

export const EXPLORER = robinhood.blockExplorers.default.url
export const REPO_URL = 'https://github.com/RWA-ID/cryptofi'
export const X_URL = 'https://x.com/cryptofidapp'
export const SITE_URL = 'https://cryptofi.eth.limo'
export const LIST_EMAIL = 'list@cryptofi.trade'
export const CONTACT_EMAIL = 'contact@cryptofi.trade'

export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
