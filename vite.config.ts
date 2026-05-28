import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // In dev, forward all backend routes to the local FastAPI server.
      // This avoids CORS entirely during development.
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/stream": { target: "http://localhost:8000", changeOrigin: true },
      "/cic-stream": { target: "http://localhost:8000", changeOrigin: true },
      "/login": { target: "http://localhost:8000", changeOrigin: true },
      "/auth": { target: "http://localhost:8000", changeOrigin: true },
      "/logout": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
