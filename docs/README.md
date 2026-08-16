# Documentación de `arcane-mcp`

Punto de entrada a la documentación del fork. Toda documentación nueva se
enlaza desde aquí.

## Desarrollo

- [Cómo añadir una tool](desarrollo/anadir-una-tool.md) — procedimiento estándar
  para F2–F5: localizar el endpoint en el spec, tipar, implementar, registrar,
  verificar (unitario + e2e) y publicar.

## Auditorías

- [Drift de campos vs Arcane v2.7.0 (2026-08-16)](auditorias/2026-08-16-drift-campos-v2.7.0.md)
  — desalineaciones entre las interfaces TypeScript y los schemas del spec, y su resolución.

## Specs y planes

- [Spec F0 + F1 (2026-08-16)](superpowers/specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md)
  — decisión de no migrar a RandomSynergy17/Arcane-MCP-Server, y alcance de
  F0 (cimientos) y F1 (visibilidad).
- [Plan F0 + F1 (2026-08-16)](superpowers/plans/2026-08-16-fork-arcane-mcp-f0-f1.md)

## Operación

| Comando | Para qué |
|---|---|
| `npm test` | Suite unitaria (sin red ni credenciales) |
| `npm run test:e2e` | Verificación contra la instancia Arcane real |
| `npm run type-check` | Comprobación de tipos |
| `npm run update-api-spec` | Refresca `openapi.txt` desde la instancia |
| `node scripts/audit-schema-drift.mjs` | Audita el drift de campos |
