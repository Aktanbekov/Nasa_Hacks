import { useCallback, useEffect, useState } from 'react'
import { fmtM } from '../../shared/calc.ts'
import { activePlayers, ROLE_NAMES } from '../../shared/game.ts'
import { getScenario } from '../../shared/scenarios.ts'
import { ROLES, type Role } from '../../shared/types.ts'
import { CHARACTERS, STORIES, type SceneId } from '../story.ts'
import { useLiveFires } from '../live.ts'
import { Portrait, StoryScene } from '../storyArt.tsx'
import { Avatar, ROLE_COLOR, useCtx } from '../ui.tsx'

const ROLE_JOB: Record<Role, { does: string; wants: string }> = {
  lead: { does: 'Pick the orbit, the rocket and how many satellites. Give the final "go" for launch.', wants: 'Stay under budget and launch on time.' },
  science: { does: 'Choose the instruments that answer the mission\'s questions.', wants: 'As much science as possible.' },
  engineer: { does: 'Build the spacecraft: frame, solar arrays, battery, pointing and thrusters.', wants: 'Low mass and positive power.' },
  comms: { does: 'Get the data home: antenna, ground stations and the onboard recorder.', wants: 'Enough downlink for every bit of data.' },
}

function useTypewriter(text: string, cps = 48) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return }
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 1000 / cps)
    return () => clearInterval(id)
  }, [text, cps])
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) }
}

export function Briefing() {
  const { state } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const slides = STORIES[sc.id] ?? [{ kind: 'goal' as const }, { kind: 'howto' as const }]
  const [i, setI] = useState(0)
  const slide = slides[i]
  const lastArt = [...slides.slice(0, i + 1)].reverse().find((s) => s.kind === 'scene') as { art: SceneId } | undefined
  const firstInfo = slides.findIndex((s) => s.kind !== 'scene')

  const next = useCallback(() => setI((v) => Math.min(slides.length - 1, v + 1)), [slides.length])
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), [])

  return (
    <main className="briefing">
      <div className="story-bg" key={lastArt?.art ?? 'none'}>
        {lastArt && <StoryScene id={lastArt.art} />}
      </div>
      {slide.kind !== 'scene' && <div className="story-dim" />}
      <div className="story-top">
        <span className="chip mono">Mission briefing · {sc.name}</span>
        <div className="dots" aria-label={`Part ${i + 1} of ${slides.length}`}>
          {slides.map((_, k) => <button key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} onClick={() => setI(k)} aria-label={`Go to part ${k + 1}`} />)}
        </div>
        {i < firstInfo && <button className="btn ghost sm" onClick={() => setI(firstInfo)}>Skip story →</button>}
      </div>
      {slide.kind === 'scene' && <SceneCaption key={i} chapter={slide.chapter} speaker={slide.speaker} text={slide.text} onNext={next} onBack={i > 0 ? back : undefined} />}
      {slide.kind === 'goal' && <GoalCard onNext={next} onBack={back} />}
      {slide.kind === 'howto' && <HowTo onBack={back} />}
    </main>
  )
}

function SceneCaption({ chapter, speaker, text, onNext, onBack }: { chapter: string; speaker?: keyof typeof CHARACTERS; text: string; onNext: () => void; onBack?: () => void }) {
  const tw = useTypewriter(text)
  const advance = useCallback(() => (tw.done ? onNext() : tw.finish()), [tw, onNext])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
      if (e.key === 'ArrowLeft' && onBack) onBack()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [advance, onBack])
  const who = speaker ? CHARACTERS[speaker] : null
  return (
    <>
      <h2 className="chapter" key={chapter}>{chapter}</h2>
      <div className="dialog" onClick={advance} role="button" tabIndex={0} aria-label="Continue">
        {who && <Portrait id={who.id} />}
        <div className="dialog-body">
          {who ? <div className="speaker" style={{ color: who.color }}>{who.name} <span>{who.title}</span></div> : <div className="speaker narrator">Narrator</div>}
          <p aria-live="polite">{tw.shown}<span className={`caret ${tw.done ? 'idle' : ''}`} /></p>
        </div>
      </div>
      <div className="story-nav">
        {onBack && <button className="btn ghost" onClick={onBack}>← Back</button>}
        <span className="spacer" />
        <span className="faint small hint">Click or press Space</span>
        <button className="btn primary" onClick={advance}>{tw.done ? 'Next →' : 'Show all'}</button>
      </div>
    </>
  )
}

