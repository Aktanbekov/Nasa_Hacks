/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Room server URL when the site is hosted separately (e.g. Vercel). Empty = same origin. */
  readonly VITE_SERVER_URL?: string
  /** Public host of the Vercel project (set at build time); invite links use it. */
  readonly VITE_PUBLIC_HOST?: string
}
