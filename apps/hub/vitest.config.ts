import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Config Vitest dédiée aux tests de logique PURE du hub.
 *
 * Volontairement séparée de vite.config.ts : pas de plugin React, pas de
 * jsdom — on ne teste que des fonctions sans rendu ni Firebase. L'alias "@"
 * est répliqué pour rester cohérent avec les imports applicatifs.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
