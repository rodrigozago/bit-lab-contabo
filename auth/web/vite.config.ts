import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    // porta default do Vite (5173) — 3006 é a porta do container `web` em
    // produção (docker-compose), deixa livre pra não confundir os dois.
    proxy: {
      "/api": "http://localhost:4000",
      "/admin": "http://localhost:4000",
      "/login": "http://localhost:4000",
      "/signup": "http://localhost:4000",
      "/logout": "http://localhost:4000",
      "/media": "http://localhost:4000",
    },
  },
});
