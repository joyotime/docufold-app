import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: ["es2018", "safari14"],
    chunkSizeWarningLimit: 1400,
  },
  worker: {
    format: "es",
  },
});
