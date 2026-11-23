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
}

export const NATIVE: Address = '0x0000000000000000000000000000000000000000'

export const TOKENS = {
  USDG: {
    symbol: 'USDG',
    name: 'Global Dollar',
    address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    decimals: 6,
  },
  ETH: { symbol: 'ETH', name: 'Ether', address: NATIVE, decimals: 18 },
  cbBTC: {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4',
    decimals: 8,
  },
} as const satisfies Record<string, Token>

export type TokenSymbol = keyof typeof TOKENS

export type PoolKey = {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export type Pool = { label: string; key: PoolKey }

const DYNAMIC_FEE = 0x800000

// Existing third-party Uniswap v4 pools. CryptoFi holds no liquidity.
// currency0 < currency1 by address (native ETH = 0x0 sorts first).
export const POOLS: Record<'ETH' | 'cbBTC', Pool[]> = {
  ETH: [
    {
      label: 'ETH/USDG · dynamic fee · tick spacing 1',
      key: {
        currency0: NATIVE,
        currency1: TOKENS.USDG.address,
        fee: DYNAMIC_FEE,
        tickSpacing: 1,
        hooks: '0x987E330F00B79864a07FE81dFaC344D0078ABCC0',
      },
    },
    {
      label: 'ETH/USDG · dynamic fee · tick spacing 10',
      key: {
        currency0: NATIVE,
        currency1: TOKENS.USDG.address,
        fee: DYNAMIC_FEE,
        tickSpacing: 10,
        hooks: '0x06a889870C8f83640D6816319f72e2aA579b6080',
      },
    },
  ],
  cbBTC: [
    {
      label: 'cbBTC/USDG · dynamic fee · tick spacing 10',
      key: {
        currency0: TOKENS.USDG.address,
        currency1: TOKENS.cbBTC.address,
        fee: DYNAMIC_FEE,
        tickSpacing: 10,
        hooks: '0x08E52564Bad99E05a694b4809F397edcA417A080',
      },
    },
    {
      label: 'cbBTC/USDG · 0.15% · no hook',
      key: {
        currency0: TOKENS.USDG.address,
        currency1: TOKENS.cbBTC.address,
        fee: 1500,
        tickSpacing: 15,
        hooks: NATIVE,
      },
    },
  ],
}

export const isNative = (t: Token) => t.address === NATIVE
