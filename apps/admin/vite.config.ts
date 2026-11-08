import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// createRequire (not a static import): the plugin's ESM build can't dynamic-require
// medusa-config.ts, so it silently falls back to base "/" and 404s panel assets.
const require = createRequire(import.meta.url)
const { mercurDashboardPlugin } = require('@mercurjs/dashboard-sdk/vite')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Baked into the panel at build time. For a backend-served production build
  // (e.g. Medusa Cloud) set it to the deployed backend origin so API calls are
  // same-origin; it defaults to http://localhost:9000 for development.
  const backendUrl = env.VITE_MERCUR_BACKEND_URL || env.MERCUR_BACKEND_URL
  // Cepstrum Technologies echo-arc mark (public/logo.svg), inlined so it shows
  // on the login screen and sidebar wherever the panel is served from.
  const logo = `data:image/svg+xml;base64,${readFileSync(new URL('./public/logo.svg', import.meta.url)).toString('base64')}`

  return {
    plugins: [
      react(),
      mercurDashboardPlugin({
        medusaConfigPath: '../../packages/api/medusa-config.ts',
        name: 'Cepstrum3D',
        logo,
        ...(backendUrl ? { backendUrl } : {}),
      }),
    ],
  }
})
