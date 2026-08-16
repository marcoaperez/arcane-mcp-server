import { describe, it, expect, beforeAll } from "vitest";
import type { ArcaneClient, Project } from "../arcane-client";
import { e2eClient, IDEMPOTENT_STACK } from "./helpers";

describe("e2e: ciclo de vida de un stack contra Arcane real", () => {
  let client: ArcaneClient;
  let envId: string;
  let stackId: string;

  beforeAll(async () => {
    client = e2eClient();

    const envs = await client.environments.list();
    const first = envs.data?.[0];
    if (!first) throw new Error("La instancia no tiene ningún entorno");
    envId = first.id;

    const stacks = await client.stacks.list(envId, { search: IDEMPOTENT_STACK });
    const stack = stacks.data?.find((s: Project) => s.name === IDEMPOTENT_STACK);
    if (!stack) {
      throw new Error(
        `No existe el stack '${IDEMPOTENT_STACK}' en el entorno '${envId}'. ` +
          "Ajusta ARCANE_E2E_STACK a un stack idempotente existente.",
      );
    }
    stackId = stack.id;
  });

  it("la instancia corre Arcane v2.x", async () => {
    const version = await client.system.version();
    expect(version.currentVersion).toMatch(/^v2\./);
  });

  it("stacks.start() parsea el NDJSON de /up y devuelve éxito", async () => {
    const result = await client.stacks.start(envId, stackId);

    // Regresión del bug original: response.json() sobre un cuerpo NDJSON
    // reventaba con "Unexpected non-whitespace character after JSON...".
    expect(result.message).not.toMatch(/Unexpected non-whitespace/);
    expect(result.success).toBe(true);
  });

  it("projectAdditional.redeploy() parsea el NDJSON de /redeploy y devuelve éxito", async () => {
    const result = await client.projectAdditional.redeploy(envId, stackId);

    expect(result.message).not.toMatch(/Unexpected non-whitespace/);
    expect(result.success).toBe(true);
  });
});
