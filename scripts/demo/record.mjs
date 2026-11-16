// Scripted demo playthrough of Launch Window, captured frame-by-frame with CDP screencast.
// Output: frames/*.jpg, frames.json (file + wall-clock timestamp), marks.json (named moments).
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'take')
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

// ---------- capture ----------
const cdp = await context.newCDPSession(page)
const frames = []
let n = 0
cdp.on('Page.screencastFrame', async (f) => {
  const file = `frames/${String(++n).padStart(6, '0')}.jpg`
  fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64'))
  frames.push({ file, t: f.metadata.timestamp })
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
const marks = []
const mark = (name) => { marks.push({ name, t: Date.now() / 1000 }); console.log('mark', name) }
const wait = (ms) => page.waitForTimeout(ms)

// ---------- fake cursor so clicks read naturally on video ----------
const CURSOR = `
  if (!document.getElementById('demo-cursor')) {
    const c = document.createElement('div'); c.id = 'demo-cursor'
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M3 2 L3 22 L8.5 17 L12 25.5 L15.5 24 L12 15.8 L19.5 15.8 Z" fill="#fff" stroke="#0a0f1c" stroke-width="1.8" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: 'fixed', left: '960px', top: '700px', zIndex: 2147483647, pointerEvents: 'none', transition: 'left .55s cubic-bezier(.3,.7,.2,1), top .55s cubic-bezier(.3,.7,.2,1)', filter: 'drop-shadow(0 2px 6px #000a)' })
    document.body.appendChild(c)
    const s = document.createElement('style')
    s.textContent = '@keyframes demo-ripple { from { transform: translate(-50%,-50%) scale(.3); opacity: .9 } to { transform: translate(-50%,-50%) scale(1.6); opacity: 0 } } .demo-ripple { position: fixed; width: 46px; height: 46px; border-radius: 50%; border: 3px solid #ffb547; pointer-events: none; z-index: 2147483646; animation: demo-ripple .55s ease-out forwards }'
    document.head.appendChild(s)
  }`
await page.addInitScript({ content: `addEventListener('DOMContentLoaded', () => { ${CURSOR} })` })

async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded()
  const b = await loc.boundingBox()
  if (!b) throw new Error('no box')
  const x = b.x + Math.min(b.width / 2, 120), y = b.y + Math.min(b.height / 2, 40)
  await page.evaluate(([x, y]) => { const c = document.getElementById('demo-cursor'); if (c) { c.style.left = `${x - 3}px`; c.style.top = `${y - 2}px` } }, [x, y])
  await wait(600)
  return { x, y }
}
async function click(loc, after = 700) {
  const { x, y } = await moveTo(loc)
  await page.evaluate(([x, y]) => { const r = document.createElement('div'); r.className = 'demo-ripple'; r.style.left = `${x}px`; r.style.top = `${y}px`; document.body.appendChild(r); setTimeout(() => r.remove(), 700) }, [x, y])
  await loc.click()
  await wait(after)
}
async function typeInto(loc, text) {
  await click(loc, 200)
  await loc.fill('')
  await loc.pressSequentially(text, { delay: 70 })
  await wait(500)
}
const btn = (name) => page.getByRole('button', { name }).first()
const opt = (text) => page.locator('button.opt', { hasText: text }).first()
const smoothScroll = async (y) => { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y); await wait(1200) }

// ---------- start ----------
await page.goto('http://localhost:5173/')
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('lw-gfx', '3d') })
await page.reload()
await wait(1500)
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 2 })
await wait(400)

// 1. Home
mark('home')
await wait(1500)
await typeInto(page.getByPlaceholder('e.g. Ada'), 'Team Orbit')
await click(btn(/play solo/i), 1200)

// 2. Lobby: Engineer level, Wildfire Watch with live data
mark('lobby')
await click(page.locator('.level-card', { hasText: 'Engineer' }), 900)
await moveTo(page.locator('.live-chip'))
await wait(1500)
await click(page.locator('button.scenario', { hasText: 'Wildfire' }), 900)
mark('lobby-end')
await click(btn(/start mission briefing/i), 600)

// 3. Story briefing
mark('story1')
await wait(5200)
await click(page.locator('.story-nav .btn.primary'), 300) // show all
await click(page.locator('.story-nav .btn.primary'), 600) // next
mark('story2')
await wait(5800)
await click(page.locator('.story-nav .btn.primary'), 300)
await click(btn(/skip story/i), 900)
mark('goal')
await wait(3200)
await click(btn(/how to play/i), 800)
mark('howto')
await wait(2600)
await click(btn(/start designing/i), 1500)

