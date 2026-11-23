import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { primaryName } from './lib/ens.ts'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Shows the wallet's ENS primary name (read from Ethereum mainnet), else the short address. */
export function usePrimaryName(address?: Address) {
  return useQuery({
    queryKey: ['ens-primary', address],
    queryFn: () => primaryName(address!),
    enabled: !!address,
    staleTime: 5 * 60_000,
  })
}

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, mounted, openAccountModal, openConnectModal }) => {
        if (!mounted) return <span className="wallet placeholder" aria-hidden />
        if (!account) {
          return (
            <button className="wallet dark" onClick={openConnectModal}>
              Connect wallet
            </button>
          )
        }
        return <Connected address={account.address as Address} onClick={openAccountModal} />
      }}
    </ConnectButton.Custom>
  )
}

function Connected({ address, onClick }: { address: Address; onClick: () => void }) {
  const { data: name } = usePrimaryName(address)
  return (
    <button className="wallet" onClick={onClick} title={address}>
      <span className="dot" aria-hidden />
      {name ? <span className="ens">{name}</span> : <span className="addr">{short(address)}</span>}
    </button>
  )
}
