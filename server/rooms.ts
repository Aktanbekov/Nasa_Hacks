// Team rooms without a long-running process: each request loads the room, brings its clock up to
// the current time, applies the player's action, and saves it back with a compare-and-set, so it
// works the same in one local Node process (memory store) and in Vercel Functions (Upstash Redis).
// Browsers poll GET /api/rooms/:code/state about once a second and POST their actions.
import { createGame, reduce, tick, type Action } from '../shared/game.ts'
import type { GameState } from '../shared/types.ts'
import { liveFires } from './fires.ts'

/** What is stored per room. lastTick is when the game clock last advanced. */
export interface RoomRecord { state: GameState; lastTick: number }

/** Versioned room storage. write() only succeeds if the room is still at `ver` (compare-and-set). */
export interface RoomStore {
  create(code: string, rec: RoomRecord): Promise<boolean>
  /** Load a room and, if `player` is given, record that this player was just seen. */
  read(code: string, player: string, now: number): Promise<{ rec: RoomRecord; ver: number; seen: Record<string, number> } | null>
  write(code: string, rec: RoomRecord, ver: number): Promise<boolean>
}

const ROOM_TTL_S = 6 * 60 * 60 // rooms expire 6 hours after their last change
/** A player who has not polled for this long is shown as disconnected (hidden tabs poll slowly). */
export const STALE_MS = 20_000
const MIN_TICK_GAP_MS = 300
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// ---------------------------------------------------------------- memory store (local server)

export function memoryStore(initial: Record<string, RoomRecord> = {}) {
  const rooms = new Map<string, { json: string; ver: number; seen: Record<string, number>; touched: number }>()
  for (const [code, rec] of Object.entries(initial)) rooms.set(code, { json: JSON.stringify(rec), ver: 1, seen: {}, touched: Date.now() })
  const store: RoomStore = {
    async create(code, rec) {
      if (rooms.has(code)) return false
      rooms.set(code, { json: JSON.stringify(rec), ver: 1, seen: {}, touched: Date.now() })
      return true
    },
    async read(code, player, now) {
      const r = rooms.get(code)
      if (!r) return null
      if (player) r.seen[player] = now
      return { rec: JSON.parse(r.json) as RoomRecord, ver: r.ver, seen: { ...r.seen } }
    },
    async write(code, rec, ver) {
      const r = rooms.get(code)
      if (!r || r.ver !== ver) return false
      r.json = JSON.stringify(rec)
      r.ver += 1
      r.touched = Date.now()
      return true
    },
  }
  /** Snapshot for saving to disk, dropping rooms idle past the TTL. */
  const dump = () => {
    const out: Record<string, RoomRecord> = {}
    for (const [code, r] of rooms) {
      if (Date.now() - r.touched > ROOM_TTL_S * 1000) rooms.delete(code)
      else out[code] = JSON.parse(r.json)
    }
    return out
  }
  return { store, dump }
}

// ---------------------------------------------------------------- Upstash Redis store (Vercel)

// Each script runs atomically inside Redis. Room hash: v = version, d = JSON record.
const LUA_CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'v', '1', 'd', ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1`
const LUA_READ = `
local d = redis.call('HMGET', KEYS[1], 'v', 'd')
if not d[1] then return false end
if ARGV[1] ~= '' then
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
  redis.call('EXPIRE', KEYS[2], ARGV[3])
