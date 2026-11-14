import { useState } from 'react'
import { createRoom, type Session } from '../transport.ts'
import { Logo } from '../ui.tsx'

export function Home({ name, setName, onStart }: { name: string; setName: (n: string) => void; onStart: (s: Session) => void }) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needName = !name.trim()

  const create = async () => {
    setBusy(true); setError(null)
    try { onStart({ mode: 'team', code: await createRoom() }) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const join = async () => {
    const c = code.trim().toUpperCase()
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/rooms/${c}`)
      if (!r.ok) throw new Error('No room with that code. Check it with your team.')
      onStart({ mode: 'team', code: c })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="hero">
      <section>
        <div className="row" style={{ marginBottom: 24 }}><Logo size={36} /><span className="muted">NASA Space Apps 2026 · Space Mission Design Game</span></div>
        <h1>Launch <em>Window</em></h1>
        <p className="lede">
          Design a real science mission, launch it, and fly it for years. You only score for the science that
          actually reaches the ground, so every instrument has to be powered, sent home, and kept alive.
        </p>
        <div className="loop">
          <div><b>1 · Brief</b>Pick a mission and a role</div>
          <div><b>2 · Design</b>Trade mass, power, data, money</div>
          <div><b>3 · Review & launch</b>Pass the checks, light the rocket</div>
          <div><b>4 · Fly & learn</b>Survive events, read the report</div>
        </div>
      </section>
      <section className="card" aria-label="Start a game">
        <label className="stack" style={{ gap: 6 }}>
          <span className="small muted">Your name</span>
          <input type="text" value={name} maxLength={24} placeholder="e.g. Ada" onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <button className="btn primary big" disabled={needName || busy} onClick={() => onStart({ mode: 'solo' })}>Play solo</button>
        <p className="small muted" style={{ margin: 0 }}>You take all four roles. AI advisors push back like teammates would.</p>
        <div className="divider">Team of 2–4</div>
        <button className="btn big" disabled={needName || busy} onClick={create}>Create a team room</button>
        <div className="row">
          <input type="text" value={code} maxLength={4} placeholder="Room code" onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ flex: 1, fontFamily: 'var(--mono)', letterSpacing: '.15em' }} onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 4 && !needName) join() }} />
          <button className="btn" disabled={needName || busy || code.trim().length !== 4} onClick={join}>Join</button>
        </div>
        {needName && <p className="small faint" style={{ margin: 0 }}>Enter a name to start.</p>}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </section>
    </main>
  )
}
