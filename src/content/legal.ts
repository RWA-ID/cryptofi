// Legal copy from the CryptoFi design handoff (2026-11-22).
// ENTITY mirrors StockFi's publisher. The handoff marks it "confirm with owner".
export const ENTITY = 'Only Buy Bitcoin LLC'
export const EFFECTIVE = 'November 22, 2026'

export type Section = { h: string; ps: string[]; list?: { b: string; t: string }[] }

const SAFE = '0x413513175061152D09aCc597f472A807b59374F5'

export const termsIntro = `These Terms of Service (“Terms”) govern your use of the CryptoFi interface at cryptofi.eth, including cryptofi.eth.limo, cryptofi.eth.link and any IPFS gateway serving the same build (the “Interface”). The Interface is published by ${ENTITY} (“we”, “us”). By using the Interface you agree to these Terms. If you do not agree, do not use it.`

export const terms: Section[] = [
  { h: '1. What CryptoFi is', ps: [
    'CryptoFi is a free-to-access, open-source software interface that helps you build and submit transactions to third-party Uniswap v4 smart contracts on Robinhood Chain to swap USDG with ETH, cbBTC and the other tokens listed in the Interface. It is a static website with no server operated by us.',
    'CryptoFi is not an exchange, broker, dealer, money transmitter, custodian or market maker. We never hold your funds or private keys, never sign or send a transaction for you, hold no liquidity and do not match orders. Every transaction is created by your wallet, signed by you and executed by public smart contracts we do not own or control.',
  ] },
  { h: '2. Eligibility', ps: [
    'You must be at least 18 years old and able to form a binding contract. You may not use the Interface if you are located in, or a national or resident of, a country or region subject to comprehensive sanctions, or if you are listed on any sanctions list maintained by the United States, the United Nations, the European Union or the United Kingdom.',
    'You are responsible for determining whether your use of the Interface and of digital assets is lawful where you live, and for any taxes that apply to you.',
  ] },
  { h: '3. Your wallet and your transactions', ps: [
    'You are solely responsible for your wallet, private keys, seed phrase and device security. We cannot access, recover, freeze, reverse or refund any transaction. Read every wallet prompt before you approve it.',
    'Quotes are estimates read from the Uniswap v4 Quoter at a point in time. The amount you receive depends on pool state when your transaction is included onchain, subject to the minimum you set through slippage. Transactions can fail and still cost network fees.',
  ] },
  { h: '4. Fees', ps: [
    `CryptoFi charges an interface fee of 0.25% of the swap output, deducted onchain within your swap transaction and sent to the CryptoFi 2-of-3 Safe at ${SAFE}. The fee is shown before you sign.`,
    'Pool LP fees (including dynamic fees set by third-party hooks) and network gas are separate, are not received by us, and are set by the pools and the network. We may change the interface fee for future swaps; any change will be visible in the Interface and in the public source code before it applies.',
  ] },
  { h: '5. Third-party protocols and assets', ps: [
    'The Interface relies on systems we do not control, including Robinhood Chain, Uniswap v4 contracts and pool hooks, Permit2, USDG, cbBTC and every other listed token, RPC providers, Reown (WalletConnect), ENS, IPFS and its gateways. Their availability, security, accuracy and terms are their own. A pool or hook may change fees, be paused, be exploited or lose liquidity at any time.',
  ] },
  { h: '6. Prohibited use', ps: [
    'You may not use the Interface to break any law; to launder money, evade sanctions, finance terrorism, manipulate markets or commit fraud; to interfere with, attack or overload the Interface or the networks it uses; or to misrepresent CryptoFi as affiliated with Robinhood, Uniswap, Coinbase, Paxos or the Global Dollar Network.',
  ] },
  { h: '7. Open source and intellectual property', ps: [
    'CryptoFi’s source code is published at github.com/RWA-ID/cryptofi under the license stated in that repository. The CryptoFi name, logo and site content belong to us. Third-party names and marks belong to their owners and are used only to identify networks, tokens and protocols.',
  ] },
  { h: '8. Disclaimer of warranties', ps: [
    'THE INTERFACE IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY AND UNINTERRUPTED OR ERROR-FREE OPERATION. WE DO NOT WARRANT THAT ANY QUOTE, ROUTE, CONTRACT OR TOKEN IS SECURE, CORRECT OR SUITABLE FOR YOU.',
  ] },
  { h: '9. Limitation of liability', ps: [
    `TO THE FULLEST EXTENT PERMITTED BY LAW, ${ENTITY.toUpperCase()} AND ITS MEMBERS, OFFICERS, CONTRIBUTORS AND MULTISIG SIGNERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DIGITAL ASSETS, TRADING LOSSES, SLIPPAGE, FAILED TRANSACTIONS, SMART-CONTRACT EXPLOITS, LOSS OF PROFITS OR DATA, ARISING FROM OR RELATED TO THE INTERFACE. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF THE INTERFACE FEES YOU PAID IN THE 30 DAYS BEFORE THE CLAIM OR ONE HUNDRED U.S. DOLLARS (US$100).`,
  ] },
  { h: '10. Indemnity', ps: [
    `You will defend, indemnify and hold harmless ${ENTITY} from any claims, losses and expenses (including reasonable legal fees) arising from your use of the Interface, your transactions, or your breach of these Terms or any law.`,
  ] },
  { h: '11. Availability', ps: [
    'We may change, suspend or stop publishing the Interface at any time. Because the code is open source and the contracts are public, you can always interact with them directly or through another interface.',
  ] },
  { h: '12. Governing law and disputes', ps: [
    'These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-laws rules. Disputes will be brought exclusively in the state or federal courts located in Delaware. Before filing a claim, you agree to contact us via x.com/cryptofidapp or a GitHub issue and try in good faith to resolve it informally for 30 days.',
  ] },
  { h: '13. Changes and contact', ps: [
    `We may update these Terms and will change the effective date above. Continued use after changes take effect means you accept them. Contact: ${ENTITY} · contact@cryptofi.trade · x.com/cryptofidapp · github.com/RWA-ID/cryptofi.`,
  ] },
]