// 4. Design: build the spacecraft part by part
mark('design')
await wait(1500)
await click(page.getByRole('tab', { name: /science/i }), 600)
await click(opt('Thermal infrared camera'), 1300)
await click(opt('Visible color camera'), 1300)
await moveTo(page.locator('button.opt', { hasText: 'Thermal infrared camera' }).locator('.basis'))
await page.locator('button.opt', { hasText: 'Thermal infrared camera' }).locator('.basis').hover()
mark('basis')
await wait(2200)
await click(page.getByRole('tab', { name: /engineer/i }), 600)
await click(opt('Small deployable wings'), 1200)
await click(opt('400 Wh battery'), 1000)
await click(opt('Reaction wheels'), 1200)
await click(page.getByRole('tab', { name: /comms/i }), 600)
await click(opt('X-band antenna'), 1200)
await click(opt('NASA Near Space Network'), 1000)
await click(page.getByRole('tab', { name: /lead/i }), 600)
await click(opt('Rideshare slot'), 1200)
mark('built')
await page.evaluate(() => window.scrollTo({ top: 0 }))
await click(page.locator('.stage-tabs button', { hasText: 'In orbit' }), 3800)
mark('orbit')
await click(page.locator('.stage-tabs button', { hasText: 'On the rocket' }), 3500)
mark('rocket')
await click(page.locator('.stage-tabs button', { hasText: 'Spacecraft' }), 1500)

// 5. Design review (estimates grow on Engineer level)
await click(btn(/call design review/i), 1500)
mark('review')
await wait(2500)
const blocked = await page.locator('.check-icon.fail').count()
if (blocked) {
  console.log('review blocked, fixing power/battery')
  await click(btn(/back to design/i), 800)
  await click(page.getByRole('tab', { name: /engineer/i }), 600)
  await click(opt('Large deployable wings'), 900)
  await click(opt('1,000 Wh battery'), 900)
  await click(btn(/call design review/i), 1500)
}
await click(btn(/approve & launch/i), 1200)

// 6. Flight plan math
mark('calc')
await wait(1500)
const ch = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.given')].map((e) => e.textContent)
  return g
})
console.log('givens', ch)
const num = (s) => parseFloat(s.replace(/[^\d.]/g, ''))
const thrust = num(ch.find((g) => g.startsWith('Engine thrust')))
const rocketT = num(ch.find((g) => g.startsWith('Rocket mass')))
const craftT = num(ch.find((g) => g.startsWith('Your spacecraft')))
const v0 = num(ch.find((g) => g.startsWith('Speed now')))
const vT = num(ch.find((g) => g.startsWith('Orbit speed')))
const acc = num(ch.find((g) => g.startsWith('Engine acceleration')))
await typeInto(page.getByLabel('Your TWR'), `${thrust} / ((${rocketT} + ${craftT}) * 9.8)`)
await typeInto(page.getByLabel('Burn time'), `(${vT} - ${v0}) / ${acc}`)
await click(btn(/run the burn/i), 300)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
mark('calc-result')
await wait(4200)
await click(btn(/launch!/i), 300)

// 7. Launch
mark('launch')
await wait(8000)

// 8. Operations
mark('ops')
await wait(3500)
await click(page.getByRole('button', { name: '4×' }), 1500)
const prefer = ['Enter safe mode', 'Upload a software patch', 'Cover it from our reserve', 'Rent backup antennas', 'Dodge it', 'Power down', 'Pay for priority']
let events = 0
for (let i = 0; i < 400; i++) {
  if (await page.locator('.score').count()) break
  const modal = page.locator('.modal .choice:not([disabled])')
  if (await modal.count()) {
    events++
    if (events === 1) mark('event')
    await wait(events === 1 ? 2500 : 600)
    let choice = null
    for (const p of prefer) { const c = page.locator('.modal .choice:not([disabled])', { hasText: p }); if (await c.count()) { choice = c.first(); break } }
    await click(choice ?? modal.first(), 900)
    if (events === 1) { mark('event-done'); await click(page.getByRole('button', { name: '16×' }), 500) }
    continue
  }
  const fireLog = await page.locator('.log div', { hasText: 'Real fire replay' }).count()
  if (fireLog && !marks.some((m) => m.name === 'fire-log')) mark('fire-log')
  await wait(250)
}

// 9. Report
await wait(1500)
mark('report')
const tier = (await page.locator('.tier').first().textContent())?.trim() ?? ''
console.log('TIER', tier)
fs.writeFileSync(path.join(OUT, 'tier.txt'), tier)
if (!/success|exceeded/i.test(tier) || /partial/i.test(tier)) { console.log('not a win, stopping take early'); await browser.close(); process.exit(3) }
await page.evaluate(() => window.scrollTo({ top: 0 }))
await wait(3500)
const fireTop = await page.evaluate(() => { const t = document.querySelector('.fire-table'); return t ? t.getBoundingClientRect().top + scrollY - 160 : 900 })
await smoothScroll(fireTop)
mark('fires')
await wait(4000)
await smoothScroll(0)
await wait(800)

// 10. Sources page
await click(btn(/^sources$/i), 1200)
mark('sources')
await wait(2500)
await page.evaluate(() => document.querySelector('.sources-back')?.scrollTo({ top: 700, behavior: 'smooth' }))
await wait(2500)
await click(page.locator('.sources .invite-close'), 800)

// 11. Team QR invite
await click(btn(/^exit$/i), 1200)
await click(btn(/create a team room/i), 1800)
await click(btn(/show full screen/i), 1000)
mark('qr')
await wait(3500)
mark('end')
await wait(500)

await cdp.send('Page.stopScreencast')
await wait(300)
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames))
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 1))
console.log(`done: ${frames.length} frames, ${marks.length} marks, ${(frames.at(-1).t - frames[0].t).toFixed(1)} s`)
await browser.close()
