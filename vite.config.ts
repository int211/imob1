import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcsvite from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcsvite()],
  server: {
    port: 3000,
    host: "0.0.0.0"
  }
});
