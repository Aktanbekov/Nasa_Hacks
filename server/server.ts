// Team-room server: holds each room's game state, applies player actions with
// the shared reducer, runs the clock, and streams state to browsers over SSE.
// Zero dependencies: plain node:http. In production it also serves the built app.
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGame, reduce, tick, TICK_MS, type Action } from '../shared/game.ts'
import type { GameState } from '../shared/types.ts'

const PORT = Number(process.env.GAME_PORT ?? process.env.PORT ?? 8787)
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const SAVE_FILE = fileURLToPath(new URL('../.data/rooms.json', import.meta.url))

interface Room { state: GameState; clients: Map<ServerResponse, string>; lastSeen: number }
const rooms = new Map<string, Room>()

// ---- Persistence: rooms survive a server restart (e.g. mid-demo) ----
let dirty = false
function saveRooms() {
  if (!dirty) return
  dirty = false
  const out: Record<string, GameState> = {}
  for (const [code, room] of rooms) out[code] = room.state
  try {
    mkdirSync(dirname(SAVE_FILE), { recursive: true })
    writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(out))
    renameSync(SAVE_FILE + '.tmp', SAVE_FILE)
  } catch (err) { console.error('Could not save rooms:', err) }
}
try {
  if (existsSync(SAVE_FILE)) {
    const saved = JSON.parse(readFileSync(SAVE_FILE, 'utf8')) as Record<string, GameState>
    for (const [code, state] of Object.entries(saved)) {
      for (const p of Object.values(state.players)) p.connected = false
      rooms.set(code, { state, clients: new Map(), lastSeen: Date.now() })
    }
    if (rooms.size) console.log(`Restored ${rooms.size} room(s)`)
  }
} catch (err) { console.error('Could not restore rooms:', err) }
setInterval(saveRooms, 3000)
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { saveRooms(); process.exit(0) })

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newCode() {
  let code = ''
  do { code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('') } while (rooms.has(code))
  return code
}

function broadcast(room: Room) {
  dirty = true
  const data = `data: ${JSON.stringify(room.state)}\n\n`
  for (const res of room.clients.keys()) res.write(data)
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<any> {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 50_000) throw new Error('too large') }
  return raw ? JSON.parse(raw) : {}
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
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
  const parts = url.pathname.split('/').filter(Boolean)
  try {
    if (parts[0] !== 'api') return serveStatic(req, res)

    // GET /api/info -> this machine's network addresses, so join links work from phones
    if (req.method === 'GET' && parts[1] === 'info') {
      const addresses = Object.values(networkInterfaces()).flat()
        .filter((a) => a && a.family === 'IPv4' && !a.internal)
        .map((a) => a!.address)
      return json(res, 200, { addresses })
    }

    // POST /api/rooms -> create a team room
    if (req.method === 'POST' && parts[1] === 'rooms' && parts.length === 2) {
      const code = newCode()
      rooms.set(code, { state: createGame(code, 'team', Date.now()), clients: new Map(), lastSeen: Date.now() })
      return json(res, 200, { code })
    }

    const room = parts[1] === 'rooms' ? rooms.get((parts[2] ?? '').toUpperCase()) : undefined
    if (!room) return json(res, 404, { error: 'Room not found. Check the code.' })
    room.lastSeen = Date.now()

    // GET /api/rooms/:code -> does the room exist?
    if (req.method === 'GET' && parts.length === 3) return json(res, 200, { ok: true, phase: room.state.phase })

    // GET /api/rooms/:code/stream?player=..&name=.. -> live state (SSE)
    if (req.method === 'GET' && parts[3] === 'stream') {
      const playerId = url.searchParams.get('player') ?? ''
      const name = (url.searchParams.get('name') ?? 'Player').slice(0, 24)
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' })
      res.write('retry: 1500\n\n')
      room.clients.set(res, playerId)
      reduce(room.state, { type: 'join', playerId, name }, Date.now())
      broadcast(room)
      const ping = setInterval(() => res.write(': ping\n\n'), 15000)
      req.on('close', () => {
        clearInterval(ping)
        room.clients.delete(res)
        // Only mark disconnected if this player has no other open tab.
        if (![...room.clients.values()].includes(playerId)) {
          reduce(room.state, { type: 'disconnect', playerId }, Date.now())
          broadcast(room)
        }
      })
      return
    }

    // POST /api/rooms/:code/action
    if (req.method === 'POST' && parts[3] === 'action') {
      const action = (await readBody(req)) as Action
      reduce(room.state, action, Date.now())
      broadcast(room)
      return json(res, 200, { ok: true, rev: room.state.rev })
    }
    return json(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error(err)
    return json(res, 400, { error: String((err as Error).message ?? err) })
  }
})

// Game clock for every active room.
let last = Date.now()
setInterval(() => {
  const now = Date.now()
  const dt = now - last
  last = now
  for (const [code, room] of rooms) {
    if (tick(room.state, now, dt)) broadcast(room)
    if (room.clients.size === 0 && now - room.lastSeen > 1000 * 60 * 60 * 3) rooms.delete(code)
  }
}, TICK_MS)

server.listen(PORT, () => console.log(`Launch Window server on http://localhost:${PORT}`))
