# Criterio de exposición

**Documento vivo.** Es la referencia de qué expone este fork y qué no. Releva a la
§2 del [spec de F2](../superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md),
que sigue siendo válida como registro histórico de cuándo se decidió cada cosa.

- **Última revisión:** 2026-08-17
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)

---

## 1. El criterio

> **Se expone lo que opera cargas de trabajo Docker y su observabilidad. De la
> administración del propio Arcane se exponen las lecturas, nunca las escrituras.**

Se decidió en F2, antes de listar ninguna tool, porque condiciona todas las fases
siguientes. Sigue vigente sin cambios.

## 2. Qué queda fuera, y por qué

Tres motivos distintos. Conviene no mezclarlos: uno es de seguridad, otro de
realidad física, y el tercero de utilidad.

### 2.1 Radio de daño — 47 operaciones

Las **escrituras** de `auth`, `oidc`, `users`, `roles`, `api-keys` y
`federated-credentials`. Son las llaves del castillo: no aportan nada a la tarea de
gestionar Docker, y un cliente MCP comprometido podría con ellas dejar al propietario
fuera de su propia instancia.

| Dominio | Lecturas (admitidas) | Escrituras (excluidas) |
|---|---|---|
| `auth` | 5 | 27 |
| `oidc` | 3 | 7 |
| `users` | 4 | 4 |
| `roles` | 3 | 3 |
| `api-keys` | 2 | 3 |
| `federated-credentials` | 2 | 3 |
| **Total** | **19** | **47** |

**Las 19 lecturas sí se admiten**, para poder diagnosticar «por qué falla este
permiso», con la contrapartida asumida de que su contenido entra en el contexto del
modelo.

> **Corrección de una cifra publicada.** El spec de F2 §2 dice «66 operaciones» al
> describir esta exclusión. Son 66 en total, pero solo **47 son escrituras**; las
> otras 19 son lecturas que ese mismo spec admite explícitamente. El número mezclaba
> lo excluido con lo admitido.

### 2.2 Infraestructura que no existe — 51 operaciones

Todo el dominio `swarm`. Es el mayor bloque de la API por número de operaciones,
mayor que F3, F4 y F5 juntas.

**Motivo medido el 2026-08-17:** ninguno de los seis entornos que gestiona esta
instancia tiene Swarm activo. Los seis responden lo mismo:

```
HTTP 409 — {"title":"Conflict","detail":"Swarm mode is not enabled"}
```

**La consecuencia es la que decide, no el 409 en sí.** La regla dura de este proyecto
—recogida en [Cómo añadir una tool](../desarrollo/anadir-una-tool.md)— exige que
ninguna tool se dé por terminada sin comprobación e2e contra la instancia real. Para
`swarm` esa comprobación no es posible en ningún entorno: los e2e darían 409 antes de
ejercitar nada. Serían 51 operaciones verificadas únicamente contra mocks escritos por
nosotros mismos.

Ese riesgo no es teórico en este proyecto. En F2, dos discrepancias entre los mocks
unitarios y la API real aparecieron **solo** al ejecutar los e2e: `activities.cancel`
rechaza con HTTP 409 donde el mock asumía `{success:false}`, y `system.health` devuelve
500 de forma reproducible donde el mock asumía 200. Sin e2e, ninguna de las dos se
habría detectado.

### 2.3 Destruyen evidencia, o son masivas

De [F2 §3.5](../superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md):

| Operación | Motivo |
|---|---|
| `DELETE /events/{eventId}` | Borra el rastro de auditoría: destruye justo la evidencia que la fase de observabilidad existe para poder leer |
| `DELETE /environments/{id}/activities/history` | Íd. |
| `POST .../system/containers/{start-all,stop-all,start-stopped}` | Acciones masivas: un `stop-all` mal disparado tumba todos los contenedores del host, incluido el propio Arcane |
| `GET /environments/{id}/version` | Redundante con `arcane_version`. YAGNI |

### 2.4 Diferido, no excluido — 24 operaciones y tres parámetros

No es lo mismo «fuera para siempre» que «todavía no». Nada de esto se descuenta del
denominador de la §3, porque son operaciones que este fork sí pretende poder cubrir
algún día:

