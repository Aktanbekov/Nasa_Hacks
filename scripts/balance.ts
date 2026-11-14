// Balance check: fly reference designs through the real simulation and print reports.
// Run: npm run balance
import { computeMetrics, canLaunch } from '../shared/calc.ts'
import { createGame, reduce, tick } from '../shared/game.ts'
import { getScenario } from '../shared/scenarios.ts'
import type { Design } from '../shared/types.ts'

const designs: { scenario: string; name: string; d: Partial<Design> }[] = [
  { scenario: 'wildfire', name: 'Cheap smallsat (thermal + visible, rideshare)', d: { rocketId: 'rideshare', instruments: ['thermal-ir', 'visible-cam'], solarId: 'solar-small', batteryId: 'batt-400', adcsId: 'adcs-wheels', antennaId: 'ant-x', storageId: 'store-64' } },
  { scenario: 'wildfire', name: 'Thin margins (S-band, tiny recorder)', d: { rocketId: 'rideshare', instruments: ['thermal-ir'], solarId: 'solar-small', batteryId: 'batt-150', adcsId: 'adcs-wheels', antennaId: 'ant-s', groundId: 'gs-nsn', storageId: 'store-16' } },
  { scenario: 'wildfire', name: 'Two-sat constellation', d: { rocketId: 'rideshare', satellites: 2, instruments: ['thermal-ir', 'visible-cam'], solarId: 'solar-small', batteryId: 'batt-400', adcsId: 'adcs-wheels', antennaId: 'ant-x', storageId: 'store-64' } },
  { scenario: 'wildfire', name: 'Big medium-bus (4 instruments)', d: { rocketId: 'small', busId: 'bus-medium', instruments: ['thermal-ir', 'visible-cam', 'sounder', 'swir'], solarId: 'solar-large', batteryId: 'batt-400', adcsId: 'adcs-wheels', antennaId: 'ant-x', groundId: 'gs-commercial', storageId: 'store-256', redundancy: true } },
  { scenario: 'wildfire', name: 'LEO-400 no propulsion', d: { orbitId: 'leo-400', satellites: 2, instruments: ['thermal-ir', 'visible-cam'], solarId: 'solar-small', batteryId: 'batt-400', adcsId: 'adcs-wheels', antennaId: 'ant-x', storageId: 'store-64' } },
  { scenario: 'wildfire', name: 'GEO watcher', d: { orbitId: 'geo', rocketId: 'medium', busId: 'bus-medium', instruments: ['thermal-ir', 'visible-cam', 'sounder'], solarId: 'solar-small', batteryId: 'batt-400', adcsId: 'adcs-wheels', propulsionId: 'prop-mono', antennaId: 'ant-x', storageId: 'store-64' } },
  { scenario: 'lunar-ice', name: 'Lunar Trailblazer-like', d: { instruments: ['neutron', 'ir-spec'], propulsionId: 'prop-biprop', antennaId: 'ant-ka', solarId: 'solar-small', batteryId: 'batt-400', storageId: 'store-256' } },
  { scenario: 'lunar-ice', name: 'LRO-lite low orbit', d: { orbitId: 'moon-50', busId: 'bus-medium', instruments: ['neutron', 'ir-spec', 'radiometer', 'laser-alt'], propulsionId: 'prop-biprop', antennaId: 'ant-ka', solarId: 'solar-large', batteryId: 'batt-1000', adcsId: 'adcs-star', storageId: 'store-256', redundancy: true } },
  { scenario: 'lunar-ice', name: 'Frozen orbit, X-band', d: { orbitId: 'moon-frozen', instruments: ['neutron', 'uv-spec', 'radiometer'], propulsionId: 'prop-biprop', antennaId: 'ant-x', solarId: 'solar-small', batteryId: 'batt-400', storageId: 'store-256' } },
]

for (const [k, t] of designs.entries()) {
  const sc = getScenario(t.scenario)
  const design = { ...sc.starter, ...t.d }
  const m = computeMetrics(design, sc)
  console.log(`\n=== ${sc.name}: ${t.name}`)
  console.log(`  cost $${m.costM.toFixed(1)}M/${sc.budgetM}  mass ${m.launchMassKg.toFixed(0)}/${m.rocketCapacityKg} kg  power ${m.powerMarginW.toFixed(0)} W (EOL ${m.powerMarginEolW.toFixed(0)})  DoD ${(m.depthOfDischarge * 100).toFixed(0)}%  data ${m.dataGBPerDay.toFixed(1)}/${m.downlinkGBPerDay.toFixed(1)} GB/d  life ${m.lifetimeYears.toFixed(1)}y`)
  for (const c of m.checks) if (c.status !== 'pass') console.log(`  [${c.status}${c.blocking ? '!' : ''}] ${c.label}: ${c.detail}`)
  if (!canLaunch(m)) { console.log('  -> cannot launch'); continue }
  for (let seedTry = 0; seedTry < 3; seedTry++) {
    let now = 0
    const s = createGame('TEST', 'solo', now)
    s.seed = 1000 + k * 7 + seedTry * 13
    reduce(s, { type: 'join', playerId: 'p', name: 'Tester' }, now)
    reduce(s, { type: 'chooseScenario', playerId: 'p', scenarioId: sc.id }, now)
    reduce(s, { type: 'startDesign', playerId: 'p' }, now)
    s.design = design
    reduce(s, { type: 'goReview', playerId: 'p' }, now)
    reduce(s, { type: 'launch', playerId: 'p' }, now)
    let guard = 0
    while (s.phase !== 'report' && guard++ < 100000) {
      now += 1000
      tick(s, now, 1000)
      if (s.pendingEvent) {
        const opt = s.pendingEvent.options.find((o) => !s.pendingEvent!.disabled[o.id])!
        reduce(s, { type: 'decide', playerId: 'p', optionId: opt.id }, now)
      }
    }
    const r = s.report!
    console.log(`  seed ${s.seed}: ${r.tier} ${r.score} pts | ${r.breakdown.map((b) => `${b.label.split(' ')[0]} ${b.points}`).join(', ')} | ${r.objectives.map((o) => (o.met ? '✓' : '✗') + o.id).join(' ')}`)
    if (seedTry === 0) {
      for (const w of r.why) console.log(`    ${w.tone === 'good' ? '+' : w.tone === 'bad' ? '-' : '·'} ${w.text}`)
      console.log(`    match: ${r.matches.map((x) => x.name).join(', ')} | events: ${s.sim?.decisions.map((d) => d.templateId + ':' + d.optionId).join(', ')}`)
    }
  }
}
