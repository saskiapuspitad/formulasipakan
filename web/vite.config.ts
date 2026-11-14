import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["v1_master_data.json", "logo.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Sistem Formulasi Pakan — Ternak Unggas",
        short_name: "Formulasi Pakan",
        description: "Hitung campuran pakan termurah yang memenuhi kebutuhan gizi ternak.",
        theme_color: "#166534",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,png,svg,wasm}"],
        // Permintaan API selalu ke server (tidak di-cache service worker)
        navigateFallbackDenylist: [/^\/api\//],
      }
    })
  ],
  worker: { format: "es" },
  server: {
    // Saat pengembangan: teruskan /api ke server lokal (cd ../server && npm run dev)
    proxy: { "/api": { target: process.env.VITE_PROXY_API || "http://127.0.0.1:3000", changeOrigin: true } },
  }
});
