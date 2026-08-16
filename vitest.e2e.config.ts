import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Suite separada de la unitaria: toca una instancia Arcane real, necesita
    // credenciales y es lenta. `npm test` no la ejecuta nunca.
    include: ["src/__e2e__/**/*.e2e.ts"],
    environment: "node",
    // Un `docker compose up` que recrea contenedores puede tardar bastante.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Las acciones mutantes sobre el mismo stack no pueden solaparse.
    fileParallelism: false,
  },
});
