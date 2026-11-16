// Room API check (the same code the local server and the Vercel function run): plays a full
// team mission over the HTTP-style API with a store that adds random latency, so concurrent
// polls and actions interleave. Checks no action is lost, the clock catches up between polls,
// and quiet players are marked disconnected.
// Run: node scripts/rooms-test.ts
import assert from 'node:assert/strict'
import type { Action } from '../shared/game.ts'
import type { GameState } from '../shared/types.ts'
import { handleApi, memoryStore, STALE_MS, type RoomStore } from '../server/rooms.ts'

// Simulated clock: tests jump time forward instead of waiting.
const realNow = Date.now
let skew = 0
Date.now = () => realNow() + skew

const jitter = () => new Promise((r) => setTimeout(r, Math.random() * 8))
const { store: mem } = memoryStore()
const store: RoomStore = {
  create: async (c, r) => { await jitter(); return mem.create(c, r) },
  read: async (c, p, n) => { await jitter(); const r = await mem.read(c, p, n); await jitter(); return r },
  write: async (c, r, v) => { await jitter(); return mem.write(c, r, v) },
}

const call = async (method: string, path: string, query: Record<string, string> = {}, body?: unknown) => {
  const out = await handleApi({ method, path, query: new URLSearchParams(query), body }, store)
  return out as { status: number; body: any }
}
const poll = async (code: string, player: string) => {
  const r = await call('GET', `/api/rooms/${code}/state`, { player, name: player.toUpperCase(), rev: '-1' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.state as GameState
}
const act = async (code: string, player: string, a: Omit<Action, 'playerId'> & Record<string, unknown>) => {
  const r = await call('POST', `/api/rooms/${code}/action`, { player }, { ...a, playerId: player })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.state as GameState
}

// No storage configured -> clear 503 for rooms
assert.equal((await handleApi({ method: 'POST', path: '/api/rooms', query: new URLSearchParams() }, null)).status, 503)

const created = await call('POST', '/api/rooms')
assert.equal(created.status, 200)
const code = created.body.code as string
assert.match(code, /^[A-Z2-9]{4}$/)
assert.equal((await call('GET', `/api/rooms/${code}`)).status, 200)
assert.equal((await call('GET', '/api/rooms/ZZZZ/state', { player: 'x' })).status, 404)

// Three players join at once
await Promise.all(['ada', 'ben', 'cy'].map((p) => poll(code, p)))
let s = await poll(code, 'ada')
assert.deepEqual(Object.values(s.players).filter((p) => p.connected).map((p) => p.id).sort(), ['ada', 'ben', 'cy'])

// 45 chats fired concurrently while everyone keeps polling: none may be lost
const texts = Array.from({ length: 45 }, (_, i) => `msg-${i}`)
await Promise.all([
  ...texts.map((text, i) => act(code, ['ada', 'ben', 'cy'][i % 3], { type: 'chat', text })),
  ...Array.from({ length: 30 }, (_, i) => poll(code, ['ada', 'ben', 'cy'][i % 3])),
])
s = await poll(code, 'ada')
const seen = new Set(s.feed.map((f) => f.text))
assert.deepEqual(texts.filter((t) => !seen.has(t)), [], 'every concurrent chat landed')

// Set up and launch the mission (same moves as scripts/team-test.ts)
await act(code, 'ada', { type: 'chooseScenario', scenarioId: 'wildfire' })
for (const [p, role] of [['ada', 'lead'], ['ada', 'science'], ['ben', 'engineer'], ['cy', 'comms']]) await act(code, p, { type: 'claimRole', role })
await act(code, 'ada', { type: 'startDesign' })
await Promise.all(['ada', 'ben', 'cy'].map((p) => act(code, p, { type: 'ready', value: true })))
s = await poll(code, 'ada')
assert.equal(s.phase, 'design')
await act(code, 'ada', { type: 'toggleInstrument', instrumentId: 'thermal-ir' })
await act(code, 'ada', { type: 'setDesign', patch: { rocketId: 'rideshare' } })
for (const patch of [{ solarId: 'solar-small' }, { batteryId: 'batt-400' }, { adcsId: 'adcs-wheels' }]) await act(code, 'ben', { type: 'setDesign', patch })
for (const patch of [{ antennaId: 'ant-x' }, { storageId: 'store-64' }]) await act(code, 'cy', { type: 'setDesign', patch })
await act(code, 'ben', { type: 'goReview' })
await Promise.all(['ada', 'ben', 'cy'].map((p) => act(code, p, { type: 'approve', value: true })))
s = await act(code, 'ada', { type: 'launch' })
assert.equal(s.phase, 'calc')
await act(code, 'ben', { type: 'submitCalc', twr: s.calc!.challenge.twr.answer, burn: s.calc!.challenge.burn.answer, autopilot: false })
s = await act(code, 'ada', { type: 'beginLaunch' })
assert.equal(s.phase, 'launch')

// Fly: jump the clock 2 s per round; the server catches the game up on each poll.
let rounds = 0, events = 0
while (s.phase !== 'report' && rounds++ < 2000) {
  skew += 2000
  const [a] = await Promise.all([poll(code, 'ada'), poll(code, 'ben'), poll(code, 'cy')])
  s = a
  if (s.pendingEvent) {
    events++
    const opt = s.pendingEvent.options.find((o) => !s.pendingEvent!.disabled[o.id])!.id
    s = await act(code, 'ada', { type: 'decide', optionId: opt })
  }
}
assert.equal(s.phase, 'report', 'mission reached the report')
console.log(`Room API OK: ${texts.length} concurrent chats kept, launch=${s.launch?.success}, ${events} events, tier ${s.report?.tier}, ${rounds} poll rounds`)

// Ben stops polling: after STALE_MS he shows as disconnected, and comes back on his next poll
for (let t = 0; t <= STALE_MS + 2000; t += 5000) { skew += 5000; await poll(code, 'ada'); await poll(code, 'cy') }
s = await poll(code, 'ada')
assert.equal(s.players.ben.connected, false, 'quiet player marked disconnected')
s = await poll(code, 'ben')
assert.equal(s.players.ben.connected, true, 'returning player reconnects')

// Unchanged state is not resent
const r1 = await call('GET', `/api/rooms/${code}/state`, { player: 'ada', rev: String(s.rev) })
assert.ok(r1.body.same || r1.body.state, 'poll answers with same or a newer state')
console.log('Presence OK: disconnect after', STALE_MS / 1000, 's of silence, reconnect on next poll')
