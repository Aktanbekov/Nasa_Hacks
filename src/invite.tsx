// Team invite: a scannable QR code + link for joining a room from a phone or laptop.
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Network addresses of the game server, fetched once. */
let lanPromise: Promise<string | null> | null = null
function lanAddress(): Promise<string | null> {
  if (!lanPromise) {
    lanPromise = fetch('/api/info')
      .then((r) => r.json())
      .then((d: { addresses: string[] }) => {
        const usable = d.addresses.filter((a) => !a.startsWith('169.254.'))
        const priv = usable.find((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a))
        return priv ?? usable[0] ?? null
      })
      .catch(() => null)
  }
  return lanPromise
}

/**
 * Link a teammate can open to join the room. When this page runs on
 * localhost, the link uses the computer's network address instead, so phones
 * on the same Wi-Fi can reach it.
 */
export function useJoinUrl(code: string) {
  const here = new URL(location.href)
  const isLocal = LOCAL.has(here.hostname)
  const [host, setHost] = useState<string | null>(isLocal ? null : here.host)
  useEffect(() => {
    if (!isLocal) return
    lanAddress().then((ip) => setHost(ip ? `${ip}${here.port ? `:${here.port}` : ''}` : here.host))
  }, [isLocal, here.host, here.port])
  const url = host ? `${here.protocol}//${host}${here.pathname}?room=${code}` : null
  return { url, sameMachineOnly: isLocal && host === here.host }
}

export function QrCode({ text, size = 200 }: { text: string; size?: number | string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0f1c', light: '#ffffff' } })
      .then((s) => { if (live) setSvg(s) })
      .catch(() => { if (live) setSvg('') })
    return () => { live = false }
  }, [text])
  return (
    <div className="qr" style={{ width: size }} role="img" aria-label={`QR code for ${text}`}
      // The SVG markup is generated locally by the qrcode library from our own join URL.
      dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

/** QR + link + copy button. `big` is the full-screen version for projecting. */
export function InvitePanel({ code, big = false, onExpand }: { code: string; big?: boolean; onExpand?: () => void }) {
  const { url, sameMachineOnly } = useJoinUrl(code)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (!url) return
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <div className={`invite ${big ? 'big' : ''}`}>
      <div className="invite-qr">
        {url ? <QrCode text={url} size={big ? 'min(64vh, 80vw, 560px)' : '100%'} /> : <div className="qr placeholder" style={{ width: big ? 'min(64vh, 80vw, 560px)' : '100%' }} />}
      </div>
      <div className="invite-info">
        {big && <div className="invite-kicker">Scan to join the team</div>}
        <div className="code" aria-label="Room code">{code}</div>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>
          Scan with a phone camera, or open the link and enter your name. Teammates must be on the same Wi-Fi as this computer.
        </p>
        <div className="row">
          <input type="text" readOnly value={url ?? 'Finding network address…'} onFocus={(e) => e.target.select()} style={{ flex: 1, fontSize: big ? 15 : 12, minWidth: 0 }} aria-label="Join link" />
          <button className="btn sm" onClick={copy} disabled={!url}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
        {sameMachineOnly && <p className="small warn" style={{ margin: '8px 0 0' }}>Couldn't find this computer's network address, so this link only works on this computer.</p>}
        {onExpand && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onExpand}>⛶ Show full screen for the room</button>}
      </div>
    </div>
  )
}

/** Full-screen overlay with a large QR, for projectors and shared screens. */
export function InviteOverlay({ code, onClose }: { code: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  // Portal to <body>: panels use backdrop blur, which would trap a fixed overlay inside them.
  return createPortal(
    <div className="modal-back invite-overlay" role="dialog" aria-modal="true" aria-label="Invite teammates" onClick={onClose}>
      <div className="modal invite-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm invite-close" onClick={onClose} aria-label="Close">✕</button>
        <InvitePanel code={code} big />
      </div>
    </div>,
    document.body,
  )
}
