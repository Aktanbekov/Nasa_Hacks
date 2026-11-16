import { useState } from 'react'
import { api } from '../api.ts'
import { createRoom, type Session } from '../transport.ts'
import { Logo } from '../ui.tsx'

export function Home({ name, setName, onStart, onSources }: { name: string; setName: (n: string) => void; onStart: (s: Session) => void; onSources: () => void }) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needName = !name.trim()

  const create = async () => {
    setBusy(true); setError(null)
    try { onStart({ mode: 'team', code: await createRoom() }) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const join = () => joinCode(code)
  const joinCode = async (raw: string) => {
    const c = raw.trim().toUpperCase()
    setBusy(true); setError(null)
    try {
      const r = await fetch(api(`/api/rooms/${c}`)).catch(() => { throw new Error('Could not reach the room server. Try again in a minute.') })
      if (!r.ok) throw new Error('No room with that code. Check it with your team.')
      onStart({ mode: 'team', code: c })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const invited = new URLSearchParams(location.search).get('room')?.toUpperCase()
  if (invited) {
    return (
      <main className="invited">
        <div className="invited-card rise">
          <Logo size={44} />
          <div className="brief-kicker" style={{ marginTop: 14 }}>You're invited to a mission</div>
          <h1>Join team <span className="code" style={{ fontSize: 'inherit' }}>{invited}</span></h1>
          <p className="muted">Launch Window: design, launch and fly a real science mission together. Enter your name to join.</p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (!needName) { setCode(invited); void joinCode(invited) } }}>
            <input type="text" value={name} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} autoFocus aria-label="Your name" style={{ fontSize: 18, padding: '12px 14px' }} />
            <button className="btn primary big" disabled={needName || busy}>{busy ? 'Joining…' : `Join team ${invited} →`}</button>
          </form>
          {error && <p className="error">{error}</p>}
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => { history.replaceState(null, '', location.pathname); setCode(''); location.reload() }}>Not now, go to the home screen</button>
        </div>
      </main>
    )
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
        <button className="link-btn" style={{ marginTop: 16 }} onClick={onSources}>Science & sources: real NASA data and where every number comes from →</button>
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
