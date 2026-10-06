import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only proxy: forwards any request under /v1 straight to the backend,
// which is running via Docker Compose on port 9000 (compose.yaml maps
// host 9000 -> container 4000) rather than the bare `npm run dev` port
// 4000. The backend now also has CORS configured (see backend/server.js
// and CORS_ORIGIN in backend/.env), so this proxy isn't strictly required
// anymore -- but it's still one less moving part in dev, and it keeps
// VITE_API_URL as a relative path so switching between Compose and a bare
// backend process is just this one line.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": "/src" },
  },
  server: {
    proxy: {
      "/v1": {
        target: "http://localhost:9000",
        changeOrigin: true,
      },
    },
  },
});
