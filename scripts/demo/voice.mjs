// Fit a recorded voiceover into the 30-second limit: split it into its lines at the pauses,
// tighten the pauses, speed it up slightly, and write voice.wav plus each line's start time.
// Usage: node voice.mjs <voiceover.mp3> [outDir=vo] [tempo=1.15]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const [src, outDir = 'vo', tempoArg = '1.15'] = process.argv.slice(2)
if (!src) throw new Error('usage: node voice.mjs <voiceover.mp3> [outDir] [tempo]')
const TEMPO = Number(tempoArg)
const LEAD = 0.25 // silence before the first word
// Pause after each line, in final (sped-up) seconds. Lines follow demo/voiceover-script.md.
const LINES = ['July 13th, 2021.', 'A small fire starts…', 'Before it\'s over…', 'What if…', 'This is Launch Window.', 'Design it as a team.',
  'Every part costs…', 'Do the real math.', 'Launch.', 'Then real California wildfires…', 'Play solo…', 'Build the satellite…']
const GAPS = [0.2, 0.25, 0.3, 0.25, 0.15, 0.1, 0.15, 0.1, 0.2, 0.15, 0.15]

fs.mkdirSync(outDir, { recursive: true })
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString())
// ffmpeg writes the silencedetect log to stderr
const err = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'silencedetect=n=-38dB:d=0.18', '-f', 'null', '-']).stderr.toString()
const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
// speech segments = gaps between silences
const segs = []
let cur = 0
for (let i = 0; i < starts.length; i++) {
  if (starts[i] - cur > 0.15) segs.push([cur, starts[i]])
  cur = ends[i] ?? total
}
if (total - cur > 0.15) segs.push([cur, total])
if (segs.length !== LINES.length) throw new Error(`found ${segs.length} spoken lines, expected ${LINES.length}: ${JSON.stringify(segs)}`)

// build: each line sped up, then its pause
const parts = []
const times = []
let t = LEAD
segs.forEach(([a, b], i) => {
  const out = path.join(outDir, `l${String(i).padStart(2, '0')}.wav`)
  const pad = i < GAPS.length ? GAPS[i] : 0
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, a - 0.03)), '-to', String(b + 0.04), '-i', src,
    '-af', `atempo=${TEMPO},afade=t=in:d=0.02,afade=t=out:st=${((b - a + 0.07) / TEMPO - 0.03).toFixed(3)}:d=0.03,apad=pad_dur=${pad}`,
    '-ar', '48000', '-ac', '1', out])
  const len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString())
  times.push({ line: LINES[i], start: +t.toFixed(3), end: +(t + len - pad).toFixed(3) })
  t += len
  parts.push(out)
})
const list = path.join(outDir, 'list.txt')
fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p)}'`).join('\n'))
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-t', String(LEAD), '-i', 'anullsrc=r=48000:cl=mono', '-f', 'concat', '-safe', '0', '-i', list,
  '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=7[a]', '-map', '[a]', '-ar', '48000', path.join(outDir, 'voice.wav')])
fs.writeFileSync(path.join(outDir, 'times.json'), JSON.stringify(times, null, 1))
for (const x of times) console.log(`${x.start.toFixed(2).padStart(6)}–${x.end.toFixed(2).padStart(6)}  ${x.line}`)
console.log(`voice ends at ${times.at(-1).end.toFixed(2)} s`)