function GoalCard({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const must = sc.objectives.filter((o) => o.kind === 'primary')
  const bonus = sc.objectives.filter((o) => o.kind === 'bonus')
  return (
    <section className="brief-card rise">
      <div className="brief-kicker">Your mission</div>
      <h1>{sc.name}</h1>
      <p className="brief-lede">{sc.objective}</p>
      {sc.id === 'wildfire' && <LiveFireNote />}
      <div className="brief-facts">
        <div><b>{fmtM(sc.budgetM)}</b><span>total budget</span></div>
        <div><b>{sc.lifetimeYears} years</b><span>in operation</span></div>
        <div><b>{state.relaxed ? 'No timer' : `${sc.designMinutes} min`}</b><span>to design</span></div>
        <div><b className={`diff-${sc.difficulty}`}>{sc.difficulty}</b><span>difficulty</span></div>
      </div>
      <div className="brief-cols">
        <div>
          <h3>Must achieve</h3>
          {must.map((o) => <div key={o.id} className="brief-goal must"><span>★</span><div><b>{o.name}</b><small>{o.blurb}</small></div></div>)}
        </div>
        <div>
          <h3>Bonus goals</h3>
          {bonus.map((o) => <div key={o.id} className="brief-goal"><span>+</span><div><b>{o.name}</b><small>{o.blurb}</small></div></div>)}
        </div>
      </div>
      <div className="brief-tiers">
        <span><i className="t-fail" />Miss every must-have: <b>Failure</b></span>
        <span><i className="t-part" />Some must-haves: <b>Partial</b></span>
        <span><i className="t-succ" />All must-haves: <b>Success</b></span>
        <span><i className="t-exc" />Plus 2 bonus goals: <b>Exceeded</b></span>
      </div>
      <div className="story-nav inline">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <span className="spacer" />
        <button className="btn primary" onClick={onNext}>How to play →</button>
      </div>
    </section>
  )
}

function HowTo({ onBack }: { onBack: () => void }) {
  const { state, dispatch, me } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const team = state.mode === 'team'
  const players = activePlayers(state)
  const myRoles = team ? (state.players[me]?.roles ?? []) : ROLES
  const imReady = !!state.ready[me]
  const steps = [
    { n: 1, t: 'Design', d: `Each role picks parts at their own station. Every choice changes mass, power, cost and data, and the shared dashboard shows the effect live.${state.relaxed ? '' : ` You have ${sc.designMinutes} minutes.`}` },
    { n: 2, t: 'Design review', d: 'The game checks your design like a real review board. Red checks block launch. Every player has to approve.' },
    { n: 3, t: 'Launch and fly', d: `Cheap rockets can fail. Then ${sc.lifetimeYears} years fly by in about 3 minutes: solar storms, broken instruments and budget cuts need team decisions.` },
    { n: 4, t: 'Mission report', d: 'You score for science that reached the ground, goals met, money saved, safety margins and teamwork. Then redesign and fly again.' },
  ]
  return (
    <section className="brief-card wide rise">
      <div className="brief-kicker">How to play</div>
      <div className="howto-steps">
        {steps.map((s) => <div key={s.n} className="howto-step"><span className="num">{s.n}</span><b>{s.t}</b><p>{s.d}</p></div>)}
      </div>
      <div className="golden-rule">
        <b>The golden rule:</b> science only counts if it reaches the ground. Balance instruments against power, downlink and lifetime.
      </div>
      <h3 style={{ marginTop: 18 }}>{team ? (myRoles.length > 1 ? 'Your roles' : 'Your role') : 'You play all four roles'}</h3>
      <div className="role-brief">
        {(myRoles.length ? myRoles : ROLES).map((r) => (
          <div key={r} className="role-brief-item" style={{ borderColor: ROLE_COLOR[r] }}>
            <div className="row"><Avatar role={r} /><b style={{ color: ROLE_COLOR[r] }}>{ROLE_NAMES[r]}</b></div>
            <p>{ROLE_JOB[r].does}</p>
            <small>Wants: {ROLE_JOB[r].wants}</small>
          </div>
        ))}
      </div>
      {!team && <p className="small muted" style={{ margin: '10px 0 0' }}>Advisors for each role will speak up when their part of the mission is in trouble.</p>}
      <div className="story-nav inline">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <span className="spacer" />
        {team && (
          <span className="row wrap small" style={{ gap: 6 }}>
            {players.map((p) => <span key={p.id} className="chip" style={{ borderColor: state.ready[p.id] ? 'var(--good)' : undefined }}>{state.ready[p.id] ? '✓' : '…'} {p.name}</span>)}
          </span>
        )}
        <button className={`btn big ${imReady ? '' : 'primary'}`} onClick={() => dispatch({ type: 'ready', value: !imReady })}>
          {team ? (imReady ? 'Waiting for the team… (undo)' : "I'm ready: start designing") : 'Start designing →'}
        </button>
      </div>
    </section>
  )
}

function LiveFireNote() {
  const live = useLiveFires()
  return (
    <div className="real-data-note">
      <b>Real data:</b> during your mission, 8 real California wildfires (2018–2025, from national fire records) will ignite where and when they really started.
      You'll see how many hours your design would have taken to alert fire crews.
      {live && <> Right now NASA satellites see <b className="warn">{live.count.toLocaleString()} fire detections</b> in California ({live.window === '24h' ? 'last 24 h' : 'last 7 days'}). They appear as orange dots on your orbit view.</>}
    </div>
  )
}
