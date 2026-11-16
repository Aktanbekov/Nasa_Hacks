// Story cuts: a cold open from clean story footage, then the gameplay walkthrough,
// each shot placed at the start time its narration line needs.
// Usage: node edit-story.mjs <short|full|vo> <outFile> [mainTake=take2] [coldTake=take-cold] [voDir]
// The vo cut times every shot to the voiceover lines in <voDir>/times.json (from voice.mjs) and mixes <voDir>/voice.wav in.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const [cut = 'full', outFile = 'story.mp4', mainTake = 'take2', coldTake = 'take-cold', voDir] = process.argv.slice(2)
const VO = voDir ? JSON.parse(fs.readFileSync(path.resolve(voDir, 'times.json'), 'utf8')).map((l) => l.start) : null
if (cut === 'vo' && !VO) throw new Error('the vo cut needs a voDir from voice.mjs')
const marks = (t) => Object.fromEntries(JSON.parse(fs.readFileSync(path.resolve(t, 'marks-rel.json'), 'utf8')).map((m) => [m.name, m.s]))
const SRC = { main: path.resolve(mainTake, 'master.mp4'), cold: path.resolve(coldTake, 'master.mp4') }
const M = marks(mainTake)
const C = marks(coldTake)
const OV = path.resolve('overlays')
const WORK = path.resolve(mainTake, `work-story-${cut}`)
fs.rmSync(WORK, { recursive: true, force: true })
fs.mkdirSync(WORK, { recursive: true })
const XF = cut === 'full' ? 0.4 : 0.3
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })

// Each entry: [startTime, piece]. A piece's on-screen length = next start - this start + crossfade.
// shot(src, from, to, cap) plays [from, to] stretched/squeezed to fit; card(name, bgSrc, bgTime).
const shot = (src, a, b, cap = null) => ({ kind: 'shot', src, a, b, cap })
const card = (name, src, bg) => ({ kind: 'card', name, src, bg })

const TIMELINES = {
  full: [
    [0.0, shot('cold', C.night + 0.2, C.night + 10.4, 'cold_date')],
    [9.2, shot('cold', C.map + 0.3, C.map + 6.7, 'cold_dixie')],
    [14.8, shot('cold', C.earth3d + 0.1, C.earth3d + 5.0)],
    [19.2, shot('cold', C.sat + 0.3, C.sat + 4.4, 'cold_question')],
    [22.6, card('intro', 'main', M.basis + 1.5)],
    [25.6, shot('main', M.home + 1.0, M['lobby-end'] + 0.4, 'pick')],
    [33.2, shot('main', M.story2 + 5.0, M.goal + 3.3, 'story')],
    [38.6, shot('main', M.design + 1.0, M.built, 'design')],
    [46.6, shot('main', M.built + 0.5, M.rocket + 0.2, 'views')],
    [52.0, shot('main', M.review - 1.2, M.calc - 0.2, 'review')],
    [57.0, shot('main', M.calc + 0.3, M['calc-result'] + 3.8, 'calc')],
    [63.6, shot('main', M.launch + 0.2, M.ops - 0.3, 'launch')],
    [71.0, shot('main', M.ops + 0.3, M['event-done'] + 0.8, 'ops')],
    [78.6, shot('main', M['event-done'] + 0.8, M.report - 0.5, 'fires')],
    [87.0, shot('main', M.report + 0.3, M.fires + 4.0, 'report')],
    [93.0, shot('main', M.sources + 0.2, M.sources + 5.2, 'sources')],
    [96.0, shot('main', M.qr - 0.8, M.qr + 2.6, 'team')],
    [99.0, card('outro', 'cold', C.earth3d + 1.0)],
    [105.0, null],
  ],
  short: [
    [0.0, shot('cold', C.night + 0.4, C.night + 5.2, 'cold_date')],
    [4.5, shot('cold', C.map + 0.3, C.map + 4.3, 'cold_dixie')],
    [8.2, shot('cold', C.sat + 0.3, C.sat + 3.4, 'cold_question')],
    [11.0, card('intro', 'main', M.basis + 1.5)],
    [12.6, shot('main', M.built - 10.0, M.built, 's_design')],
    [16.4, shot('main', M['calc-result'] + 0.3, M['calc-result'] + 2.0)],
    [17.8, shot('main', M.launch + 2.2, M.launch + 4.6)],
    [19.2, shot('main', M.fires + 0.2, M.fires + 4.2, 's_fires')],
    [23.0, shot('main', M.qr - 0.2, M.qr + 2.6, 's_team')],
    [25.6, card('outro', 'cold', C.earth3d + 1.0)],
    [29.8, null],
  ],
  // Lines (VO index): 0 date, 1 canyon, 2 Dixie, 3 what if, 4 title, 5 team, 6 parts, 7 math, 8 launch, 9 fires, 10 solo, 11 closing.
  vo: VO && [
    [0.0, shot('cold', C.night + 0.4, C.night + 5.6, 'cold_date')],
    [VO[2] - 0.25, shot('cold', C.map + 0.3, C.map + 4.5, 'cold_dixie')],
    [VO[3] - 0.25, shot('cold', C.sat + 0.3, C.sat + 3.4, 'cold_question')],
    [VO[4] - 0.3, card('intro', 'main', M.basis + 1.5)],
    [VO[5] - 0.25, shot('main', M.built - 10.0, M.built, 's_design')],
    [VO[7] - 0.55, shot('main', M['calc-result'] + 0.3, M['calc-result'] + 2.0)],
    [VO[8] - 0.2, shot('main', M.launch + 2.2, M.launch + 4.6)],
    [VO[9] + 0.6, shot('main', M.fires + 0.2, M.fires + 4.0, 's_fires')],
    [VO[10] - 0.15, shot('main', M.qr - 0.2, M.qr + 2.6, 's_team')],
    [VO[11] - 0.15, card('outro', 'cold', C.earth3d + 1.0)],
    [29.6, null],
  ],
}
const TL = TIMELINES[cut]

