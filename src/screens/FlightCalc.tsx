import { useState } from 'react'
import { ORBITS, byId } from '../../shared/catalog.ts'
import { evalExpr, G, type CalcChallenge, type CalcResult } from '../../shared/flightcalc.ts'
import { ownsRole } from '../../shared/game.ts'
import { scenarioOf } from '../../shared/scenarios.ts'
import { useCtx } from '../ui.tsx'

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d })
const mmss = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`

function MathInput({ label, unit, value, onChange, disabled, placeholder }: { label: string; unit?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string }) {
  const v = evalExpr(value)
  const isPlain = /^\s*-?[\d,.]+\s*$/.test(value)
  return (
    <label className="math-input">
      <span className="math-label">{label}</span>
      <span className="math-field">
        <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} aria-label={label} spellCheck={false} autoComplete="off" />
        {unit && <span className="math-unit">{unit}</span>}
      </span>
      <span className={`math-preview ${value && v === null ? 'bad' : ''}`}>
        {!value ? 'Type a number or a formula, like 7600 / (549 * 9.8)' : v === null ? "Can't read that yet" : isPlain ? ' ' : `= ${fmt(v, 3)}${unit ? ` ${unit}` : ''}`}
      </span>
    </label>
  )
}

function Given({ k, v }: { k: string; v: string }) {
  return <div className="given"><span>{k}</span><b>{v}</b></div>
}

function LiftoffArt({ twr }: { twr: CalcChallenge['twr'] }) {
  return (
    <svg viewBox="0 0 160 170" className="calc-art" aria-hidden>
      <rect x="0" y="150" width="160" height="20" fill="#0b1222" />
      <g transform="translate(80 0)">
        <path d="M-12 140 V52 Q-12 22 0 10 Q12 22 12 52 V140 Z" fill="#e9edf6" stroke="#0a0f1c" strokeWidth="2" />
        <rect x="-12" y="96" width="24" height="5" fill="#2a3450" />
        <path d="M-12 128 l-10 14 h10z M12 128 l10 14 h-10z" fill="#f5b544" stroke="#0a0f1c" strokeWidth="1.5" />
        <path d="M-7 141 q7 22 14 0z" fill="#ffb347" />
      </g>
      <g stroke="#3ccf9e" strokeWidth="4" fill="#3ccf9e"><line x1="128" y1="120" x2="128" y2="40" /><path d="M120 46 l8 -14 l8 14z" /></g>
      <text x="128" y="26" textAnchor="middle" fill="#3ccf9e" fontSize="11" fontFamily="Oxanium">THRUST</text>
      <g stroke="#ff6b5a" strokeWidth="4" fill="#ff6b5a"><line x1="30" y1="50" x2="30" y2="128" /><path d="M22 122 l8 14 l8 -14z" /></g>
      <text x="30" y="146" textAnchor="middle" fill="#ff6b5a" fontSize="11" fontFamily="Oxanium">WEIGHT</text>
      <text x="80" y="166" textAnchor="middle" fill="#8fa3c7" fontSize="10" fontFamily="Oxanium">{fmt(twr.rocketT + twr.craftT, 1)} t on the pad</text>
    </svg>
  )
}

/** Orbit result: target orbit (dashed) vs. the orbit the burn actually produced. */
export function OrbitResult({ ratio, capture, moon, grade }: { ratio: number; capture: boolean; moon: boolean; grade: CalcResult['grade'] | null }) {
  const cx = 200, cy = 170, R = 58, R0 = 108
  // Ascent: too short -> low perigee; too long -> high apogee. Capture (braking) is the reverse.
  const eff = capture ? 2 - ratio : ratio
  let ra = R0, rp = R0
  if (grade && grade !== 'autopilot') {
    if (eff < 1) rp = Math.max(R * 0.6, R0 * (1 - Math.min(0.85, (1 - eff) * 3)))
    else ra = R0 * (1 + Math.min(1.1, (eff - 1) * 3))
  }
  if (grade === 'autopilot') rp = R0 * 0.97
  // burn point on the right; ellipse focus at the planet centre
  const burnRight = eff < 1 ? ra : rp
  const other = eff < 1 ? rp : ra
  const rx = (burnRight + other) / 2
  const ex = cx + burnRight - rx
  const ry = Math.sqrt(burnRight * other)
  const path = `M${ex + rx} ${cy} A${rx} ${ry} 0 1 0 ${ex - rx} ${cy} A${rx} ${ry} 0 1 0 ${ex + rx} ${cy}`
  const lowest = Math.min(burnRight, other)
  const danger = lowest < R + (moon ? 4 : 14)
  const tone = !grade ? '#5ce1ff' : grade === 'bullseye' || grade === 'good' || grade === 'autopilot' ? '#3ccf9e' : grade === 'off' ? '#ffb547' : '#ff6b5a'
  return (
    <svg viewBox="0 0 400 340" className="orbit-result" role="img" aria-label="Orbit result diagram">
      <defs>
        <radialGradient id="or-planet" cx="35%" cy="35%" r="75%"><stop offset="0" stopColor={moon ? '#c9cfdc' : '#5b95f0'} /><stop offset="1" stopColor={moon ? '#5d6577' : '#173d8a'} /></radialGradient>
      </defs>
      {!moon && <circle cx={cx} cy={cy} r={R + 14} fill="#5aa2ff" opacity=".12" />}
      <circle cx={cx} cy={cy} r={R} fill="url(#or-planet)" stroke="#0a0f1c" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={R0} fill="none" stroke="#3ccf9e" strokeWidth="2" strokeDasharray="6 6" opacity=".7" />
      <text x={cx} y={cy - R0 - 8} textAnchor="middle" fill="#3ccf9e" fontSize="11" fontFamily="Oxanium" letterSpacing="1">TARGET ORBIT</text>
      {grade && (
        <>
          <path d={path} fill="none" stroke={tone} strokeWidth="3" className="draw-orbit" style={{ filter: `drop-shadow(0 0 6px ${tone})` }} />
          <circle r="7" fill="#f5b544" stroke="#0a0f1c" strokeWidth="2"><animateMotion dur="5s" repeatCount="indefinite" path={path} /></circle>
          {danger && <text x={cx} y={cy + R + 26} textAnchor="middle" fill="#ff6b5a" fontSize="12" fontFamily="Oxanium">{moon ? 'TOO CLOSE TO THE SURFACE' : 'DIPS INTO THE ATMOSPHERE'}</text>}
        </>
      )}
      <g transform={`translate(${cx + (grade ? burnRight : R0)} ${cy})`}>
        <circle r="12" fill="none" stroke="#f5b544" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="16" y="4" fill="#f5b544" fontSize="10" fontFamily="Oxanium">BURN</text>
      </g>
    </svg>
  )
}

export function FlightCalc() {
  const { state, dispatch, me } = useCtx()
  const sc = scenarioOf(state)
  const calc = state.calc!
  const ch = calc.challenge
  const res = calc.result
  const moon = byId(ORBITS, state.design!.orbitId).dest === 'moon'
  const capture = ch.burn.kind === 'capture'
  const [twr, setTwr] = useState('')
  const [burn, setBurn] = useState('')
  const [hint1, setHint1] = useState(false)
  const [hint2, setHint2] = useState(false)
  const twrV = evalExpr(twr)
  const burnV = evalExpr(burn)
  const canLaunch = state.mode === 'solo' || ownsRole(state, me, 'lead')
  const submit = (autopilot: boolean) => dispatch({ type: 'submitCalc', twr: twrV, burn: autopilot ? null : burnV, autopilot })

  return (
    <main className="page flightplan">
      <div className="row wrap" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: 24 }}>Flight plan · {sc.name}</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>Program the flight computer before liftoff. Use your own numbers: the better your math, the better your orbit.</p>
        </div>
        {!res && <span className="chip mono">Up to 80 bonus points</span>}
      </div>

      <div className="flightplan-grid">
        <section className="stack">
          {/* ---- Problem 1 ---- */}
          <div className="panel calc-card">
            <h3>1 · Liftoff check</h3>
            <div className="calc-body">
              <LiftoffArt twr={ch.twr} />
              <div className="calc-text">
                <p>Can the {ch.twr.rocket.toLowerCase()} lift your spacecraft? Its engines must push harder than gravity pulls. Engineers call this the <b>thrust-to-weight ratio</b> (TWR).</p>
                <div className="givens">
                  <Given k="Engine thrust" v={`${fmt(ch.twr.thrustKN, 0)} kN`} />
                  <Given k="Rocket mass" v={`${fmt(ch.twr.rocketT, 0)} t`} />
                  <Given k="Your spacecraft" v={`${fmt(ch.twr.craftT, 3)} t`} />
                  <Given k="Gravity, g" v={`${G} kN per t`} />
                </div>
                <div className="formula">TWR = thrust ÷ ((rocket + spacecraft) × g)</div>
                <MathInput label="Your TWR" value={twr} onChange={setTwr} disabled={!!res} placeholder="e.g. 1.5" />
                <button className="link-btn" onClick={() => setHint1(!hint1)}>{hint1 ? 'Hide hint' : 'Need a hint?'}</button>
                {hint1 && <p className="hint-box">First add the masses: {fmt(ch.twr.rocketT, 0)} + {fmt(ch.twr.craftT, 3)} tonnes. Multiply by {G} to get the weight in kN. Then divide the thrust by that weight. A TWR above 1 means the rocket rises.</p>}
              </div>
            </div>
          </div>

          {/* ---- Problem 2 ---- */}
          <div className="panel calc-card">
            <h3>2 · {capture ? 'Lunar braking burn' : 'Orbit insertion burn'}</h3>
            <div className="calc-text">
              {ch.burn.kind === 'ascent' ? (
                <>
                  <p>The upper stage must speed you up to {ch.burn.to}. Too short a burn and you fall back toward the atmosphere; too long and you overshoot. <b>How many seconds should the engine burn?</b></p>
                  <div className="speedbar" aria-hidden style={{ '--now': `${(ch.burn.v0 / ch.burn.target) * 100}%` } as React.CSSProperties}>
                    <span style={{ left: 0 }}>{fmt(ch.burn.v0, 0)} m/s now</span>
                    <i style={{ left: `${(ch.burn.v0 / ch.burn.target) * 100}%` }} />
                    <span style={{ right: 0 }}>{fmt(ch.burn.target, 0)} m/s needed</span>
                  </div>
                  <div className="givens">
                    <Given k="Speed now" v={`${fmt(ch.burn.v0, 0)} m/s`} />
                    <Given k="Orbit speed" v={`${fmt(ch.burn.target, 0)} m/s`} />
                    <Given k="Engine acceleration" v={`${ch.burn.accel} m/s²`} />
                  </div>
                  <div className="formula">speed change = orbit speed − speed now<br />burn time = speed change ÷ acceleration</div>
                </>
              ) : (
                <>
                  <p>The rocket sent you to the Moon, but you arrive too fast to stay. Your own engine must brake. <b>How many seconds should it burn?</b> Heavier spacecraft brake more slowly.</p>
                  <div className="givens">
                    <Given k="Speed to lose" v={`${fmt(ch.burn.dv, 0)} m/s`} />
                    <Given k="Engine thrust" v={`${fmt(ch.burn.thrustN, 0)} N`} />
                    <Given k="Your spacecraft" v={`${fmt(ch.burn.massKg, 0)} kg`} />
                  </div>
                  <div className="formula">acceleration = thrust ÷ mass (Newton's 2nd law)<br />burn time = speed to lose ÷ acceleration</div>
                </>
              )}
              <MathInput label="Burn time" unit="s" value={burn} onChange={setBurn} disabled={!!res} placeholder="seconds" />
              {burnV !== null && burnV > 0 && !res && <p className="small muted" style={{ margin: '-4px 0 6px' }}>That's {mmss(burnV)}.</p>}
              <button className="link-btn" onClick={() => setHint2(!hint2)}>{hint2 ? 'Hide hint' : 'Need a hint?'}</button>
              {hint2 && (
                <p className="hint-box">
                  {ch.burn.kind === 'ascent'
                    ? `Subtract: ${fmt(ch.burn.target, 0)} − ${fmt(ch.burn.v0, 0)} gives the speed you still need. Each second the engine adds ${ch.burn.accel} m/s, so divide by ${ch.burn.accel}.`
                    : `Acceleration first: ${fmt(ch.burn.thrustN, 0)} N ÷ ${fmt(ch.burn.massKg, 0)} kg is how many m/s you lose each second. Then divide ${fmt(ch.burn.dv, 0)} m/s by that.`}
                </p>
              )}
            </div>
          </div>

          {!res && (
            <div className="row wrap">
              <button className="btn primary big" disabled={burnV === null || burnV <= 0} onClick={() => submit(false)}>Run the burn →</button>
              {sc.level?.autopilot !== false
                ? <button className="btn ghost" onClick={() => submit(true)}>Use autopilot (no math points)</button>
                : <span className="small warn">Flight Director: no autopilot, and the accuracy bands are tighter.</span>}
              {state.mode === 'team' && <span className="small muted">Work it out together. Any player can run the burn, and it can't be undone.</span>}
            </div>
          )}
        </section>

        <aside className="stack">
          <div className="panel">
            <h3>{res ? 'Burn result' : 'Target orbit'}</h3>
            <OrbitResult ratio={res?.ratio ?? 1} capture={capture} moon={moon} grade={res?.grade ?? null} />
            {!res ? (
              <ul className="calc-why">
                <li><b className="good">Bullseye</b> (within 3%): fuel saved, 60 points.</li>
                <li><b className="good">Good</b> (within 10%): small fix, 40 points.</li>
                <li><b className="warn">Off</b> (within 25%): costs fuel, or lifetime, or sharp images.</li>
                <li><b className="bad">Way off</b>: big fuel cost or a much shorter mission.</li>
                <li>Correct liftoff check: +20 points.</li>
              </ul>
            ) : (
              <ResultPanel res={res} ch={ch} />
            )}
          </div>
          {res && (
            canLaunch
              ? <button className="btn primary big" onClick={() => dispatch({ type: 'beginLaunch' })}>🚀 Launch!</button>
              : <p className="small muted">Waiting for the Mission Lead to launch.</p>
          )}
        </aside>
      </div>
    </main>
  )
}

function ResultPanel({ res, ch }: { res: CalcResult; ch: CalcChallenge }) {
  const label = { bullseye: 'Bullseye', good: 'Good burn', off: 'Off target', wayoff: 'Way off', autopilot: 'Autopilot' }[res.grade]
  return (
    <div className="calc-result">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`grade grade-${res.grade}`}>{label}</span>
        <span className="calc-points">+{res.points} pts</span>
      </div>
      <p style={{ margin: '10px 0 4px' }}>{res.verdict}</p>
      <p className="small warn" style={{ margin: 0 }}>{res.effect}</p>
      <div className="calc-compare">
        <div><span>Liftoff check</span><b className={res.twrOk ? 'good' : 'bad'}>{res.twrAnswer === null ? 'skipped' : fmt(res.twrAnswer, 3)} {res.twrOk ? '✓' : '✕'}</b><small>correct: {fmt(ch.twr.answer, 2)}</small></div>
        <div><span>Burn time</span><b>{res.burnAnswer === null ? 'autopilot' : `${fmt(res.burnAnswer, 1)} s`}</b><small>perfect: {fmt(ch.burn.answer, 0)} s</small></div>
      </div>
      <details className="worked">
        <summary>Show the worked solution</summary>
        <p>TWR = {fmt(ch.twr.thrustKN, 0)} ÷ (({fmt(ch.twr.rocketT, 0)} + {fmt(ch.twr.craftT, 3)}) × {G}) = <b>{fmt(ch.twr.answer, 2)}</b>. Above 1, so it lifts off.</p>
        {ch.burn.kind === 'ascent'
          ? <p>Speed change = {fmt(ch.burn.target, 0)} − {fmt(ch.burn.v0, 0)} = {fmt(ch.burn.dv, 0)} m/s. Burn time = {fmt(ch.burn.dv, 0)} ÷ {ch.burn.accel} = <b>{fmt(ch.burn.answer, 0)} s</b>.</p>
          : <p>Acceleration = {fmt(ch.burn.thrustN, 0)} ÷ {fmt(ch.burn.massKg, 0)} = {fmt(ch.burn.accel, 3)} m/s². Burn time = {fmt(ch.burn.dv, 0)} ÷ {fmt(ch.burn.accel, 3)} = <b>{fmt(ch.burn.answer, 0)} s</b> ({mmss(ch.burn.answer)}).</p>}
      </details>
      {res.by && <p className="tiny faint" style={{ margin: '8px 0 0' }}>Programmed by {res.by}.</p>}
    </div>
  )
}
