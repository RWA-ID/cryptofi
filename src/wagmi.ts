import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { fallback, http } from 'wagmi'
import { robinhood } from './lib/config.ts'

const PUBLIC_RPC = 'https://rpc.mainnet.chain.robinhood.com'

// The Alchemy key is locked (in the Alchemy dashboard) to cryptofi.eth.limo and
// cryptofi.eth.link, so it is only used there. Anywhere else (localhost, a raw IPFS
// gateway) Alchemy would refuse the origin, so the public RPC is used instead.
const ALCHEMY_ORIGINS = ['cryptofi.eth.limo', 'cryptofi.eth.link']
const alchemyKey = import.meta.env.VITE_ALCHEMY_KEY as string | undefined
const onAlchemyOrigin = typeof location !== 'undefined' && ALCHEMY_ORIGINS.includes(location.hostname)

const transport =
  alchemyKey && onAlchemyOrigin
    ? fallback([http(`https://robinhood-mainnet.g.alchemy.com/v2/${alchemyKey}`), http(PUBLIC_RPC)])
    : http(PUBLIC_RPC)

export const wagmiConfig = getDefaultConfig({
  appName: 'CryptoFi',
  appDescription: 'Self-custodial USDG swaps on Uniswap v4, Robinhood Chain',
  appUrl: 'https://cryptofi.eth.limo',
  projectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || '43bdd1b8c477ac4d4a4264a14a8472f8',
  chains: [robinhood],
  transports: { [robinhood.id]: transport },
  ssr: false,
})