const pieces = []
for (let i = 0; i < TL.length - 1; i++) {
  const [start, p] = TL[i]
  const next = TL[i + 1][0]
  const last = i === TL.length - 2
  const dur = +(next - start + (last ? 0 : XF)).toFixed(3)
  const out = path.join(WORK, `p${String(i).padStart(2, '0')}.mp4`)
  if (p.kind === 'card') {
    const fadeOut = last ? `,fade=out:st=${(dur - 1.0).toFixed(2)}:d=1.0` : ''
    ff(['-ss', String(p.bg), '-t', String(dur), '-i', SRC[p.src], '-loop', '1', '-t', String(dur), '-i', path.join(OV, `title_${p.name}.png`),
      '-filter_complex', `[0:v]setpts=PTS-STARTPTS,gblur=sigma=22,eq=brightness=-0.06[bg];[1:v]format=rgba,fade=in:st=0.1:d=0.5:alpha=1[t];[bg][t]overlay=0:0,fps=30,tpad=stop_mode=clone:stop_duration=${dur},format=yuv420p${fadeOut}`,
      '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', out])
  } else {
    const len = p.b - p.a
    const speed = len / dur
    const fadeIn = i === 0 ? ',fade=in:st=0:d=1.2' : ''
    const capIn = p.cap ? ['-loop', '1', '-t', String(dur), '-i', path.join(OV, `cap_${p.cap}.png`)] : []
    const capDelay = p.cap?.startsWith('cold') ? 0.9 : 0.25
    const capChain = p.cap
      ? `;[1:v]format=rgba,fade=in:st=${capDelay}:d=0.6:alpha=1,fade=out:st=${Math.max(capDelay + 0.8, dur - 0.7).toFixed(2)}:d=0.45:alpha=1[c];[v][c]overlay=0:0[o]`
      : ';[v]null[o]'
    ff(['-ss', String(Math.max(0, p.a)), '-t', String(len), '-i', SRC[p.src], ...capIn,
      '-filter_complex', `[0:v]setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=30,tpad=stop_mode=clone:stop_duration=1${fadeIn}[v]${capChain};[o]format=yuv420p[out]`,
      '-map', '[out]', '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', out])
    if (speed < 0.85 || speed > 3.2) console.log(`note: piece ${i} speed ${speed.toFixed(2)}x`)
  }
  pieces.push({ out, dur })
}

// join with crossfades so each piece starts exactly at its timeline time
let chain = ''
let lastLbl = '[0:v]'
for (let i = 1; i < pieces.length; i++) {
  const lbl = `[x${i}]`
  chain += `${lastLbl}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${TL[i][0].toFixed(3)}${lbl};`
  lastLbl = lbl
}
const total = TL.at(-1)[0]
const video = path.join(WORK, 'video.mp4')
ff([...pieces.flatMap((p) => ['-i', p.out]), '-filter_complex', chain.slice(0, -1), '-map', lastLbl, '-t', String(total),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', video])

// ambient pad, quieter during the cold open so the story lands, then swelling at the title
const pad = (f, a, lfo, ph) => `${a}*sin(2*PI*${f}*t)*(0.55+0.45*sin(2*PI*${lfo}*t+${ph}))`
const L = [pad(55, 0.05, 0.05, 0), pad(82.41, 0.035, 0.07, 1), pad(110, 0.03, 0.09, 2), pad(164.81, 0.018, 0.11, 3), pad(220.5, 0.01, 0.13, 1.5)].join('+')
const R = [pad(55.3, 0.05, 0.06, 1), pad(82.6, 0.035, 0.05, 2), pad(110.4, 0.03, 0.08, 0), pad(165.2, 0.018, 0.1, 2.5), pad(219.6, 0.01, 0.12, 0.5)].join('+')
const titleAt = TL.find(([, p]) => p?.kind === 'card' && p.name === 'intro')[0]
const audio = path.join(WORK, 'audio.m4a')
ff(['-f', 'lavfi', '-i', `aevalsrc=${L}|${R}:s=48000:d=${total}`,
  '-af', `lowpass=f=900,aecho=0.8:0.7:420|780:0.25|0.18,volume='if(lt(t,${titleAt}),1.1,2.2)':eval=frame,afade=t=in:st=0:d=3,afade=t=out:st=${(total - 3).toFixed(2)}:d=3`,
  '-c:a', 'aac', '-b:a', '160k', audio])
if (voDir) {
  // voiceover on top; the pad ducks under the voice and sits lower overall
  ff(['-i', video, '-i', audio, '-i', path.resolve(voDir, 'voice.wav'), '-filter_complex',
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.55[pad];[2:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${total},asplit[v][sc];` +
    `[pad][sc]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500[duck];[duck][v]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.9[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(total), '-movflags', '+faststart', path.resolve(outFile)])
} else {
  ff(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.resolve(outFile)])
}
console.log(`${cut} story cut: ${pieces.length} pieces, ${total} s -> ${outFile}`)
