import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },

  build: {
    // Split vendors into separate chunks — users only download what each page needs
    rollupOptions: {
      output: {
        manualChunks: {
          "react-core":   ["react", "react-dom"],
          "react-router": ["react-router-dom"],
          "supabase":     ["@supabase/supabase-js"],
          "query":        ["@tanstack/react-query"],
          "charts":       ["recharts"],
          "pdf":          ["jspdf"],
          "motion":       ["framer-motion"],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
    reportCompressedSize: false,
  },

  plugins: [
    react(),
    VitePWA({
      // autoUpdate: when a new SW is found, skip waiting and activate immediately.
      // vite-plugin-pwa injects the registration script automatically — no
      // manual navigator.serviceWorker.register() needed in app code.
      registerType: "autoUpdate",
      injectRegister: "auto",

      includeAssets: [
        "favicon.ico",
        "favicon.png",
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
      ],

      manifest: {
        name: "Nexis",
        short_name: "Nexis",
        description:
          "All-in-one POS, inventory, invoicing and analytics for Ghanaian businesses.",
        theme_color: "#1a3a22",
        background_color: "#f9f5ee",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192.png",          sizes: "192x192", type: "image/png", purpose: "any"      },
          { src: "/pwa-512.png",          sizes: "512x512", type: "image/png", purpose: "any"      },
          { src: "/pwa-512.png",          sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png"                      },
        ],
      },

      workbox: {
        // ── Instant activation ────────────────────────────────────────────
        // skipWaiting: new SW doesn't wait for old tabs to close — activates now.
        // clientsClaim: new SW immediately controls every open tab.
        // Together these guarantee: deploy → everyone gets new version on next
        // page focus / background-refresh, without any manual reload needed.
        skipWaiting: true,
        clientsClaim: true,

        // Remove precache entries from stale SW versions automatically.
        cleanupOutdatedCaches: true,

        // ── Precache fingerprinting ───────────────────────────────────────
        // Every file gets content-hashed. When ANY file changes, the SW
        // precache manifest changes → browser detects new SW → auto-update fires.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webp,jpg,jpeg}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

        // ── SPA navigation fallback ───────────────────────────────────────
        // React Router routes (e.g. /dashboard, /pos) must serve index.html
        // so the app works offline and on hard-refresh of any deep URL.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/rest\/v1/,
          /^\/auth\/v1/,
          /^\/storage\/v1/,
          /^\/realtime\/v1/,
          /^\/functions\/v1/,
          // Paths that look like files (have an extension) should not fallback
          /\/[^/?]+\.[^/]+(\?.*)?$/,
        ],

        // ── Runtime caching strategies ────────────────────────────────────
        runtimeCaching: [
          {
            // Supabase Auth + Realtime + Edge Functions — never cache.
            // Auth tokens must always be fresh; realtime is websocket-based.
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|realtime|functions)\/.*/i,
            handler: "NetworkOnly",
          },
          {
            // Supabase Storage — user uploads, logos, attachments.
            // Content-addressed, safe to cache for 30 days.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-v1",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase REST data — NetworkFirst: always try to fetch live data,
            // but serve the cached response when offline (up to 24 h stale).
            // This is what makes the app usable without a network connection.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest-v1",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts CSS + woff2 — stable for a year, safe to cache forever.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-v2",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Analytics — never cache, always network-only.
            urlPattern: /^https:\/\/www\.googletagmanager\.com\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },

      // Disable SW in Vite dev server — HMR already handles live reloads.
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
