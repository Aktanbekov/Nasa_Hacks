// Local game server: serves the room API (server/rooms.ts) from one Node process with rooms in
// memory, saved to .data/ so they survive a restart mid-demo. In production (`npm start`) it also
// serves the built app. On Vercel the same API runs as a function instead (server/vercel.ts).
// Zero dependencies: plain node:http.
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi, memoryStore, type RoomRecord } from './rooms.ts'

const PORT = Number(process.env.GAME_PORT ?? process.env.PORT ?? 8787)
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const SAVE_FILE = fileURLToPath(new URL('../.data/rooms.json', import.meta.url))

// ---- Rooms in memory, saved to disk every few seconds ----
let saved: Record<string, RoomRecord> = {}
try {
  if (existsSync(SAVE_FILE)) {
    const raw = JSON.parse(readFileSync(SAVE_FILE, 'utf8')) as Record<string, RoomRecord>
    // Older saves held bare game states; wrap them.
    for (const [code, r] of Object.entries(raw)) saved[code] = 'state' in r ? r : { state: r as unknown as RoomRecord['state'], lastTick: Date.now() }
    if (Object.keys(saved).length) console.log(`Restored ${Object.keys(saved).length} room(s)`)
  }
} catch (err) { console.error('Could not restore rooms:', err); saved = {} }
const { store, dump } = memoryStore(saved)
let lastSave = ''
function saveRooms() {
  const out = JSON.stringify(dump())
  if (out === lastSave) return
  try {
    mkdirSync(dirname(SAVE_FILE), { recursive: true })
    writeFileSync(SAVE_FILE + '.tmp', out)
    renameSync(SAVE_FILE + '.tmp', SAVE_FILE)
    lastSave = out
  } catch (err) { console.error('Could not save rooms:', err) }
}
setInterval(saveRooms, 3000)
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { saveRooms(); process.exit(0) })

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 50_000) throw new Error('too large') }
  return raw ? JSON.parse(raw) : undefined
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2',
}
function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x')
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  if (!existsSync(file)) { res.writeHead(404).end('Run `npm run build` first, or use `npm run dev`.'); return }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res)
  // The site may be served from another origin (VITE_SERVER_URL); rooms hold no credentials.
  const cors = { 'access-control-allow-origin': '*' }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' })
    return res.end()
  }
  // GET /api/info -> this machine's network addresses, so join links work from phones on the LAN
  if (req.method === 'GET' && url.pathname === '/api/info') {
    const addresses = Object.values(networkInterfaces()).flat()
      .filter((a) => a && a.family === 'IPv4' && !a.internal)
      .map((a) => a!.address)
    return send(res, 200, { addresses }, cors)
  }
  let body: unknown
  try { body = req.method === 'POST' ? await readBody(req) : undefined } catch { return send(res, 400, { error: 'Bad request body' }, cors) }
  const out = await handleApi({ method: req.method ?? 'GET', path: url.pathname, query: url.searchParams, body }, store)
  send(res, out.status, out.body, { ...cors, ...out.headers })
})

server.listen(PORT, () => console.log(`Launch Window server on http://localhost:${PORT}`))
