import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On Vercel, the project's public address (e.g. nasa-hacks.vercel.app). Per-deployment URLs
// sit behind Vercel's login, so team invite links and QR codes use this one instead.
const publicHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_PUBLIC_HOST': JSON.stringify(publicHost) },
  server: {
    host: true,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
})
