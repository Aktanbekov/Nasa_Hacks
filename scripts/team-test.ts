// Headless check of team rules: role ownership, approvals, event voting.
// Run: node scripts/team-test.ts
import assert from 'node:assert/strict'
import { createGame, reduce, tick } from '../shared/game.ts'

let now = 0
const s = createGame('TEST', 'team', now)
const act = (a: Parameters<typeof reduce>[1]) => reduce(s, a, now)
act({ type: 'join', playerId: 'ada', name: 'Ada' })
act({ type: 'join', playerId: 'ben', name: 'Ben' })
act({ type: 'join', playerId: 'cy', name: 'Cy' })
act({ type: 'chooseScenario', playerId: 'ada', scenarioId: 'wildfire' })
act({ type: 'startDesign', playerId: 'ada' })
assert.equal(s.phase, 'lobby', 'cannot start with open roles')
act({ type: 'claimRole', playerId: 'ada', role: 'lead' })
act({ type: 'claimRole', playerId: 'ada', role: 'science' })
act({ type: 'claimRole', playerId: 'ben', role: 'engineer' })
act({ type: 'claimRole', playerId: 'cy', role: 'comms' })
act({ type: 'startDesign', playerId: 'ada' })
assert.equal(s.phase, 'briefing', 'story briefing comes first')
act({ type: 'ready', playerId: 'ada', value: true })
act({ type: 'ready', playerId: 'ben', value: true })
assert.equal(s.phase, 'briefing', 'waits for every player to finish the story')
act({ type: 'ready', playerId: 'cy', value: true })
assert.equal(s.phase, 'design')

// Ben can't touch instruments; Ada can.
act({ type: 'toggleInstrument', playerId: 'ben', instrumentId: 'thermal-ir' })
assert.deepEqual(s.design!.instruments, [])
act({ type: 'toggleInstrument', playerId: 'ada', instrumentId: 'thermal-ir' })
act({ type: 'toggleInstrument', playerId: 'ada', instrumentId: 'visible-cam' })
act({ type: 'setDesign', playerId: 'ada', patch: { rocketId: 'rideshare' } })
act({ type: 'setDesign', playerId: 'ada', patch: { solarId: 'solar-large' } })
assert.equal(s.design!.solarId, 'solar-body', 'lead cannot change engineer parts')
act({ type: 'setDesign', playerId: 'ben', patch: { solarId: 'solar-small' } })
act({ type: 'setDesign', playerId: 'ben', patch: { batteryId: 'batt-400' } })
act({ type: 'setDesign', playerId: 'ben', patch: { adcsId: 'adcs-wheels' } })
act({ type: 'setDesign', playerId: 'cy', patch: { antennaId: 'ant-x' } })
act({ type: 'setDesign', playerId: 'cy', patch: { storageId: 'store-64' } })

act({ type: 'goReview', playerId: 'ben' })
act({ type: 'launch', playerId: 'ada' })
assert.equal(s.phase, 'review', 'launch needs all approvals')
act({ type: 'approve', playerId: 'ada', value: true })
act({ type: 'approve', playerId: 'ben', value: true })
act({ type: 'approve', playerId: 'cy', value: true })
act({ type: 'launch', playerId: 'ben' })
assert.equal(s.phase, 'review', 'only the lead launches')
s.seed = 7 // a seed where the rideshare launch succeeds
act({ type: 'launch', playerId: 'ada' })
assert.equal(s.phase, 'calc', 'flight plan comes before liftoff')
const ch = s.calc!.challenge
act({ type: 'beginLaunch', playerId: 'ada' })
assert.equal(s.phase, 'calc', 'cannot launch before the burn is programmed')
// Ben solves it with a formula string evaluated on his side, exactly right
act({ type: 'submitCalc', playerId: 'ben', twr: ch.twr.answer, burn: ch.burn.answer, autopilot: false })
assert.equal(s.calc!.result!.grade, 'bullseye')
assert.equal(s.calc!.result!.points, 80)
act({ type: 'beginLaunch', playerId: 'ben' })
assert.equal(s.phase, 'calc', 'only the lead launches')
act({ type: 'beginLaunch', playerId: 'ada' })
assert.equal(s.phase, 'launch')

let events = 0
while (s.phase !== 'report' && now < 1e7) {
  now += 500
  tick(s, now, 500)
  if (s.pendingEvent) {
    events++
    const opts = s.pendingEvent.options.filter((o) => !s.pendingEvent!.disabled[o.id]).map((o) => o.id)
    if (events === 1) {
      // 2-1 majority, decided when the last vote lands
      act({ type: 'vote', playerId: 'ben', optionId: opts[1] ?? opts[0] })
      act({ type: 'vote', playerId: 'cy', optionId: opts[1] ?? opts[0] })
      assert.ok(s.pendingEvent, 'waits for everyone')
      act({ type: 'vote', playerId: 'ada', optionId: opts[0] })
      assert.equal(s.pendingEvent, null)
      assert.equal(s.sim!.decisions.at(-1)!.optionId, opts[1] ?? opts[0])
    } else {
      // Lead makes the final call early
      act({ type: 'vote', playerId: 'ben', optionId: opts[1] ?? opts[0] })
      act({ type: 'decide', playerId: 'ada', optionId: opts[0] })
      assert.equal(s.pendingEvent, null)
      assert.equal(s.sim!.decisions.at(-1)!.optionId, opts[0])
    }
  }
}
assert.equal(s.phase, 'report')
console.log(`Team flow OK: launch=${s.launch?.success}, ${events} events, tier ${s.report!.tier}, score ${s.report!.score}`)
console.log(s.report!.breakdown.map((b) => `${b.label}: ${b.points} (${b.detail})`).join('\n'))
// JSON round-trip (what the server sends) must not lose anything important.
const copy = JSON.parse(JSON.stringify(s))
assert.equal(copy.report.score, s.report!.score)

// ---- Difficulty: Flight Director rules
{
  let now2 = 0
  const g = createGame('LVL', 'solo', now2)
  const b = (a: Parameters<typeof reduce>[1]) => reduce(g, a, now2)
  b({ type: 'join', playerId: 'p', name: 'P' })
  b({ type: 'setDifficulty', playerId: 'p', difficulty: 'director' } as never)
  b({ type: 'chooseScenario', playerId: 'p', scenarioId: 'wildfire' })
  b({ type: 'startDesign', playerId: 'p' })
  b({ type: 'ready', playerId: 'p', value: true })
  assert.equal(g.difficulty, 'director')
  b({ type: 'setDesign', playerId: 'p', patch: { growth: { mass: 0, power: 0, cost: 0 } } as never })
  assert.equal(g.design!.growth, undefined, 'players cannot set growth')
  b({ type: 'goReview', playerId: 'p' })
  const gr = g.design!.growth!
  assert.ok(gr.mass >= 0.1 && gr.mass <= 0.25, 'Director growth 10-25%')
  b({ type: 'backToDesign', playerId: 'p' })
  b({ type: 'goReview', playerId: 'p' })
  assert.deepEqual(g.design!.growth, gr, 'growth is rolled once per design')
  console.log(`Director rules OK: growth mass +${Math.round(gr.mass * 100)}%`)
}
