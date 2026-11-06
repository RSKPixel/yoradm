import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    host: true, // listen on all interfaces so Tailscale can reach it
    allowedHosts: ['homeserver', 'homeserver.tailfef550.ts.net'],
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000' },
    },
  },
})
