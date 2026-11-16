// Vercel Function for every /api route. Bundled into .vercel/output by scripts/vercel-output.mjs.
// Rooms live in Upstash Redis (connect it from the Vercel dashboard: Storage -> Upstash Redis).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi, redisFromEnv } from './rooms.ts'

const store = redisFromEnv(process.env)

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 50_000) throw new Error('too large') }
  return raw ? JSON.parse(raw) : undefined
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x')
  // config.json rewrites /api/<rest> to /api?__path=<rest>
  const rest = url.searchParams.get('__path')
  const path = rest !== null ? `/api/${rest}` : url.pathname
  url.searchParams.delete('__path')
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers })
    res.end(JSON.stringify(body))
  }
  // Join links on Vercel use the site's own address, so no LAN addresses are needed.
  if (path === '/api/info') return send(200, { addresses: [] })
  let body: unknown
  try { body = req.method === 'POST' ? await readBody(req) : undefined } catch { return send(400, { error: 'Bad request body' }) }
  const out = await handleApi({ method: req.method ?? 'GET', path, query: url.searchParams, body }, store)
  send(out.status, out.body, out.headers)
}
