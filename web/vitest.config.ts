import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Uji alur aplikasi (React di jsdom) terhadap server API & PostgreSQL sungguhan.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 90000,
    hookTimeout: 120000,
    env: { VITE_API_URL: "http://127.0.0.1:4555/api" },
  },
});
