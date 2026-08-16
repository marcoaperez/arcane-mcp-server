# Spec — Evolución del fork `arcane-mcp`: F0 (Cimientos) + F1 (Visibilidad)

- **Fecha:** 2026-08-16
- **Repos:** `taiko-solutions/arcane-mcp` (Gitea, `origin`) · `marcoaperez/arcane-mcp-server` (GitHub, `github`) · `cougz/arcane-mcp-server` (`upstream`)
- **Casa de desarrollo:** `~/GITs/Arcane-MCP`
- **Estado:** aprobado, pendiente de plan de implementación

---

## 1. Contexto

El fork nació de `cougz/arcane-mcp-server`. Tras arreglar un bug de parseo NDJSON que
bloqueaba el deploy autónomo, se evaluó si migrar a la alternativa
`RandomSynergy17/Arcane-MCP-Server` (RS, 180 tools). **Se decidió NO migrar.**

### Evidencia que sustenta la decisión

| Hecho | Medición |
|---|---|
| Arcane en producción | **v2.7.0** (spec live: 268 paths) |
| RS está escrito contra | **Arcane v1.17.0** |
| RS contra nuestro v2.7.0 | **10 de 14** tools de lectura degradadas: `container_list` devuelve nombres `undefined`, `network_list` `Driver: null`, `system_get_docker_info` **404** |
| Nuestro fork contra v2.7.0 | **37/37 rutas válidas**, cero ausentes |
| PR #7 de RS ("Arcane v2 support", +20.846/−11.755) | abierto desde 2026-07-11, **cero comentarios del mantenedor** |
| PRs externos mergeados en RS | **ninguno, jamás** (los de dependabot, cerrados sin merge) |
| Issue #6 de RS (jun-2026) | sin respuesta |
| `cougz` (upstream original) | `main` = commit `test`, 0★, 0 PRs, inactivo desde mar-2026 |

**Conclusión:** RS tiene más superficie pero apunta a una API que ya no tenemos, y su
mantenedor lleva ~3 meses sin atender contribuciones. Nuestro fork es el único código
verificado contra Arcane v2.7.0.

### Estrategia adoptada

1. El fork es **producto propio de Taiko**, no un derivado a la espera de upstream.
2. RS se usa como **catálogo de ideas** (qué tools merece tener), nunca como código a copiar.
3. Se publican PRs a `cougz` como **señal de actividad pública**, sin que nada dependa de ellos.

---

## 2. Objetivos y alcance

**F0 — Cimientos:** dejar el proyecto en estado verificable antes de añadir nada.
**F1 — Visibilidad:** que el fork se vea vivo y mantenido desde fuera.

### Fuera de alcance (explícito)

- Migrar a RS o adoptar su código.
- Incorporar dominios nuevos de tools (eso es F2–F5).
- Rediseñar la arquitectura del cliente o el transporte MCP.
- Arreglar o rescatar `cougz`.

---

## 3. F0 — Cimientos

### F0.1 · Llevar el fix NDJSON a producción
La rama `fix/up-redeploy-ndjson-parsing` (`eb866b6`) arregla `arcane_stack_start` y
`arcane_project_redeploy` (parseo NDJSON de `/up` y `/redeploy`). **Está publicada pero
NO en `main`: producción sigue con el bug.**

⚠️ **`arcane-mcp` está gestionado por GitOps con `autoSync=True` sobre `main`.** Mergear
y empujar a `main` **despliega automáticamente**. Debe hacerse de forma deliberada y
verificando el resultado tras el despliegue.

*Aceptación:* fix en `main`, desplegado, y `arcane_stack_start` verificado contra un
stack idempotente real.

### F0.2 · Refrescar el spec de la API a v2.7.0
`openapi.txt` está en **v1.14.1** (140 paths) mientras la instancia corre **v2.7.0**
(268 paths). Codificar contra un spec 3 versiones viejo es exactamente el fallo que
hundió a RS.

- Descargar de `http://192.168.180.210:3552/api/openapi.json`.
- Añadir un script npm (`update-api-spec`) que documente y repita el procedimiento.

*Aceptación:* `openapi.txt` = v2.7.0 y el script funciona.

### F0.3 · Auditoría de campos (drift v1→v2)
Los *paths* ya están validados (37/37), pero **los shapes no**. El fallo de RS fue de
campos (`names`, contadores, `driver`), no de rutas. Comparar las interfaces TS de
`src/arcane-client.ts` contra los schemas del spec v2.7.0 y listar desalineaciones.

