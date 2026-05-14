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
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.png", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "Nexis",
        short_name: "Nexis",
        description: "All-in-one POS, inventory, invoicing and analytics for Ghanaian businesses.",
        theme_color: "#1a3a22",
        background_color: "#1a3a22",
        display: "standalone",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          { src: "/pwa-192.png",          sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png",          sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png",          sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Supabase API — NetworkFirst so fresh data is preferred,
            // but cached data serves when offline
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — CacheFirst (rarely changes)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