| Qué | Cuánto | Cuándo |
|---|---|---|
| `webhooks` (4), `notifications` (6), `updater` (3), `settings` (5), `deployment`/mTLS (3), `dashboard` (1), `diagnostics` (2) | **24 operaciones** | Fase propia si se justifica. Son configuración persistente y superficie de agente, no observabilidad |
| `updates` en `containers`, `images` y `projects` | 3 parámetros de query | F3 — depende del comprobador de actualizaciones, que hoy falla en la instancia |
| `ImageSummary.usedBy`, `Project.updateInfo` | 2 campos diferidos en la auditoría de drift | F3 |
| `groupBy` en `containers` | 1 parámetro de query | Sin asignar: añade una clave `groups` a la respuesta y necesita su propio tipo y formateo |

## 3. El denominador honesto

Publicar la cobertura sobre las 347 operaciones del spec compara el avance contra una
API que incluye lo que nunca se va a tocar.

```
  347  operaciones en openapi.txt
 − 51  swarm (infraestructura inexistente, §2.2)
 − 47  escrituras de administración de Arcane (radio de daño, §2.1)
 ────
  249  operaciones que este fork pretende poder cubrir
```

**Los balances futuros publican `78 de 249` explicando el denominador**, no `78 de
347`. Ambas cifras son ciertas; la segunda subestima el avance en un tercio y no dice
nada útil sobre lo que queda por hacer.

El `78 de 347` que aparece en el README y en balances ya escritos se deja como está:
es cierto, y reescribir documentos cerrados para cambiar un denominador introduciría
más ruido que claridad.

## 4. Qué haría falta para reabrir `swarm`

Un entorno con Swarm activo sobre el que ejecutar e2e. Basta un cluster de un solo
nodo (`docker swarm init` es reversible con `docker swarm leave --force` y no altera
los contenedores standalone), preferiblemente en un host secundario y no en el que
corre la carga real.

Con eso, `swarm` deja de estar excluido por §2.2 y pasa a ser una fase más, a decidir
por tamaño: 51 operaciones son demasiadas para una sola fase y habría que partirlas
—`nodes` (12), `stacks` (9), `services` (8), `configs` y `secrets` (4 cada uno), y el
ciclo de vida del cluster (`init`, `join`, `leave`, `unlock`…)—, aplicándoles el mismo
criterio de §1: el ciclo de vida del cluster es administración, no carga de trabajo.

## 5. Cómo reproducir las cifras de este documento

Reparto de operaciones y denominador:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
const M=['get','post','put','delete','patch','head'];
const ADMIN=['auth','oidc','users','roles','api-keys','federated-credentials'];
const dom=p=>{const g=p.split('/').filter(Boolean);return (g[0]==='environments'&&g.length>=3)?g[2]:g[0];};
let total=0,swarm=0,adminL=0,adminE=0;
for(const p of Object.keys(s.paths)) for(const m of M){ if(!s.paths[p][m])continue; total++;
  const d=dom(p);
  if(d==='swarm') swarm++;
  if(ADMIN.includes(d)) (m==='get'||m==='head')?adminL++:adminE++;
}
console.log('total='+total+' swarm='+swarm+' adminLect='+adminL+' adminEscr='+adminE);
console.log('denominador='+(total-swarm-adminE));
"
```

Estado de Swarm en todos los entornos — **el día que esto deje de dar 409 en alguno,
la exclusión de §2.2 hay que revisarla**:

```bash
set -a; . ./.dev.vars; set +a
B=http://192.168.180.210:3552/api
for id in $(curl -s -H "X-API-Key: $ARCANE_API_KEY" "$B/environments?limit=50" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.map(e=>e.id).join(' ')))"); do
  printf "%-40s " "$id"
  curl -s --max-time 40 -H "X-API-Key: $ARCANE_API_KEY" "$B/environments/$id/swarm/info" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.detail||'SWARM ACTIVO')}catch(e){console.log('sin respuesta')}})"
done
```

## 6. Referencias

- [Spec de F2 — donde se decidió el criterio](../superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md)
- [Cómo añadir una tool — la regla dura de verificación](../desarrollo/anadir-una-tool.md)
- [Balance de la coherencia de listado](../balances/2026-08-17-coherencia-listado.md)
