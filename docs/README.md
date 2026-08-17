# Documentación de `arcane-mcp`

Punto de entrada a la documentación del fork. Toda documentación nueva se
enlaza desde aquí.

## Arquitectura

- [Criterio de exposición](arquitectura/criterio-exposicion.md) — **documento vivo**:
  qué expone este fork y qué no, con los tres motivos de exclusión (radio de daño,
  infraestructura inexistente, destrucción de evidencia), las cifras medidas y el
  denominador honesto de cobertura (249 operaciones, no 347). Releva a la §2 del
  spec de F2 como referencia.

## Desarrollo

- [Cómo añadir una tool](desarrollo/anadir-una-tool.md) — procedimiento estándar
  para F2–F5: localizar el endpoint en el spec, tipar, implementar, registrar,
  verificar (unitario + e2e) y publicar.

## Balances de fase

- [F2 (observabilidad y núcleo del host) — 2026-08-17](balances/2026-08-16-f2.md)
  — 13 tools nuevas, cinco defectos de fidelidad al spec cazados por la revisión,
  una contradicción interna del plan, un test tautológico corregido, un bug del
  upstream diagnosticado y las cifras medidas (144 tests, 19 e2e, 81 tools,
  78/347 operaciones cubiertas).
- [F0 (cimientos) + F1 (visibilidad) — 2026-08-16](balances/2026-08-16-f0-f1.md)
  — qué se entregó, los tres hallazgos que no estaban en el plan, los datos heredados
  que resultaron falsos, y qué queda pendiente antes de F2.

## Auditorías

- [Drift de campos vs Arcane v2.7.0 (2026-08-16)](auditorias/2026-08-16-drift-campos-v2.7.0.md)
  — desalineaciones entre las interfaces TypeScript y los schemas del spec, y su resolución.
- [Actualización a Arcane 2.8.0 (2026-08-16)](auditorias/2026-08-16-actualizacion-arcane-2.8.0.md)
  — causa raíz del redeploy de GitOps roto, su arreglo, y las 9 operaciones que 2.8.0
  elimina (2 de ellas en uso, migradas de `/browse` a `/workspace`).

### Issues publicados en el upstream

- [Paginación sin `sort` pierde elementos (2026-08-17)](auditorias/2026-08-17-paginacion-sin-sort-upstream.md)
  — recorrer una colección con `start` sin orden explícito devuelve un conjunto
  incompleto y no determinista. Es el motivo de que `collectAllPages` exija `sort`.
  Publicado como [#3645](https://github.com/getarcaneapp/arcane/issues/3645).
  Verificado antes de publicar: se reproduce en `volumes` (18–28 de 32) y en
  `networks` (7–10 de 13), **no** en `containers`, `projects`, `gitops-syncs` ni
  `images`, al contrario de lo que decía el borrador.
- [`image_update_check` falla siempre (2026-08-17)](auditorias/2026-08-17-image-update-check-arcane-local-upstream.md)
  — Arcane no reconoce como locales las imágenes que ella misma etiqueta con el
  prefijo `arcane.local/`, así que el job programado falla en todas sus ejecuciones.
  No bloquea F3: los datos de actualizaciones sí llegan.
  Publicado como [#3640](https://github.com/getarcaneapp/arcane/issues/3640), con
  un comentario que precisa el mecanismo real (desajuste con `build_image_refs_json`,
  no el prefijo en sí).

## Specs y planes

- [Spec F0 + F1 (2026-08-16)](superpowers/specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md)
  — decisión de no migrar a RandomSynergy17/Arcane-MCP-Server, y alcance de
  F0 (cimientos) y F1 (visibilidad).
- [Spec F2 (2026-08-16)](superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md)
  — observabilidad y núcleo del host: 13 tools de activities, events, jobs y system.
  Fija además el criterio de exposición que rige de F2 a F5.
- [Plan F2 (2026-08-16)](superpowers/plans/2026-08-16-fork-arcane-mcp-f2.md)
  — 7 tareas con ciclo TDD paso a paso, de los cimientos del cliente al cierre de fase.
- [Plan F0 + F1 (2026-08-16)](superpowers/plans/2026-08-16-fork-arcane-mcp-f0-f1.md)

## Operación

| Comando | Para qué |
|---|---|
| `npm test` | Suite unitaria (sin red ni credenciales) |
| `npm run test:e2e` | Verificación contra la instancia Arcane real |
| `npm run type-check` | Comprobación de tipos |
| `npm run update-api-spec` | Refresca `openapi.txt` desde la instancia |
| `npm run gen-tools-table` | Regenera la tabla de tools del `README.md` desde `src/tools/` (`-- --check` falla si está desactualizada) |
| `node scripts/audit-schema-drift.mjs` | Audita el drift de campos |