end
return {d[1], d[2], redis.call('HGETALL', KEYS[2])}`
const LUA_WRITE = `
if redis.call('HGET', KEYS[1], 'v') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'v', tostring(tonumber(ARGV[1]) + 1), 'd', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`
export const LUA = { create: LUA_CREATE, read: LUA_READ, write: LUA_WRITE }

export function upstashStore(url: string, token: string): RoomStore {
  const exec = async (cmd: string[]) => {
    const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(8000) })
    const body = (await r.json().catch(() => ({}))) as { result?: unknown; error?: string }
    if (!r.ok || body.error) throw new Error(`Redis: ${body.error ?? `HTTP ${r.status}`}`)
    return body.result
  }
  const key = (code: string) => `lw:room:${code}`
  const seenKey = (code: string) => `lw:seen:${code}`
  return {
    async create(code, rec) {
      return (await exec(['EVAL', LUA_CREATE, '1', key(code), JSON.stringify(rec), String(ROOM_TTL_S)])) === 1
    },
    async read(code, player, now) {
      const res = (await exec(['EVAL', LUA_READ, '2', key(code), seenKey(code), player, String(now), String(ROOM_TTL_S)])) as [string, string, string[]] | null
      if (!res) return null
      const seen: Record<string, number> = {}
      for (let i = 0; i + 1 < res[2].length; i += 2) seen[res[2][i]] = Number(res[2][i + 1])
      return { rec: JSON.parse(res[1]) as RoomRecord, ver: Number(res[0]), seen }
    },
    async write(code, rec, ver) {
      return (await exec(['EVAL', LUA_WRITE, '1', key(code), String(ver), JSON.stringify(rec), String(ROOM_TTL_S)])) === 1
    },
  }
}

/** The Redis store when Upstash credentials are set (Vercel Marketplace names first). */
export function redisFromEnv(env: Record<string, string | undefined>): RoomStore | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? upstashStore(url, token) : null
}

// ---------------------------------------------------------------- room logic

class HttpError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

/**
 * Load a room, mark `player` present, bring the clock to now, optionally apply an action,
 * and save if anything changed. Retries when another request saved first.
 */
async function update(store: RoomStore, code: string, player: string, name: string, action?: Action) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const now = Date.now()
    const loaded = await store.read(code, player, now)
    if (!loaded) throw new HttpError(404, 'Room not found. Check the code.')
    const { rec, ver, seen } = loaded
    const s = rec.state
    const rev = s.rev
    if (player && !s.players[player]?.connected) reduce(s, { type: 'join', playerId: player, name }, now)
    for (const p of Object.values(s.players)) {
      if (p.connected && p.id !== player && now - (seen[p.id] ?? 0) > STALE_MS) reduce(s, { type: 'disconnect', playerId: p.id }, now)
    }
    // Several players poll each second; a plain poll right after another one skips the clock,
    // so polls rarely compete to save.
    const due = action || s.rev !== rev || now - rec.lastTick >= MIN_TICK_GAP_MS
    const ticked = due && now > rec.lastTick && tick(s, now, now - rec.lastTick)
    if (ticked) rec.lastTick = now
    if (action) reduce(s, action, now)
    s.now = now
    if (!ticked && s.rev === rev) return s // nothing to save
    if (await store.write(code, rec, ver)) return s
    // Someone else saved first: back off a little and redo it on the fresh state.
    await new Promise((r) => setTimeout(r, Math.min(400, 10 * 2 ** attempt) * (0.5 + Math.random())))
  }
  throw new HttpError(503, 'The room is busy. Try again.')
}

async function newRoom(store: RoomStore) {
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
    const now = Date.now()
    if (await store.create(code, { state: createGame(code, 'team', now), lastTick: now })) return code
  }
  throw new HttpError(503, 'Could not create a room. Try again.')
}

export interface ApiRequest { method: string; path: string; query: URLSearchParams; body?: unknown }
export interface ApiResponse { status: number; body: unknown; headers?: Record<string, string> }

/**
 * Every /api route except /api/info (which is local-only). `store` is null when no
 * room storage is configured, and then only the fire data works.
 */
export async function handleApi(req: ApiRequest, store: RoomStore | null): Promise<ApiResponse> {
  const parts = req.path.split('/').filter(Boolean) // ['api', ...]
  try {
    // GET /api/fires/live -> NASA FIRMS detections in California (CDN may cache 10 min)
    if (req.method === 'GET' && parts[1] === 'fires' && parts[2] === 'live') {
      return { status: 200, body: await liveFires(), headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=600' } }
    }
    if (parts[1] !== 'rooms') return { status: 404, body: { error: 'Not found' } }
    if (!store) {
      return { status: 503, body: { error: 'Team rooms need a database. In Vercel, open Storage and connect Upstash Redis to this project, then redeploy.' } }
    }
    // POST /api/rooms -> new room code
    if (req.method === 'POST' && parts.length === 2) return { status: 200, body: { code: await newRoom(store) } }

    const code = (parts[2] ?? '').toUpperCase()
    const player = (req.query.get('player') ?? '').slice(0, 32)
    const name = (req.query.get('name') ?? 'Player').slice(0, 24)

    // GET /api/rooms/:code -> does it exist?
    if (req.method === 'GET' && parts.length === 3) {
      const r = await store.read(code, '', Date.now())
      return r ? { status: 200, body: { ok: true, phase: r.rec.state.phase } } : { status: 404, body: { error: 'Room not found. Check the code.' } }
    }
    // GET /api/rooms/:code/state?player=&name=&rev= -> state, or {same} if the client is current
    if (req.method === 'GET' && parts[3] === 'state') {
      const s = await update(store, code, player, name)
      const have = Number(req.query.get('rev') ?? -1)
      return { status: 200, body: s.rev === have ? { same: true, now: s.now } : { state: s, now: s.now }, headers: { 'cache-control': 'no-store' } }
    }
    // POST /api/rooms/:code/action?player= -> apply, return the new state
    if (req.method === 'POST' && parts[3] === 'action') {
      const action = req.body as Action
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') return { status: 400, body: { error: 'Bad action' } }
      const s = await update(store, code, player || ((action as { playerId?: string }).playerId ?? ''), name, action)
      return { status: 200, body: { state: s, now: s.now } }
    }
    return { status: 404, body: { error: 'Not found' } }
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } }
    console.error(err)
    return { status: 500, body: { error: String((err as Error).message ?? err) } }
  }
}
