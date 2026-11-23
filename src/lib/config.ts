import { defineChain, type Address } from 'viem'

// Every address below was checked on Robinhood Chain (4663) on 2026-11-22:
// it has code, and pools were matched to their PoolManager Initialize event.

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
})

export const CONTRACTS = {
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  quoter: '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94',
  stateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b',
  // Universal Router 2.1.2 (Uniswap docs, Robinhood Chain table). Verified source
  // includes the minHopPriceX36 swap field and the TAKE_PORTION action.
  universalRouter: '0x204FAca1764B154221e35c0d20aBb3c525710498',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
} as const satisfies Record<string, Address>

// CryptoFi 2-of-3 Safe (v1.5.0), verified on 4663: threshold 2, three owners.
export const FEE_RECIPIENT: Address = '0x413513175061152D09aCc597f472A807b59374F5'
export const FEE_BIPS = 25n // 0.25%, taken from the swap output
export const BIPS = 10_000n

export type Token = {
  symbol: string
  name: string
  address: Address // 0x0 = native ETH
  decimals: number
  logo?: string // relative path under public/, bundled with the site
}

export const NATIVE: Address = '0x0000000000000000000000000000000000000000'

// Contract addresses for the community tokens were confirmed against the Robinhood
// Wallet by Hector (2026-11-23). Each also has by far the most holders of its symbol;
// same-symbol copies with ~200 holders and wash-traded pools exist for PONS and CASHCAT.
export const TOKENS = {
  USDG: { symbol: 'USDG', name: 'Global Dollar', address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', decimals: 6, logo: './tokens/usdg.svg' },
  ETH: { symbol: 'ETH', name: 'Ether', address: NATIVE, decimals: 18, logo: './tokens/eth.svg' },
  cbBTC: { symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', address: '0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4', decimals: 8, logo: './tokens/cbbtc.png' },
  PONS: { symbol: 'PONS', name: 'Pons', address: '0x39dBED3a2bd333467115dE45665cC57F813C4571', decimals: 18, logo: './tokens/pons.png' },
  CASHCAT: { symbol: 'CASHCAT', name: 'Cash Cat', address: '0x020bfC650A365f8BB26819deAAbF3E21291018b4', decimals: 18, logo: './tokens/cashcat.png' },
  HOOKR: { symbol: 'HOOKR', name: 'Hookr.fun', address: '0x18E674231A58c239Dc7DaeDcffE15Ec3A24cff5c', decimals: 18, logo: './tokens/hookr.png' },
  PRIORS: { symbol: 'PRIORS', name: 'Priors Agents', address: '0xeDBf91223639800BCd5756815CAf908Df3b890bE', decimals: 18, logo: './tokens/priors.svg' },
  ORBIO: { symbol: 'ORBIO', name: 'Orbio.so', address: '0xAa07A0e9209e16aC99708C3EC70159c6eF3128A3', decimals: 18, logo: './tokens/orbio.png' },
  // STONKBROKER and AI: addresses from the Robinhood Wallet (Hector, 2026-11-23). AI is a
  // non-upgradeable minimal-proxy clone (implementation 0x3be8b97f…c599 fixed in its bytecode).
  STONKBROKER: { symbol: 'STONKBROKER', name: 'StonkBroker', address: '0xe934e36A439C94017B64a3FecE66AF12099aBF50', decimals: 18, logo: './tokens/stonkbroker.png' },
  AI: { symbol: 'AI', name: 'Artificial Inu', address: '0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18', decimals: 18, logo: './tokens/ai.png' },
} as const satisfies Record<string, Token>

export type TokenSymbol = keyof typeof TOKENS
export type Asset = Exclude<TokenSymbol, 'USDG'>
/** Display order in the picker. */
export const ASSETS: Asset[] = ['ETH', 'cbBTC', 'PONS', 'CASHCAT', 'HOOKR', 'PRIORS', 'ORBIO', 'STONKBROKER', 'AI']
/** Listed community tokens: everything except the chain's native gas asset and cbBTC. */
export const COMMUNITY: Asset[] = ASSETS.filter((a) => a !== 'ETH' && a !== 'cbBTC')

export type PoolKey = {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export type Pool = { label: string; key: PoolKey }

export const DYNAMIC_FEE = 0x800000

// Hooks seen on listed pools. None has a ReturnDelta permission, so none can change
// swap amounts; they set the dynamic LP fee or observe the swap.
const HOOK_DYN_A = '0x08E52564Bad99E05a694b4809F397edcA417A080' // beforeSwap (also on cbBTC/USDG)
const HOOK_DYN_B = '0x594e8e6281eDf2d363a0293a50004Cf868E7a080' // beforeSwap

/** A pool key with currencies sorted the way the PoolManager requires. */
function pool(label: string, a: Address, b: Address, fee: number, tickSpacing: number, hooks: Address = NATIVE): Pool {
  const [currency0, currency1] = BigInt(a) < BigInt(b) ? [a, b] : [b, a]
  return { label, key: { currency0, currency1, fee, tickSpacing, hooks } }
}

const U = TOKENS.USDG.address
const E = NATIVE

/**
 * Existing third-party Uniswap v4 pools, chosen by hand. CryptoFi holds no liquidity.
 * Listing rule: real depth, a sane fee, no hook with a ReturnDelta permission, and the
 * pool must quote in BOTH directions (a buy-only hook traps sellers).
 * `usdg`: pools pairing the asset directly with USDG.
 * `eth`:  pools pairing the asset with native ETH, used as USDG -> ETH -> asset
 *         (the first hop goes through one of the ETH/USDG pools).
 * Most of these tokens have hundreds of spam pools (fees up to 99%, empty or
 * draining hooks); none of those are listed.
 */
export const POOLS: Record<Asset, { usdg: Pool[]; eth: Pool[] }> = {
  ETH: {
    usdg: [
      pool('ETH/USDG · dynamic fee · tick spacing 1', E, U, DYNAMIC_FEE, 1, '0x987E330F00B79864a07FE81dFaC344D0078ABCC0'),
      pool('ETH/USDG · dynamic fee · tick spacing 10', E, U, DYNAMIC_FEE, 10, '0x06a889870C8f83640D6816319f72e2aA579b6080'),
    ],
    eth: [],
  },
  cbBTC: {
    usdg: [
      pool('cbBTC/USDG · dynamic fee · tick spacing 10', U, TOKENS.cbBTC.address, DYNAMIC_FEE, 10, HOOK_DYN_A),
      pool('cbBTC/USDG · 0.15% · no hook', U, TOKENS.cbBTC.address, 1500, 15),
    ],
    eth: [],
  },
  PONS: {
    usdg: [
      pool('PONS/USDG · 0.3% · no hook', U, TOKENS.PONS.address, 3000, 60),
      pool('PONS/USDG · dynamic fee', U, TOKENS.PONS.address, DYNAMIC_FEE, 60, HOOK_DYN_A),
    ],
    eth: [
      pool('PONS/ETH · 0.3% · no hook', E, TOKENS.PONS.address, 3000, 60),
      pool('PONS/ETH · dynamic fee', E, TOKENS.PONS.address, DYNAMIC_FEE, 60, HOOK_DYN_B),
    ],
  },
  CASHCAT: {
    usdg: [
      pool('CASHCAT/USDG · 0.269% · no hook', U, TOKENS.CASHCAT.address, 2690, 54),
      pool('CASHCAT/USDG · dynamic fee', U, TOKENS.CASHCAT.address, DYNAMIC_FEE, 60, HOOK_DYN_A),
    ],
    eth: [
      pool('CASHCAT/ETH · dynamic fee', E, TOKENS.CASHCAT.address, DYNAMIC_FEE, 60, HOOK_DYN_B),
      pool('CASHCAT/ETH · 0.2925% · no hook', E, TOKENS.CASHCAT.address, 2925, 29),
    ],
  },
  HOOKR: {
    usdg: [
      // Delisted 2026-11-23: HOOKR/USDG 3.04% (no hook). Over the published 1% fee limit.
      pool('HOOKR/USDG · 1% · no hook', U, TOKENS.HOOKR.address, 10000, 100),
    ],
    eth: [
      // Not listed: HOOKR/ETH 0.0375% with hook 0xB85138cb…d4C0. Its hook reverts every
      // sell (buy-only), checked 2026-11-23. The same hook is on unlisted PRIORS/ORBIO pools.
      pool('HOOKR/ETH · 0.25% · no hook', E, TOKENS.HOOKR.address, 2500, 25),
    ],
  },
  PRIORS: {
    usdg: [pool('PRIORS/USDG · 1% · no hook', U, TOKENS.PRIORS.address, 10000, 100)],
    eth: [],
  },
  ORBIO: {
    usdg: [
      pool('ORBIO/USDG · 0.8% · no hook', U, TOKENS.ORBIO.address, 8000, 80),
      pool('ORBIO/USDG · dynamic fee', U, TOKENS.ORBIO.address, DYNAMIC_FEE, 200, HOOK_DYN_A),
    ],
    eth: [pool('ORBIO/ETH · 0.9% · no hook', E, TOKENS.ORBIO.address, 9000, 90)],
  },
  // Not listed for STONKBROKER or AI (quoted 2026-11-23): pools with hook 0xc52f…54c0 fill
  // buys but revert every sell (buy-only); the remaining hookless pools are too thin to
  // sell back, or charge over 1%. STONKBROKER/ETH dynamic (HOOK_DYN_B) does not quote at all.
  // Neither token has a USDG pool with real depth.
  STONKBROKER: {
    usdg: [],
    eth: [pool('STONKBROKER/ETH · 1% · no hook', E, TOKENS.STONKBROKER.address, 10000, 200)],
  },
  AI: {
    usdg: [],
    eth: [pool('AI/ETH · dynamic fee', E, TOKENS.AI.address, DYNAMIC_FEE, 200, HOOK_DYN_B)],
  },
}

export const isNative = (t: Token) => t.address === NATIVE
