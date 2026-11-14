import { ROCKETS, byId } from '../../shared/catalog.ts'
import { useCtx } from '../ui.tsx'
import { useClock } from './Design.tsx'

export function Launch() {
  const { state, now } = useCtx()
  useClock(200)
  const launch = state.launch!
  const rocket = byId(ROCKETS, state.design!.rocketId)
  const t = (now() - launch.at) / 1000
  const big = rocket.id === 'heavy' ? 1.25 : rocket.id === 'medium' ? 1.1 : rocket.id === 'rideshare' ? 1.15 : 0.9
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
      <svg className={`rocket ${launch.success ? 'go' : 'fail'}`} viewBox="0 0 60 220" style={{ width: 60 * big, marginLeft: -30 * big }} aria-label={rocket.name}>
        <path d="M30 4c10 12 14 30 14 52v120H16V56C16 34 20 16 30 4z" fill="#e9edf6" />
        <rect x="16" y="96" width="28" height="6" fill="#0a0f1c" opacity=".35" />
        <circle cx="30" cy="60" r="5" fill="#18233d" />
        <path d="M16 150l-12 26v10l12-6zM44 150l12 26v10l-12-6z" fill="#f5b544" />
        <rect x="20" y="176" width="20" height="8" fill="#66739a" />
        <g className="flame"><path d="M20 184c0 14 4 26 10 34 6-8 10-20 10-34z" fill="#ffb347" /><path d="M25 184c0 9 2 16 5 22 3-6 5-13 5-22z" fill="#fff3c4" /></g>
      </svg>
      {!launch.success && <div className="boom" />}
    </main>
  )
}
