import { createAppKit } from '@reown/appkit/react'
import { defineChain, type AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { fallback, http } from 'wagmi'
import { robinhood as viemRobinhood } from './lib/config.ts'

const PUBLIC_RPC = 'https://rpc.mainnet.chain.robinhood.com'

// The Alchemy key is locked (in the Alchemy dashboard) to cryptofi.eth.limo and
// cryptofi.eth.link, so it is only used there. Anywhere else (localhost, a raw IPFS
// gateway) Alchemy would refuse the origin, so the public RPC is used instead.
// (The public RPC's CORS header was a broken "*,*" in Sept 2026; re-checked
// 2026-11-22: a single "*", so browsers can use it directly.)
const ALCHEMY_ORIGINS = ['cryptofi.eth.limo', 'cryptofi.eth.link']
const alchemyKey = import.meta.env.VITE_ALCHEMY_KEY as string | undefined
const onAlchemyOrigin = typeof location !== 'undefined' && ALCHEMY_ORIGINS.includes(location.hostname)
const rpc = alchemyKey && onAlchemyOrigin ? `https://robinhood-mainnet.g.alchemy.com/v2/${alchemyKey}` : PUBLIC_RPC

export const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || '43bdd1b8c477ac4d4a4264a14a8472f8'

export const robinhoodChain = defineChain({
  id: viemRobinhood.id,
  caipNetworkId: `eip155:${viemRobinhood.id}`,
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: viemRobinhood.nativeCurrency,
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: viemRobinhood.blockExplorers,
})

// Robinhood Chain only: CryptoFi never asks a wallet to use any other network.
// ENS names are read with a separate mainnet client (src/lib/ens.ts).
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [robinhoodChain]

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  transports: {
    [viemRobinhood.id]: rpc === PUBLIC_RPC ? http(PUBLIC_RPC) : fallback([http(rpc), http(PUBLIC_RPC)]),
  },
  ssr: false,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: robinhoodChain,
  projectId,
  metadata: {
    name: 'CryptoFi',
    description: 'Self-custodial USDG swaps on Robinhood Chain',
    url: 'https://cryptofi.eth.limo',
    // A square PNG: wallets draw this beside "do you want to sign this" and
    // commonly refuse to render SVG there.
    icons: ['https://cryptofi.eth.limo/icon-512.png'],
  },
  // WalletConnect explorer ids: Robinhood Wallet, MetaMask (same order as hoodfi.name).
  featuredWalletIds: [
    '8837dd9413b1d9b585ee937d27a816590248386d9dbf099aff5048f435ef347b',
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  ],
  allowUnsupportedChain: false,
  themeMode: 'light',
  // AppKit's public theming only reaches the font, accent, radius and color-mix.
  // Surfaces, text and buttons are set with --apkt-tokens-* in styles.css.
  themeVariables: {
    '--apkt-font-family': '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    '--apkt-accent': '#2c372f',
    '--apkt-color-mix-strength': 0,
    '--apkt-border-radius-master': '4px',
  },
  features: {
    analytics: false,
    // Remote features: if the Reown dashboard config loads, it overrides these.
    // Off here because AppKit's email/social embedded wallet does not reliably
    // sign on Robinhood Chain (see the AUTH handling in SwapCard).
    email: false,
    socials: false,
    onramp: false,
    swaps: false,
    connectMethodsOrder: ['wallet'],
  },
})
