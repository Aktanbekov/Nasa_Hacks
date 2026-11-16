// Build a constant-30fps master video from the variable-rate screencast frames.
// Also writes marks relative to the master's timeline (seconds).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const dir = path.resolve(process.argv[2] ?? 'take1')
const frames = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'))
const marks = JSON.parse(fs.readFileSync(path.join(dir, 'marks.json'), 'utf8'))
const t0 = frames[0].t
let list = ''
for (let i = 0; i < frames.length; i++) {
  const dur = i < frames.length - 1 ? frames[i + 1].t - frames[i].t : 0.1
  list += `file '${path.join(dir, frames[i].file)}'\nduration ${Math.max(0.001, dur).toFixed(4)}\n`
}
list += `file '${path.join(dir, frames.at(-1).file)}'\n`
fs.writeFileSync(path.join(dir, 'concat.txt'), list)
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'concat.txt'),
  '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', path.join(dir, 'master.mp4')], { stdio: 'inherit' })
const rel = marks.map((m) => ({ name: m.name, s: +(m.t - t0).toFixed(2) }))
fs.writeFileSync(path.join(dir, 'marks-rel.json'), JSON.stringify(rel, null, 1))
console.log(rel.map((m) => `${m.name}@${m.s}`).join('  '))
