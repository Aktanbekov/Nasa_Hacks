// Runs the game server and the Vite dev server together.
import { spawn } from 'node:child_process'

const procs = [
  spawn('node', ['--watch', 'server/server.ts'], { stdio: 'inherit', env: { ...process.env, GAME_PORT: '8787' } }),
  spawn('npx', ['vite', '--port', process.env.PORT ?? '5173', '--strictPort'], { stdio: 'inherit' }),
]
const stop = () => { for (const p of procs) p.kill(); process.exit() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', (code) => { if (code) stop() })
