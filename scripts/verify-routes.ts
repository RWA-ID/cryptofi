// Quotes every listed route, buy and sell, against live Robinhood Chain. Run: npm run verify-routes
import { createPublicClient, http, parseUnits, formatUnits, type PublicClient } from 'viem'
import { robinhood, TOKENS, ASSETS } from '../src/lib/config.ts'
import { candidateRoutes, getQuotes } from '../src/lib/swap.ts'
const c = createPublicClient({ chain: robinhood, transport: http() }) as PublicClient
for (const a of ASSETS) {
  const t = TOKENS[a]
  const buy = await getQuotes(c, TOKENS.USDG, t, parseUnits('100', 6))
  const nRoutes = candidateRoutes(TOKENS.USDG, t).length
  const got = buy[0] ? buy[0].userAmountOut : 0n
  const sell = got > 0n ? await getQuotes(c, t, TOKENS.USDG, got) : []
  const back = sell[0] ? Number(formatUnits(sell[0].userAmountOut, 6)) : 0
  console.log(`${a.padEnd(8)} routes ${nRoutes}  buy ok ${buy.length}/${nRoutes}  sell ok ${sell.length}/${nRoutes}  | $100 -> ${Number(formatUnits(got, t.decimals)).toLocaleString('en-US',{maximumFractionDigits:6})} ${a} via [${buy[0]?.route.label}] impact ${((buy[0]?.priceImpact ?? 0)*100).toFixed(2)}%  | sell back -> $${back.toFixed(2)} via [${sell[0]?.route.label}]`)
}
