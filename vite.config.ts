/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Percorsi relativi: la build funziona sia in locale sia su GitHub Pages
  // (lucabruno91.github.io/poker-tracker/); il routing è tutto nell'hash.
  base: "./",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
  },
});
