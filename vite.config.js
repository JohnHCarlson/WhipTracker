import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5173,
    strictPort: true,
    // The API runs separately in development (`npm run dev` starts both). It checks that
    // changes come from the page's own host, so the Host header passes through unchanged.
    proxy: { "/api": { target: "http://127.0.0.1:3102", changeOrigin: false } },
  },
  // The server's tests run under Node's own test runner (npm test runs both).
  test: { include: ["src/**/*.test.js"] },
});
