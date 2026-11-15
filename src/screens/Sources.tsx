// "Science & sources": where every number comes from, what is simplified,
// the real NASA data used, and NASA resources for going deeper.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ANTENNAS, ADCS, NETWORKS, ORBITS, ROCKETS } from '../../shared/catalog.ts'
import { SCENARIOS } from '../../shared/scenarios.ts'
import { ASSUMPTIONS, BASIS, RESOURCES, SOURCES, sourceById } from '../../shared/sources.ts'
import { WILDFIRES } from '../../shared/wildfires.ts'
import { useLiveFires } from '../live.ts'

const DATA_IDS = ['svs-earth', 'svs-moon', 'firms', 'wfigs']

function Row({ id, name }: { id: string; name: string }) {
  const b = BASIS[id]
  if (!b) return null
  return (
    <tr>
      <td><b>{name}</b></td>
      <td>{b.note}</td>
      <td>
        <div className="src-links">
          {b.sources.length ? b.sources.map((s) => { const src = sourceById(s); return src ? <a key={s} href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : null }) : <span className="faint">Game value</span>}
        </div>
      </td>
    </tr>
  )
}

export function SourcesOverlay({ onClose }: { onClose: () => void }) {
  const live = useLiveFires()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  const groups: { title: string; rows: { id: string; name: string }[] }[] = [
    { title: 'Orbits', rows: ORBITS.map((o) => ({ id: o.id, name: o.name })) },
    { title: 'Rockets', rows: ROCKETS.map((r) => ({ id: r.id, name: r.name })) },
    { title: 'Pointing, radios and ground stations', rows: [...ADCS, ...ANTENNAS, ...NETWORKS].map((p) => ({ id: p.id, name: p.name })) },
    ...SCENARIOS.map((s) => ({ title: `Instruments: ${s.name}`, rows: s.instruments.map((i) => ({ id: i.id, name: i.name })) })),
  ]
  return createPortal(
    <div className="modal-back sources-back" role="dialog" aria-modal="true" aria-label="Science and sources" onClick={onClose}>
      <div className="modal sources" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm invite-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="brief-kicker">Science & sources</div>
        <h2 style={{ fontSize: 28, margin: '4px 0 6px' }}>Where the numbers come from</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Launch Window simplifies on purpose so the trade-offs stay visible, but every part is modelled on a real system.
          Below is what each one is based on, the real NASA data the game uses, and the simplifications we make.
        </p>

        <h3 className="src-h">Real data in the game</h3>
        <div className="data-cards">
          {DATA_IDS.map((id) => { const s = sourceById(id)!; return (
            <a key={id} className="data-card" href={s.url} target="_blank" rel="noreferrer">
              <b>{s.title}</b><span className="faint small">{s.org}</span><p>{s.usedFor}</p>
            </a>
          ) })}
        </div>
        <p className="small muted">
          {live ? <>Live right now: <b className="warn">{live.count.toLocaleString()} fire detections</b> inside California in the last {live.window === '24h' ? '24 hours' : '7 days'} ({live.feeds.join(', ')}). We acknowledge the use of data from NASA LANCE FIRMS, part of NASA ESDIS.</> : 'Live fire data loads when the game server is online.'}
          {' '}The fire replay uses {WILDFIRES.length} real California fires from NIFC's interagency incident records (discovery time, origin, size and cause).
        </p>

        <h3 className="src-h">What each part is based on</h3>
        {groups.map((g) => (
          <div key={g.title} className="src-group">
            <h4>{g.title}</h4>
            <table className="src-table"><tbody>{g.rows.map((r) => <Row key={r.id} {...r} />)}</tbody></table>
          </div>
        ))}

        <h3 className="src-h">Simplifications we make</h3>
        <ul className="src-list">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>

        <h3 className="src-h">Go deeper: NASA resources</h3>
        <div className="data-cards">
          {RESOURCES.map((r) => <a key={r.url} className="data-card" href={r.url} target="_blank" rel="noreferrer"><b>{r.title}</b><p>{r.why}</p></a>)}
        </div>

        <h3 className="src-h">All sources</h3>
        <ol className="src-list">
          {SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>, {s.org}. <span className="faint">{s.usedFor}</span></li>)}
        </ol>
        <p className="tiny faint">Earth imagery: NASA Goddard Space Flight Center Scientific Visualization Studio; Blue Marble Next Generation data courtesy of Reto Stöckli (NASA/GSFC) and NASA's Earth Observatory. Moon imagery: NASA's Scientific Visualization Studio, CGI Moon Kit (LRO LROC and LOLA). Characters and story events are fictional.</p>
      </div>
    </div>,
    document.body,
  )
}
