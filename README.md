# CryptoFi

Self-custodial swap interface for **USDG pairs on Robinhood Chain** (cryptofi.eth).

- **Static frontend only.** Vite + React + wagmi + Reown AppKit. No backend, no database, no order matching. Hash routes (`#/security`, `#/transparency`, `#/terms`, `#/privacy`, `#/disclaimer`) so every page works from an IPFS gateway.
- **You sign everything.** Swaps call the Uniswap v4 Universal Router directly; ERC-20 inputs (USDG and every listed token) are spent through Permit2 with an exact-amount, 30-minute permit.
- **Existing liquidity only.** CryptoFi holds no liquidity. It quotes the listed v4 routes for a pair with the official v4 Quoter and uses the one that returns the most output.
- **Passive.** Shows the quote, route, pool LP fee, price impact vs. the pool mid price, the interface fee, slippage and the minimum received. No recommendations and no "best price" labels.
- **Interface fee: 0.25%** of the output, taken on-chain by the router's `TAKE_PORTION` action and sent to the CryptoFi 2-of-3 Safe `0x413513175061152D09aCc597f472A807b59374F5`.
- **ENS primary names** are read from Ethereum mainnet (forward-verified by the Universal Resolver).

## Pairs and pools (Robinhood Chain, 4663)

USDG paired with **ETH, cbBTC, PONS, CASHCAT, HOOKR, PRIORS, ORBIO, STONKBROKER and AI** (the list lives in `ASSETS`). Routes are a direct USDG pool, or USDG → ETH → token through two pools in one swap; the app quotes every listed route and uses the one with the most output.

Pools are hand-picked in [`src/lib/config.ts`](src/lib/config.ts). Most of these tokens have hundreds of v4 pools, mostly spam. The listing rule: real depth, a sane fee, no hook with a `ReturnDelta` permission (so it can't change swap amounts), and the pool must quote in **both** directions (a buy-only hook is excluded). Token addresses were confirmed against the Robinhood Wallet; same-symbol copies exist.

`npm run verify-routes` quotes every listed route, buy and sell, against live state.

## Develop

```bash
cp .env.example .env   # VITE_ALCHEMY_KEY, VITE_WALLETCONNECT_PROJECT_ID
npm install
npm run dev
```

The Alchemy key is domain-locked to `cryptofi.eth.limo` and `cryptofi.eth.link`, so the app only uses it there. Everywhere else (localhost, raw IPFS gateways) it falls back to public RPCs.

## Verify the swap encoding on a fork

```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --port 8547
npm run fork-test
```

Runs real swaps (ETH→USDG, USDG→ETH, USDG→cbBTC, cbBTC→USDG) through the same `src/lib/swap.ts` the app uses. It checks receipt status, that the user received at least the minimum, and that the Safe received 25 bips.

## Build and deploy

```bash
npm run build          # dist/ with relative paths, IPFS-ready
npm run pin            # pins dist/ via Pinata (PINATA_JWT in .env.local), prints the CID
```

Then set the `cryptofi.eth` contenthash to `ipfs://<CID>`.

## License

[Apache-2.0](LICENSE)
