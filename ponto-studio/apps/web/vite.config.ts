import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "happy-dom",
    // node-linker=hoisted duplica react na raiz e no app; os testes precisam
    // usar a mesma cópia que o @testing-library/react (raiz) resolve via Node.
    alias: {
      react: resolve(__dirname, "../../node_modules/react"),
      "react-dom": resolve(__dirname, "../../node_modules/react-dom"),
    },
  },
  resolve: {
    alias: {
      "@ponto-studio/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // API do docker compose local (127.0.0.1:4001 → api:3001)
      "/api": "http://localhost:4001",
      "/exports": "http://localhost:4001",
      "/uploads": "http://localhost:4001",
    },
  },
});
