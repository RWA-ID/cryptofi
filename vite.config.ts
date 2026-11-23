import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps every asset path relative, so the build works from an
// IPFS gateway sub-path (…/ipfs/<cid>/) as well as from cryptofi.eth.limo.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
})
