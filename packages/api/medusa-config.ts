import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'
import fs from 'fs'
import path from 'path'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Resolves where a dashboard app lives:
// - in the source tree (development): ../../apps/<name>
// - in the production build artifact: hosts that deploy only `.medusa/server` (for example
//   Medusa Cloud) get the panels bundled into ./dashboards/<name> by
//   scripts/bundle-dashboards.mjs during `build`. The compiled config runs from the
//   artifact root, so __dirname points there.
const dashboardAppDir = (name: string) => {
  const bundled = path.join(__dirname, 'dashboards', name)
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, `../../apps/${name}`)
}

// Production (NODE_ENV=production + REDIS_URL): events, workflows and locks move
// to Redis so background work survives restarts. Development keeps Medusa's
// in-memory versions, even if REDIS_URL is in your local .env.
const REDIS_URL = process.env.NODE_ENV === 'production' ? process.env.REDIS_URL : undefined
const redisModules = REDIS_URL
  ? [
      { resolve: '@medusajs/medusa/event-bus-redis', options: { redisUrl: REDIS_URL } },
      { resolve: '@medusajs/medusa/workflow-engine-redis', options: { redis: { redisUrl: REDIS_URL } } },
      {
        resolve: '@medusajs/medusa/locking',
        options: {
          providers: [
            { resolve: '@medusajs/medusa/locking-redis', id: 'locking-redis', is_default: true, options: { redisUrl: REDIS_URL } },
          ],
        },
      },
    ]
  : []

module.exports = withMercur({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: REDIS_URL,
    // One small server: "shared" runs the API and background jobs in one process.
    workerMode: (process.env.MEDUSA_WORKER_MODE as 'shared' | 'worker' | 'server') || 'shared',
    databaseDriverOptions:
      process.env.DATABASE_SSL === 'true' ? { connection: { ssl: { rejectUnauthorized: false } } } : undefined,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      vendorCors: process.env.VENDOR_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
      // Mercur's order-group page asks for orders.items.variant.product.* (4 levels);
      // Medusa's default cap for /store queries is 3, which broke "Place order".
      storeRelationsLimit: 4,
    }
  },
  featureFlags: {
    seller_registration: true
  },
  modules: [
    ...redisModules,
    {
      resolve: '@mercurjs/core/modules/admin-ui',
      options: {
        appDir: dashboardAppDir('admin'),
        path: '/dashboard',
        // Dev only: where the admin Vite server runs (apps/admin "dev" script).
        viteDevServerHost: '127.0.0.1',
        viteDevServerPort: 7000,
      }
    },
    {
      resolve: '@mercurjs/core/modules/vendor-ui',
      options: {
        appDir: dashboardAppDir('vendor'),
        path: '/seller',
        // Dev only: where the vendor Vite server runs (apps/vendor "dev" script).
        viteDevServerHost: '127.0.0.1',
        viteDevServerPort: 7001,
      }
    },
    {
      // Payment providers. "pay-on-delivery" → provider id pp_pay-on-delivery_pay-on-delivery.
      // Add the Paynow provider here when it's built.
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: './src/modules/pay-on-delivery',
            id: 'pay-on-delivery',
          },
        ],
      },
    },
    {
      // Delivery providers. "manual" covers "Collect from vendor"; "distance-delivery"
      // prices delivery per km from vendor to customer (src/lib/delivery/settings.ts).
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
          { resolve: './src/modules/distance-delivery', id: 'distance-delivery' },
        ],
      },
    },
    {
      // Customer notifications: "email" (Resend; logs instead when RESEND_API_KEY is unset),
      // "inbox" (in-store messages on the storefront), "feed" (Medusa's admin feed).
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: './src/modules/email-notification',
            id: 'email',
            options: {
              channels: ['email'],
              apiKey: process.env.RESEND_API_KEY,
              from: process.env.EMAIL_FROM,
            },
          },
          { resolve: './src/modules/inbox-notification', id: 'inbox', options: { channels: ['inbox'] } },
          { resolve: '@medusajs/medusa/notification-local', id: 'local', options: { channels: ['feed'] } },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
            options: {
              // The local provider bakes this into every uploaded file URL.
              // It must be the publicly reachable origin in production, or
              // images resolve to localhost and render broken.
              backend_url: process.env.FILE_BACKEND_URL || 'http://localhost:9000/static',
            },
          },
        ],
      },
    },
  ],
})
