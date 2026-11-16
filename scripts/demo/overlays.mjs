// Render title cards and caption overlays as PNGs (transparent where needed), in the game's HUD style.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('overlays')
fs.mkdirSync(OUT, { recursive: true })

const FONT = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Oxanium:wght@500;600;700;800&display=swap" rel="stylesheet">`
const BASE = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1920px; height: 1080px; background: transparent; font-family: 'IBM Plex Sans', sans-serif; color: #e6f1ff; }
  .brk { --c: rgba(92,225,255,.85);
    background:
      linear-gradient(var(--c),var(--c)) top left/22px 2px no-repeat, linear-gradient(var(--c),var(--c)) top left/2px 22px no-repeat,
      linear-gradient(var(--c),var(--c)) top right/22px 2px no-repeat, linear-gradient(var(--c),var(--c)) top right/2px 22px no-repeat,
      linear-gradient(var(--c),var(--c)) bottom left/22px 2px no-repeat, linear-gradient(var(--c),var(--c)) bottom left/2px 22px no-repeat,
      linear-gradient(var(--c),var(--c)) bottom right/22px 2px no-repeat, linear-gradient(var(--c),var(--c)) bottom right/2px 22px no-repeat; }
`

// Lower-third caption: kicker + headline (+ optional sub line)
const caption = ({ kicker, text, sub }) => `<!doctype html><html><head>${FONT}<style>${BASE}
  .cap { position: absolute; left: 56px; bottom: 60px; max-width: 1180px; padding: 22px 34px 24px 30px;
    background: linear-gradient(180deg, rgba(10,18,40,.92), rgba(6,12,28,.94)); border-left: 4px solid #ffb547;
    box-shadow: 0 18px 60px rgba(0,0,0,.55); }
  .k { font-family: Oxanium; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; font-size: 19px; color: #5ce1ff; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .k::before { content: ''; width: 10px; height: 10px; background: #5ce1ff; transform: rotate(45deg); box-shadow: 0 0 12px #5ce1ff; }
  .t { font-family: Oxanium; font-weight: 700; font-size: 44px; line-height: 1.15; letter-spacing: .01em; text-shadow: 0 2px 20px rgba(0,0,0,.6); }
  .s { margin-top: 8px; font-size: 22px; color: #b8c7e4; }
</style></head><body><div class="cap brk"><div class="k">${kicker}</div><div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div></body></html>`

// Full-frame title over a (blurred) video background: transparent backdrop, centered content
const title = ({ big, tag, foot }) => `<!doctype html><html><head>${FONT}<style>${BASE}
  body { display: grid; place-items: center; background: radial-gradient(1200px 700px at 50% 50%, rgba(5,8,22,.55), rgba(5,8,22,.88)); }
  .wrap { text-align: center; }
  .logo { width: 92px; height: 92px; margin: 0 auto 26px; display: block; filter: drop-shadow(0 0 24px rgba(255,181,71,.5)); }
  h1 { font-family: Oxanium; font-weight: 800; font-size: 150px; letter-spacing: .04em; line-height: .95; text-transform: uppercase; }
  h1 em { font-style: normal; color: #ffb547; text-shadow: 0 0 50px rgba(255,181,71,.55); }
  .tag { margin-top: 30px; font-family: Oxanium; font-weight: 600; font-size: 40px; color: #e6f1ff; letter-spacing: .01em; }
  .foot { margin-top: 34px; font-family: Oxanium; font-weight: 600; font-size: 22px; letter-spacing: .24em; text-transform: uppercase; color: #5ce1ff; }
  .rule { width: 520px; height: 2px; margin: 34px auto 0; background: linear-gradient(90deg, transparent, #5ce1ff, transparent); }
</style></head><body><div class="wrap">
  <svg class="logo" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#18233d"/><path d="M16 4c4 3 6 8 6 13l-2.5 4h-7L10 17c0-5 2-10 6-13z" fill="#e9edf6"/><circle cx="16" cy="13" r="2.4" fill="#18233d"/><path d="M12.5 21h7l-1 4h-5z" fill="#f5b544"/></svg>
  <h1>${big}</h1><div class="tag">${tag}</div><div class="rule"></div><div class="foot">${foot}</div>
</div></body></html>`

// Cinematic cold-open text: small caps, centered low, thin rules (no panel)
const cinema = ({ top, big, small }) => `<!doctype html><html><head>${FONT}<style>${BASE}
  body { display: flex; align-items: flex-end; justify-content: center; }
  .c { text-align: center; margin-bottom: 92px; text-shadow: 0 2px 24px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9); }
  .top { font-family: Oxanium; font-weight: 600; font-size: 24px; letter-spacing: .34em; text-transform: uppercase; color: #ffcf8a; }
  .big { font-family: Oxanium; font-weight: 800; font-size: 76px; letter-spacing: .04em; color: #fff; margin-top: 6px; }
  .small { font-family: Oxanium; font-weight: 600; font-size: 22px; letter-spacing: .28em; text-transform: uppercase; color: #c9d6ee; margin-top: 8px; }
  .q { font-family: 'IBM Plex Sans'; font-weight: 500; font-style: italic; font-size: 46px; color: #fff; letter-spacing: .005em; }
  .rule { width: 360px; height: 1px; margin: 16px auto 0; background: linear-gradient(90deg, transparent, rgba(255,207,138,.8), transparent); }
</style></head><body><div class="c">${top ? `<div class="top">${top}</div>` : ''}${big ? `<div class="big">${big}</div>` : ''}${small ? `<div class="small">${small}</div>` : ''}<div class="rule"></div></div></body></html>`
const CINEMA = {
  date: { top: 'July 13, 2021 · Northern California' },
  dixie: { top: 'Dixie Fire', big: '963,309 acres', small: 'burned before it was over' },
  question: { big: '<span class="q">What if you\'d built the satellite that was watching?</span>' },
}

const CAPTIONS = {
  pick: { kicker: '01 · Choose your mission', text: 'Pick a mission and a difficulty', sub: 'Live NASA FIRMS fire data: 300+ detections in California right now' },
  story: { kicker: '02 · Briefing', text: 'Every mission starts with a story', sub: 'Then clear goals: must-haves, bonuses, budget and lifetime' },
  design: { kicker: '03 · Design', text: 'Every part changes mass, power, cost and data', sub: 'Four roles, one shared dashboard, real-world sources for every number' },
  views: { kicker: '03 · Design', text: 'See your spacecraft in 3D', sub: 'NASA Blue Marble Earth · your orbit, ground stations and target' },
  review: { kicker: '04 · Design review', text: 'Estimates grow at review, so margins matter', sub: 'Red checks block launch, just like a real review board' },
  calc: { kicker: '05 · Flight plan', text: 'Real physics with your own numbers', sub: 'Thrust-to-weight and burn time decide the orbit you get' },
  launch: { kicker: '06 · Launch', text: 'Light the rocket', sub: 'Cheaper rockets carry real risk' },
  ops: { kicker: '07 · Operations', text: 'Three years in three minutes', sub: 'Solar storms, failures and budget cuts need team decisions' },
  fires: { kicker: '07 · Real data', text: 'Real California wildfires, replayed', sub: 'Dixie, Creek, Caldor… how fast would your design have alerted crews?' },
  report: { kicker: '08 · Mission report', text: 'Score only for science that reached the ground', sub: 'The report explains why, and what fix would have cost' },
  sources: { kicker: 'Science & sources', text: 'Every part cites its real-world source', sub: 'Landsat 9, MODIS, LRO, Deep Space Network, NASA FIRMS, NIFC fire records' },
  team: { kicker: 'Play together', text: 'Solo, or scan to join a team of four', sub: 'Mission Lead · Science · Engineer · Comms' },
  // short cut
  s_design: { kicker: 'Design', text: 'Every part changes mass, power, cost and data' },
  s_calc: { kicker: 'Flight plan', text: 'Real physics with your own numbers' },
  s_launch: { kicker: 'Launch & fly', text: 'Three years in three minutes' },
  s_fires: { kicker: 'Real data', text: 'Replays real California wildfires' },
  s_team: { kicker: 'Play together', text: 'Solo, or a team of four' },
}
const TITLES = {
  intro: { big: 'Launch <em>Window</em>', tag: 'Design it. Launch it. Fly it. Only science that reaches the ground counts.', foot: 'NASA Space Apps 2026 · Space Mission Design Game' },
  outro: { big: 'Launch <em>Window</em>', tag: 'Real NASA data · 3 difficulty levels · 1 to 4 players', foot: 'Data: NASA FIRMS · NASA SVS Blue Marble &amp; LRO · NIFC fire records' },
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
for (const [name, c] of Object.entries(CAPTIONS)) {
  await page.setContent(caption(c), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `cap_${name}.png`), omitBackground: true })
}
for (const [name, c] of Object.entries(CINEMA)) {
  await page.setContent(cinema(c), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `cap_cold_${name}.png`), omitBackground: true })
}
for (const [name, t] of Object.entries(TITLES)) {
  await page.setContent(title(t), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, `title_${name}.png`), omitBackground: true })
}
await browser.close()
console.log('overlays:', fs.readdirSync(OUT).length)
