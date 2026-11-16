// Records clean, full-screen footage for the story cold open (no UI chrome):
// night fire scene, California fire map, satellite-over-Earth scene, live 3D Earth.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'take-cold')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true })

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
const cdp = await context.newCDPSession(page)
const frames = []
let n = 0
let recording = false
cdp.on('Page.screencastFrame', async (f) => {
  if (recording) {
    const file = `frames/${String(++n).padStart(6, '0')}.jpg`
    fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64'))
    frames.push({ file, t: f.metadata.timestamp })
  }
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
const marks = []
const mark = (name) => { marks.push({ name, t: Date.now() / 1000 }); console.log('mark', name) }
const wait = (ms) => page.waitForTimeout(ms)
const js = (fn, arg) => page.evaluate(fn, arg)
const clickText = (sel, text) => js(([sel, text]) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.toLowerCase().includes(text.toLowerCase())); if (!el) throw new Error('missing ' + text); el.click() }, [sel, text])

const HIDE_STORY = `.topbar, .story-top, .chapter, .dialog, .story-nav { display: none !important; }
  .briefing { min-height: 100vh !important; padding: 0 !important; } #root { position: fixed; inset: 0; }`
const FULL_STAGE = `.topbar, .hangar-head, .hud, .console, .tray, .crew, .crew-silent, .growth-note, .panel, .stage-tabs, .gfx-toggle, .view-hud { display: none !important; }
  .stage-card { position: fixed !important; inset: 0 !important; z-index: 9999 !important; border: 0 !important; box-shadow: none !important; background: #02040b !important; }
  .stage-card::after { display: none !important; } .stage-card .stage3d { aspect-ratio: auto !important; width: 100vw !important; height: 100vh !important; }
  body::after { display: none; }`

await page.goto('http://localhost:5173/')
await js(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('lw-gfx', '3d'); localStorage.setItem('lw-name', 'Team Orbit') })
await page.reload()
await wait(1200)
await clickText('button', 'Play solo'); await wait(500)
await clickText('button.scenario', 'Wildfire'); await wait(300)
await clickText('button', 'Start mission briefing'); await wait(800)
const style = await page.addStyleTag({ content: HIDE_STORY })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 2 })

// Re-mount each scene so its slow zoom starts fresh on camera.
const scene = async (dot, name, ms) => {
  await js((i) => document.querySelectorAll('.dots button')[i].click(), dot === 0 ? 1 : 0)
  await wait(150)
  await js((i) => document.querySelectorAll('.dots button')[i].click(), dot)
  await wait(250)
  recording = true
  mark(name)
  await wait(ms)
  recording = false
}
await scene(0, 'night', 11000)
await scene(1, 'map', 8000)
await scene(3, 'sat', 8000)

// Live 3D Earth with the satellite
await style.evaluate((el) => el.remove())
await clickText('button', 'Skip story'); await wait(300)
await clickText('button', 'How to play'); await wait(300)
await clickText('button', 'Start designing'); await wait(1500)
await page.addStyleTag({ content: FULL_STAGE })
await js(() => window.dispatchEvent(new Event('resize')))
await wait(3500)
recording = true
mark('earth3d')
await wait(10000)
recording = false
mark('end')

await cdp.send('Page.stopScreencast')
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames))
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 1))
console.log(`done: ${frames.length} frames`)
await browser.close()
