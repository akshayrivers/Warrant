import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://warrant-1mia.onrender.com",
        changeOrigin: true,
      },
      "/health": {
        target: "https://warrant-1mia.onrender.com",
        changeOrigin: true,
      },
    },
  },
});
