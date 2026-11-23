// Pin dist/ to IPFS via Pinata (shared local pin key, PINATA_JWT in .env.local).
// Usage: npm run build && npm run pin
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const envFile = join(root, '.env.local')
const env = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {}
const JWT = process.env.PINATA_JWT || env.PINATA_JWT
if (!JWT) { console.error('PINATA_JWT not set (.env.local)'); process.exit(1) }

const DIST = join(root, 'dist')
if (!existsSync(join(DIST, 'index.html'))) { console.error('dist/index.html missing: run npm run build'); process.exit(1) }

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}
const files = walk(DIST)

// Pre-pin guards: root-absolute paths break under IPFS path gateways, and no
// Pinata credential may ever ship inside the bundle.
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const absolute = html.match(/(?:src|href)="\/[^/"][^"]*"/g)
if (absolute) { console.error('Root-absolute paths in index.html:', absolute); process.exit(1) }
for (const f of files) {
  if (!/\.(js|html|css|json)$/.test(f)) continue
  if (readFileSync(f, 'utf8').includes(JWT.slice(-24))) { console.error('Pinata JWT found in', f); process.exit(1) }
}

const form = new FormData()
for (const f of files) form.append('file', new Blob([readFileSync(f)]), `cryptofi/${relative(DIST, f)}`)
form.append('pinataMetadata', JSON.stringify({ name: `cryptofi.eth ${new Date().toISOString().slice(0, 16)}` }))
form.append('pinataOptions', JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }))

console.log(`Pinning ${files.length} files…`)
const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: { Authorization: `Bearer ${JWT}` },
  body: form,
})
const text = await res.text()
if (!res.ok) { console.error('Pin failed:', res.status, text); process.exit(1) }
const { IpfsHash } = JSON.parse(text)
console.log(`CID: ${IpfsHash}`)
console.log(`Check: https://ipfs.onchain-id.id/ipfs/${IpfsHash}/`)
console.log(`ENS contenthash: ipfs://${IpfsHash}`)
