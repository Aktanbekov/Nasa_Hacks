// Where the room server lives. Empty means the same origin (local dev, or `npm start`).
// For a static host like Vercel, set VITE_SERVER_URL at build time to the room server's URL,
// e.g. https://launch-window.onrender.com
const BASE = (import.meta.env.VITE_SERVER_URL ?? '').trim().replace(/\/+$/, '')

/** Full URL for a room-server path such as `/api/rooms`. */
export const api = (path: string) => BASE + path
