/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Hooks and components need a DOM; jsdom simulates one in Node
    environment: 'jsdom',
    // A fixed API address, so tests never depend on a local .env file
    env: { VITE_API_URL: 'http://localhost:3000' },
  },
})