export const privacyIntro =
  'This policy explains how information flows when you use the CryptoFi interface at cryptofi.eth. The short version: we run no server, so we receive nothing from your use of the Interface. No accounts, no sign-in, no cookies, no analytics, no advertising trackers.'

export const privacyNos = [
  { v: 'None', k: 'accounts or sign-in' },
  { v: 'None', k: 'cookies or analytics' },
  { v: 'None', k: 'servers run by us' },
  { v: 'None', k: 'data sold or shared' },
]

export const privacy: Section[] = [
  { h: 'What we collect', ps: [
    'Nothing. CryptoFi is static files served from IPFS. When you use it, your browser runs the code locally and talks directly to blockchain infrastructure. We have no server that receives your IP address, wallet address, amounts or transactions.',
  ] },
  { h: 'What your browser shares with third parties', ps: [
    'To work, the Interface makes requests to services we don’t operate. Each receives your IP address and the data needed to answer, under its own privacy policy:',
  ], list: [
    { b: 'Robinhood Chain RPC providers.', t: 'The public RPC at rpc.mainnet.chain.robinhood.com, and Alchemy when you visit cryptofi.eth.limo or cryptofi.eth.link. They see your wallet address when balances, allowances and quotes are read.' },
    { b: 'Ethereum mainnet RPC.', t: 'publicnode.com, or Alchemy on cryptofi.eth.limo and cryptofi.eth.link, used only to look up your ENS primary name for display.' },
    { b: 'Reown (WalletConnect).', t: 'The wallet connection window is Reown AppKit. It loads the wallet list from Reown, and if you connect a mobile wallet, WalletConnect relays session messages between the Interface and your wallet.' },
    { b: 'IPFS gateways.', t: 'eth.limo, eth.link or whichever gateway you use to load the site may log requests.' },
    { b: 'Google Fonts.', t: 'Serves the typefaces, so your browser contacts Google when a page loads.' },
  ] },
  { h: 'Public blockchain data', ps: [
    'Swaps, approvals and permits you sign are recorded permanently on Robinhood Chain and visible to anyone, including your wallet address, amounts and timestamps. No one, including us, can change or delete them.',
  ] },
  { h: 'Local storage', ps: [
    'Your wallet connector may store connection preferences in your browser’s local storage so you stay connected. That data stays on your device. Clear it at any time from your browser settings.',
  ] },
  { h: 'If you contact us', ps: [
    'If you email us, message @cryptofidapp on X or open a GitHub issue, we receive whatever you send, your email address or your public profile on that platform, and use it only to respond. Email is handled by our email providers (Cloudflare Email Routing and Google).',
  ] },
  { h: 'Your rights', ps: [
    'Because we hold no personal information from your use of the Interface, there is usually nothing for us to access, correct or delete. For data held by the third parties above, contact them directly. Onchain records cannot be deleted by anyone.',
  ] },
  { h: 'Children', ps: ['The Interface is not intended for anyone under 18.'] },
  { h: 'Changes and contact', ps: [`We may update this policy and will change the effective date above. Contact: ${ENTITY} · contact@cryptofi.trade · x.com/cryptofidapp.`] },
]

