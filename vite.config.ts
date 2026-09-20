import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "./server/env.ts";

loadEnv();

// In dev the client talks only to our own server (which in turn is the sole
// consumer of the board's API). Set BOARD_URL for the server, not here.
const serverPort = process.env.PORT ?? "3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
});
