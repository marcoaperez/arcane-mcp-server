import { ArcaneClient } from "../arcane-client";

/**
 * Construye un ArcaneClient apuntando a la instancia real.
 * Falla con un mensaje accionable si faltan las variables de entorno,
 * en vez de dar un error de red críptico 30 segundos después.
 */
export function e2eClient(): ArcaneClient {
  const baseUrl = process.env.ARCANE_BASE_URL;
  const apiKey = process.env.ARCANE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Faltan ARCANE_BASE_URL y/o ARCANE_API_KEY.\n" +
        "Ejemplo:\n" +
        "  ARCANE_BASE_URL=http://192.168.180.210:3552 \\\n" +
        "  ARCANE_API_KEY=<clave> \\\n" +
        "  npm run test:e2e",
    );
  }
  return new ArcaneClient(apiKey, baseUrl);
}

/**
 * Stack sobre el que es seguro ejecutar acciones mutantes: levantarlo o
 * redesplegarlo repetidamente no tiene efectos observables fuera de sí mismo.
 */
export const IDEMPOTENT_STACK = process.env.ARCANE_E2E_STACK ?? "ical-bridge";
