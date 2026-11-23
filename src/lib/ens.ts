import { createPublicClient, fallback, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

// ENS lives on Ethereum mainnet, and Robinhood Chain has no ENS reverse registrar, so a
// wallet's primary name is always read from mainnet. hoodfi.eth holders can set theirs
// there with ReverseRegistrar.setName, and getEnsName follows CCIP-Read through.
//
// getEnsName goes through the Universal Resolver, which also checks that the name
// resolves forward to the same address, so a spoofed reverse record is not shown.
// Neither viem nor the resolver checks expiry; this is only a display label.

const PUBLIC_MAINNET = 'https://ethereum-rpc.publicnode.com'
const ALCHEMY_ORIGINS = ['cryptofi.eth.limo', 'cryptofi.eth.link']
const key = import.meta.env.VITE_ALCHEMY_KEY as string | undefined
const onAlchemyOrigin = typeof location !== 'undefined' && ALCHEMY_ORIGINS.includes(location.hostname)

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport:
    key && onAlchemyOrigin
      ? fallback([http(`https://eth-mainnet.g.alchemy.com/v2/${key}`), http(PUBLIC_MAINNET)])
      : http(PUBLIC_MAINNET),
  batch: { multicall: true },
})

/** The address's ENS primary name, or null if none is set (or it fails the forward check). */
export async function primaryName(address: Address): Promise<string | null> {
  try {
    const name = await mainnetClient.getEnsName({ address })
    if (!name) return null
    normalize(name) // reject names that do not normalize (homoglyph and invalid labels)
    return name
  } catch {
    return null
  }
}
