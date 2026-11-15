import { ROCKETS, byId } from '../../shared/catalog.ts'
import { RocketShape } from '../art.tsx'
import { useCtx } from '../ui.tsx'
import { useClock } from './Design.tsx'

export function Launch() {
  const { state, now } = useCtx()
  useClock(200)
  const launch = state.launch!
  const rocket = byId(ROCKETS, state.design!.rocketId)
  const t = (now() - launch.at) / 1000
  let caption: React.ReactNode
  if (t < 1.6) caption = <div className="count">T−{Math.max(1, 3 - Math.floor(t / 0.55))}</div>
  else if (t < 3.2) caption = <h2>Liftoff!</h2>
  else if (!launch.success && t >= 4.2) caption = <><h2 className="bad">Launch failure</h2><p className="muted">The {rocket.name.toLowerCase()} lost control during ascent. It had a {Math.round((1 - rocket.reliability) * 100)}% chance of failure.</p></>
  else if (t < 4.8) caption = <h2>Max-Q · stage separation</h2>
  else caption = launch.success ? <><h2 className="good">Spacecraft separation confirmed</h2><p className="muted">Heading to orbit…</p></> : <h2>…</h2>

  return (
    <main className="launch-stage" aria-live="polite">
      <div className="stars" />
      <div className="launch-caption">{caption}</div>
      <div className="ground" />
      <div className="pad" />
      <svg className={`rocket ${launch.success ? 'go' : 'fail'}`} viewBox="0 0 120 300" style={{ width: 120, marginLeft: -60, bottom: 14 }} aria-label={rocket.name}>
        <RocketShape id={rocket.id} x={60} base={236} scale={rocket.id === 'small' ? 4.4 : 3.9} flame />
      </svg>
      {!launch.success && <div className="boom" />}
    </main>
  )
}
