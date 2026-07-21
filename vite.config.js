import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['dev.pymon.familie-heise.de'],
  },
})