export const disclaimer: Section[] = [
  { h: 'Not advice', ps: [
    'Nothing in the Interface is investment, financial, legal or tax advice, a recommendation to buy, sell or hold any asset, or an offer or solicitation. CryptoFi shows quotes, routes and fees as data. It does not label any price as “best” and does not recommend a route. Consider independent professional advice.',
  ] },
  { h: 'Quotes are estimates', ps: [
    'Quotes come from the Uniswap v4 Quoter and reflect pool state at the moment they were read. Prices move, and other transactions can land before yours. The minimum received you set through slippage is the only amount enforced onchain. Price impact is measured against the pool’s mid price and includes the LP fee.',
  ] },
  { h: 'Third-party contracts and hooks', ps: [
    'Every swap executes through smart contracts CryptoFi did not write, deploy or audit, including pool hooks that set dynamic fees and may have their own administrators. Contracts can contain bugs, be exploited, be paused or behave unexpectedly. Verify what you interact with on the Transparency page.',
  ] },
  { h: 'Token risk', ps: [
    'USDG is a stablecoin issued by a third party and may lose its peg. cbBTC is a wrapped token whose value depends on its issuer’s custody of bitcoin; it is not native bitcoin. ETH is volatile. PONS, CASHCAT, HOOKR, PRIORS, ORBIO and other community tokens are highly volatile, can have thin liquidity, and may lose all of their value; tokens with the same name or symbol may be unrelated copies. Listing a token is not an endorsement. You can lose some or all of the value you swap.',
  ] },
  { h: 'Network risk', ps: [
    'Robinhood Chain, its sequencer, RPC providers and bridges may experience downtime, congestion, reorganizations or failures. Failed transactions still cost gas.',
  ] },
  { h: 'Interface risk', ps: [
    'Even a static, open-source frontend can contain bugs or be impersonated. Only use cryptofi.eth through a gateway you trust, and confirm the contract addresses in every wallet prompt.',
  ] },
  { h: 'No affiliation', ps: [
    'CryptoFi is independent and is not affiliated with, endorsed by or sponsored by Robinhood Markets, Inc. or its affiliates, Uniswap Labs, Coinbase, Paxos, the Global Dollar Network, ENS, Reown or WalletConnect. Their names and marks belong to their owners.',
  ] },
  { h: 'Final transactions', ps: [
    'Blockchain transactions are irreversible. CryptoFi cannot cancel, reverse or refund any swap, approval or fee.',
  ] },
]
