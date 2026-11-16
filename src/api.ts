// Where the room API lives. Empty (the default) means the same origin: Vite's dev proxy,
// `npm start`, or the Vercel function. Set VITE_SERVER_URL at build time only to use a
// room server on another host.
const BASE = (import.meta.env.VITE_SERVER_URL ?? '').trim().replace(/\/+$/, '')

/** Full URL for a room-server path such as `/api/rooms`. */
export const api = (path: string) => BASE + path
