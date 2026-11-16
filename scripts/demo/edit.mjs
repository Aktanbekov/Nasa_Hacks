// Edit the master recording into a finished demo: cut by marks, speed ramps,
// caption overlays with fades, crossfades between shots, title cards, ambient audio.
// Usage: node edit.mjs <takeDir> <full|short> <outFile>
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const [takeDir = 'take2', cut = 'full', outFile = 'demo.mp4'] = process.argv.slice(2)
const take = path.resolve(takeDir)
const master = path.join(take, 'master.mp4')
const M = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(take, 'marks-rel.json'), 'utf8')).map((m) => [m.name, m.s]))
const OV = path.resolve('overlays')
const WORK = path.join(take, `work-${cut}`)
fs.rmSync(WORK, { recursive: true, force: true })
fs.mkdirSync(WORK, { recursive: true })
const XF = cut === 'short' ? 0.3 : 0.4 // crossfade length

const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })

/** A shot from the master: [a, b] seconds, played at `speed`, with an optional caption. */
const shot = (a, b, speed, cap) => ({ kind: 'shot', a, b, speed, cap })
/** A title card over a blurred frame of the master at time `bg`. */
const card = (name, dur, bg) => ({ kind: 'card', name, dur, bg })

const PLAN = {
  full: [
    card('intro', 4.2, M.basis + 1.5),
    shot(M.home + 1.0, M['lobby-end'] + 0.4, 1.5, 'pick'),
    shot(M.story1 + 0.3, M.goal + 3.0, 1.7, 'story'),
    shot(M.design + 1.0, M.built, 2.2, 'design'),
    shot(M.built + 0.5, M.rocket + 0.2, 1.25, 'views'),
    shot(M.review - 1.2, M.calc - 0.2, 1.3, 'review'),
    shot(M.calc + 0.3, M['calc-result'] + 3.8, 1.7, 'calc'),
    shot(M.launch + 0.2, M.ops - 0.3, 1.0, 'launch'),
    shot(M.ops + 0.3, M['event-done'] + 0.8, 1.4, 'ops'),
    shot(M['event-done'] + 0.8, M.report - 0.5, 2.0, 'fires'),
    shot(M.report + 0.3, M.fires + 4.0, 1.3, 'report'),
    shot(M.sources + 0.2, M.sources + 5.2, 1.3, 'sources'),
    shot(M.qr - 0.8, M.qr + 3.2, 1.0, 'team'),
    card('outro', 5.0, M.ops + 2.0),
  ],
  short: [
    card('intro', 2.4, M.basis + 1.5),
    shot(M.lobby + 0.4, M['lobby-end'] + 0.2, 2.2, null),
    shot(M.story2 + 0.6, M.story2 + 3.6, 1.5, null),
    shot(M.design + 6.0, M.built, 4.0, 's_design'),
    shot(M.orbit - 3.3, M.orbit - 0.2, 1.3, null),
    shot(M['calc-result'] - 0.3, M['calc-result'] + 3.2, 1.2, 's_calc'),
    shot(M.launch + 1.5, M.launch + 6.5, 1.6, 's_launch'),
    shot(M.event - 0.2, M.event + 2.4, 1.2, null),
    shot(M.fires + 0.2, M.fires + 3.8, 1.2, 's_fires'),
    shot(M.qr - 0.2, M.qr + 2.4, 1.0, 's_team'),
    card('outro', 3.2, M.ops + 2.0),
  ],
}[cut]

// ---- render each piece ----
const pieces = []
PLAN.forEach((p, i) => {
  const out = path.join(WORK, `p${String(i).padStart(2, '0')}.mp4`)
  if (p.kind === 'card') {
    const fadeIn = i === 0 ? `,fade=in:st=0:d=0.6` : ''
    const fadeOut = i === PLAN.length - 1 ? `,fade=out:st=${(p.dur - 0.9).toFixed(2)}:d=0.9` : ''
    ff(['-ss', String(p.bg), '-t', String(p.dur), '-i', master, '-loop', '1', '-t', String(p.dur), '-i', path.join(OV, `title_${p.name}.png`),
      '-filter_complex', `[0:v]setpts=PTS-STARTPTS,gblur=sigma=22,eq=brightness=-0.06[bg];[1:v]format=rgba,fade=in:st=0.15:d=0.6:alpha=1[t];[bg][t]overlay=0:0,fps=30,format=yuv420p${fadeIn}${fadeOut}`,
      '-t', String(p.dur), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', out])
    pieces.push({ out, dur: p.dur })
    return
  }
  const len = p.b - p.a
  const dur = +(len / p.speed).toFixed(3)
  const capIn = p.cap ? ['-loop', '1', '-t', String(dur), '-i', path.join(OV, `cap_${p.cap}.png`)] : []
  const capChain = p.cap
    ? `;[1:v]format=rgba,fade=in:st=0.25:d=0.35:alpha=1,fade=out:st=${Math.max(0.6, dur - 0.55).toFixed(2)}:d=0.35:alpha=1[c];[v][c]overlay=0:0[o]`
    : ';[v]null[o]'
  ff(['-ss', String(Math.max(0, p.a)), '-t', String(len), '-i', master, ...capIn,
    '-filter_complex', `[0:v]setpts=(PTS-STARTPTS)/${p.speed},fps=30[v]${capChain};[o]format=yuv420p[out]`,
    '-map', '[out]', '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', out])
  pieces.push({ out, dur })
})

// ---- join with crossfades ----
const inputs = pieces.flatMap((p) => ['-i', p.out])
let chain = ''
let last = '[0:v]'
let offset = 0
for (let i = 1; i < pieces.length; i++) {
  offset += pieces[i - 1].dur - XF
  const lbl = `[x${i}]`
  chain += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}${lbl};`
  last = lbl
}
const total = pieces.reduce((s, p) => s + p.dur, 0) - XF * (pieces.length - 1)
const video = path.join(WORK, 'video.mp4')
ff([...inputs, '-filter_complex', chain.slice(0, -1), '-map', last, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', video])

// ---- ambient space pad (generated, no licensing) ----
const T = total.toFixed(2)
const pad = (f, a, lfo, ph) => `${a}*sin(2*PI*${f}*t)*(0.55+0.45*sin(2*PI*${lfo}*t+${ph}))`
const L = [pad(55, 0.05, 0.05, 0), pad(82.41, 0.035, 0.07, 1), pad(110, 0.03, 0.09, 2), pad(164.81, 0.018, 0.11, 3), pad(220.5, 0.01, 0.13, 1.5)].join('+')
const R = [pad(55.3, 0.05, 0.06, 1), pad(82.6, 0.035, 0.05, 2), pad(110.4, 0.03, 0.08, 0), pad(165.2, 0.018, 0.1, 2.5), pad(219.6, 0.01, 0.12, 0.5)].join('+')
const audio = path.join(WORK, 'audio.m4a')
ff(['-f', 'lavfi', '-i', `aevalsrc=${L}|${R}:s=48000:d=${T}`,
  '-af', `lowpass=f=900,aecho=0.8:0.7:420|780:0.25|0.18,volume=2.2,afade=t=in:st=0:d=2.5,afade=t=out:st=${Math.max(0, total - 3).toFixed(2)}:d=3`,
  '-c:a', 'aac', '-b:a', '160k', audio])

ff(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.resolve(outFile)])
console.log(`${cut}: ${pieces.length} pieces, ${total.toFixed(1)} s -> ${outFile}`)
