import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests son unitarios puros: mockean `globalThis.fetch` y no tocan
    // ninguna API de Workers (nadie importa "cloudflare:test"). El pool node
    // por defecto basta y nos libera de la restricción de versiones que
    // imponía @cloudflare/vitest-pool-workers.
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
