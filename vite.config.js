import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

let commitHash = (process.env.VITE_COMMIT_HASH || '').trim()
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    commitHash = 'dev'
  }
}
commitHash = commitHash.slice(0, 7)

function versionJsonPlugin(version) {
  return {
    name: 'version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2),
      })
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        res.end(JSON.stringify({ version, buildTime: new Date().toISOString() }))
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
  },
  plugins: [
    tailwindcss(),
    svelte(),
    versionJsonPlugin(commitHash),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/version\.json$/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'pymon',
        short_name: 'pymon',
        description: 'pymon monitoring dashboard',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['dev.pymon.familie-heise.de'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
