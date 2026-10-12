/// <reference types="vite/client" />

// Types our env variables so import.meta.env.VITE_API_URL is a string, not `any`
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
