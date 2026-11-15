
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: "0.0.0.0",
    allowedHosts: ["learn-loop.up.railway.app"],

    proxy: {
      "/api": {
        target:
          process.env.API_UPSTREAM ||
          "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
