# Documentación de `arcane-mcp`

Punto de entrada a la documentación del fork. Toda documentación nueva se
enlaza desde aquí.

## Arquitectura

- [Criterio de exposición](arquitectura/criterio-exposicion.md) — **documento vivo**:
  qué expone este fork y qué no, con los cuatro motivos de exclusión (radio de daño,
  infraestructura inexistente, destrucción de evidencia, y desde F5 el secreto que el
  modelo tendría que redactar), las cifras medidas y el denominador honesto de
  cobertura (244 operaciones, no 347). Releva a la §2 del spec de F2 como referencia.

## Desarrollo

- [Cómo añadir una tool](desarrollo/anadir-una-tool.md) — procedimiento estándar
  para F2–F5: localizar el endpoint en el spec, tipar, implementar, registrar,
  verificar (unitario + e2e) y publicar.

## Balances de fase

- [F5 (build y registries) — 2026-08-19](balances/2026-08-19-f5.md)
  — 16 de 17 tools previstas sobre registros de contenedor, registros de plantillas, el
  workspace de builds y la construcción de imágenes/proyectos; la 17.ª
  (`arcane_build_workspace_upload`) queda diferida por imposibilidad medida de
  verificación e2e en cualquier entorno. La mayoría de los hallazgos de esta fase
  vienen del propio plan, no del código: una afirmación falsa sobre el spec, un
  ejemplo que violaba tres restricciones propias, y una mutación de falsabilidad que no
  falsificaba nada. Cifras medidas: 376 tests, 76 e2e, 116 tools, 113/244 operaciones
  cubiertas.
- [F4 (vulnerabilidades) — 2026-08-19](balances/2026-08-19-f4.md)
  — doce tools sobre el Trivy que integra Arcane, con la siembra de datos dentro de
  la propia suite e2e para resolver el problema de las 0 imágenes escaneadas. Destapa
  y arregla tres bugs que ya estaban en producción, entre ellos una inyección de ruta
  introducida durante la fase. Cifras medidas: 294 tests, 59 e2e, 100 tools,
  98/249 operaciones cubiertas.
- [F3 (actualizaciones de imágenes) — 2026-08-17](balances/2026-08-17-f3.md)
  — siete tools nuevas (estado de actualizaciones e imágenes, y `updater` con
  `resourceIds` obligatorio), cierre de las tres deudas diferidas por F2
  (`usedBy`, `updateInfo`, el filtro `updates`), y las cifras medidas (262
  tests, 46 e2e, 88 tools, 86/249 operaciones cubiertas).
- [Coherencia de la superficie de listado — 2026-08-17](balances/2026-08-17-coherencia-listado.md)
  — uniforma el contrato de salida de las trece tools `_list`, corrige un bug
  de paginación sin `sort` en Arcane 2.8.0 (publicado upstream) y deja 228
  tests unitarios y 36 e2e en verde.
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

### Issues investigados, sin publicar

- [`hasBuildDirective` siempre es `false` en `GET /projects/{id}` y en el listado (2026-08-19)](auditorias/2026-08-19-has-build-directive-upstream.md)
  — causa raíz identificada contra el código fuente de Arcane 2.8.0: el endpoint que
  expone el campo nunca activa el cálculo que sí usan `/compose`, `/updates` y el
  `PUT`. Reproducido hoy con cuatro proyectos reales. Redactado y listo para publicar;
  la decisión de abrirlo en el repositorio de un tercero es del propietario.

### Issues publicados en el upstream

- [`hasBuildDirective` siempre es `false` (2026-08-19)](auditorias/2026-08-19-has-build-directive-upstream.md)
  — cuatro proyectos con `build:` de servicio verificado en el fichero que la propia API
  declara como su `composeFileName`, y los cuatro con el campo a `false`; ninguno de los
  22 proyectos de los seis entornos lo tiene a `true`. Causa raíz confirmada contra el
  código de Arcane 2.8.0. Publicado como
  [#3685](https://github.com/getarcaneapp/arcane/issues/3685). Es el motivo de que la
  descripción de `arcane_project_build` diga explícitamente que no se filtre por él.

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

- [Spec F5 (2026-08-19)](superpowers/specs/2026-08-19-f5-build-y-registries-design.md)
  — build y registries: registros de contenedor, registros de plantillas, el workspace
  de builds y la construcción de imágenes/proyectos; la diferida de
  `arcane_build_workspace_upload` medida en su §3.1.
- [Plan F5 (2026-08-19)](superpowers/plans/2026-08-19-f5-build-y-registries.md)
  — 9 tareas con ciclo TDD paso a paso, de los tipos bajo auditoría de drift al cierre
  de fase.
- [Spec F4 (2026-08-18)](superpowers/specs/2026-08-18-f4-vulnerabilidades-design.md)
  — vulnerabilidades: siembra de escaneo, listados y detalle, y el par
  ignore/unignore con motivo obligatorio.
- [Plan F4 (2026-08-18)](superpowers/plans/2026-08-18-f4-vulnerabilidades.md)
  — 8 tareas con ciclo TDD paso a paso, de los tipos bajo auditoría de drift al cierre de fase.
- [Spec F3 (2026-08-17)](superpowers/specs/2026-08-17-f3-actualizaciones-imagenes-design.md)
  — actualizaciones de imágenes: qué está desactualizado, qué se rompería al
  actualizar y la tool mutante acotada verificada con `dryRun`.
- [Plan F3 (2026-08-17)](superpowers/plans/2026-08-17-f3-actualizaciones-imagenes.md)
  — dos ficheros de tools nuevos sobre dos clases de métodos del cliente, y tres
  deudas de F2 cerradas de paso.
- [Spec de coherencia de la superficie de listado (2026-08-17)](superpowers/specs/2026-08-17-coherencia-superficie-listado-design.md)
  — deuda previa a F3: las 13 tools de listado aceptan el juego de parámetros
  que el spec declara para su endpoint y devuelven la paginación.
- [Plan de coherencia de la superficie de listado (2026-08-17)](superpowers/plans/2026-08-17-coherencia-superficie-listado.md)
  — helpers compartidos (`withErrors`, `listResponse`, `collectAllPages`) y los
  resolvers nombre→id dejan de mirar solo la primera página.
- [Spec F2 (2026-08-16)](superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md)
  — observabilidad y núcleo del host: 13 tools de activities, events, jobs y system.
  Fija además el criterio de exposición que rige de F2 a F5.
- [Plan F2 (2026-08-16)](superpowers/plans/2026-08-16-fork-arcane-mcp-f2.md)
  — 7 tareas con ciclo TDD paso a paso, de los cimientos del cliente al cierre de fase.
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
| `npm run gen-tools-table` | Regenera la tabla de tools del `README.md` desde `src/tools/` (`-- --check` falla si está desactualizada) |
| `node scripts/audit-schema-drift.mjs` | Audita el drift de campos |
| `./scripts/e2e-remoto.sh` | Ejecuta la suite e2e desde `vm-control`, en la LAN de Arcane (evita el 16,7 % de caídas de Tailscale) |
