import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // dev local: API dockerizada exposta em 4003 (ou tsx local em 3001)
      "/api": {
        target: process.env["VITE_API_URL"] ?? "http://localhost:4003",
        changeOrigin: true,
      },
    },
  },
});