*Aceptación:* informe escrito de drift (tool → campo → estado), y corrección de lo que
esté roto.

### F0.4 · Reparar el runner de tests
`vitest@4.0.18` y `@cloudflare/vitest-pool-workers@0.12.14` son incompatibles: `npm test`
**no arranca**. Sin esto no hay verificación posible — es prerrequisito duro, no cosmético.

Opciones a evaluar: fijar `vitest` a `~3.2` compatible con el pool, o separar los unit
tests puros (`arcane-client`, `resolve`, `tools`) a un pool node y reservar
`pool-workers` solo para lo que necesite runtime de Workers.

*Aceptación:* un único comando ejecuta toda la suite en verde.

### F0.5 · Documentar el patrón "cómo añadir una tool"
Dejar por escrito el flujo que seguirán F2–F5.

---

## 4. F1 — Visibilidad

### F1.1 · README de fork mantenido
Declarar: fork activo, **compatible con Arcane v2.x**, en qué diverge del upstream, y
cómo se despliega.

### F1.2 · Un único PR quirúrgico a `cougz`
Contenido: el fix NDJSON de `/up` y `/redeploy` **y también `/pull`** (que el upstream
igualmente tiene roto). Autocontenido, con reproducción y tests.

- **Expectativa declarada: no se va a mergear.** El valor es la señal pública y quedar
  como fork de referencia. Un PR gigante con dominios nuevos nadie lo revisa.

### F1.3 · Publicación en GitHub — ✅ hecho (2026-08-16)
`main` actualizado (`fd9602e` → `e367f0b`) y rama del fix publicada. Escaneo de secretos
sobre 38 commits: limpio, sin ficheros sensibles ni credenciales.

---

## 5. Decisiones de diseño

1. **Fuente de verdad = spec v2.7.0 en vivo, no el código de RS.** RS apunta a v1;
   copiarlo importaría sus bugs. Ambos proyectos son MIT, así que la restricción es
   técnica, no legal.
2. **El streaming NDJSON es ciudadano de primera.** Todo endpoint que devuelva
   `application/x-json-stream` va por `requestNdjson()` + un agregador tipo
   `summarizeComposeStream()`. Se detectan en el spec porque declaran `content` vacío.
   Shape conocido: `{type,activityId}` / `{log}` / `{done:true}` / `{error}`.
3. **Convención de nombres:** `arcane_<dominio>_<acción>`.
4. **Regla dura de verificación:** ninguna tool nueva sin test unitario (con `fetch`
   mockeado) **y** sin comprobación contra la instancia v2.7.0 real. Las de lectura, e2e
   directo; las mutantes, sobre stacks idempotentes (p. ej. `ical-bridge`).
5. **Todo el trabajo va en ramas.** `main` auto-despliega; nunca commits sueltos ahí.

---

## 6. Fases posteriores (spec propio cada una)

| Fase | Dominio | Tools aprox. |
|---|---|---|
| F2 | System + Events/Jobs | ~16 |
| F3 | Actualizaciones de imágenes | ~9 |
| F4 | Vulnerability scanning | ~12 |
| F5 | Build + Registries | ~14 |

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| `main` auto-despliega por GitOps | Trabajo en ramas; merge deliberado y verificado |
| Drift de campos v1→v2 en las 68 tools actuales | F0.3 lo mide antes de construir encima |
| Sin runner de tests no hay verificación | F0.4 es prerrequisito de F2–F5 |
| El spec live puede cambiar al actualizar Arcane | Script `update-api-spec` + re-auditoría |

---

## 8. Estado de artefactos

- `~/GITs/Arcane-MCP` — casa de desarrollo; remotos `origin`/`github`/`upstream`.
- Rama `fix/up-redeploy-ndjson-parsing` (`eb866b6`) — en Gitea y GitHub, **pendiente de `main`**.
- Trial de RS — contenedor eliminado; receta reproducible en `~/docker/arcane-mcp-rs-trial/`.
- Nota de decisión en el vault: `Proyectos/Taiko/Infraestructura de gestión de servidores/Arcane-MCP/04-Decisión-Base-MCP-Fork-vs-RS.md`.
- `~/docker/arcane-mcp-server` — copia previa de trabajo; decidir su retirada más adelante.
