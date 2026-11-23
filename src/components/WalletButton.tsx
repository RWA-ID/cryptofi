import { useAppKit } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { primaryName } from '../lib/ens.ts'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** The wallet's ENS primary name, read from Ethereum mainnet (forward-verified). */
export function usePrimaryName(address?: Address) {
  return useQuery({
    queryKey: ['ens-primary', address],
    queryFn: () => primaryName(address!),
    enabled: !!address,
    staleTime: 5 * 60_000,
  })
}

export function WalletButton({ className = '' }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { data: name } = usePrimaryName(address)

  if (!isConnected || !address) {
    return (
      <button className={`wallet dark ${className}`} onClick={() => open()}>
        Connect wallet
      </button>
    )
  }
  return (
    <button className={`wallet ${className}`} onClick={() => open({ view: 'Account' })} title={address}>
      <span className="dot" aria-hidden />
      {name ? <span className="ens">{name}</span> : <span className="addr">{short(address)}</span>}
    </button>
  )
}
