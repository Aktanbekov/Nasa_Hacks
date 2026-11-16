// Packages the built site plus the room API as a Vercel deployment (Build Output API v3):
//   .vercel/output/static/            the Vite build (dist/)
//   .vercel/output/functions/api.func  server/vercel.ts bundled into one file
//   .vercel/output/config.json         /api/* -> that function, everything else static
// Runs automatically inside Vercel builds (VERCEL=1). Locally: node scripts/vercel-output.mjs --force
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

if (!process.env.VERCEL && !process.argv.includes('--force')) process.exit(0)

const root = fileURLToPath(new URL('..', import.meta.url))
const out = `${root}.vercel/output`
const fn = `${out}/functions/api.func`
rmSync(out, { recursive: true, force: true })
mkdirSync(fn, { recursive: true })

cpSync(`${root}dist`, `${out}/static`, { recursive: true })

await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    ssr: 'server/vercel.ts',
    outDir: fn,
    emptyOutDir: false,
    minify: false,
    target: 'node22',
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
  },
  ssr: { noExternal: true, target: 'node' },
})

writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 30,
}, null, 2))

writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api/(.*)$', dest: '/api?__path=$1' },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
}, null, 2))

console.log('Vercel output ready: static site + /api function')
