import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
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
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
      "/exports": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
});
