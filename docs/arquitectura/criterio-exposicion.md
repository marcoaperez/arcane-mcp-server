# Criterio de exposición

**Documento vivo.** Es la referencia de qué expone este fork y qué no. Releva a la
§2 del [spec de F2](../superpowers/specs/2026-08-16-fork-arcane-mcp-f2-design.md),
que sigue siendo válida como registro histórico de cuándo se decidió cada cosa.

- **Última revisión:** 2026-08-19
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
| `GET /environments/{id}/builds/browse/download` | Redundante con `.../builds/browse/content` (F5): mismo fichero, la tool ya cubre la lectura de texto y el binario no aporta nada nuevo sobre MCP |

### 2.4 Diferido, no excluido — 21 operaciones y un parámetro

No es lo mismo «fuera para siempre» que «todavía no». Nada de esto se descuenta del
denominador de la §3, porque son operaciones que este fork sí pretende poder cubrir
algún día:

| Qué | Cuánto | Cuándo |
|---|---|---|
| `webhooks` (4), `notifications` (6), `settings` (5), `deployment`/mTLS (3), `dashboard` (1), `diagnostics` (2) | **21 operaciones** | Fase propia si se justifica. Son configuración persistente y superficie de agente, no observabilidad |
| `groupBy` en `containers` | 1 parámetro de query | Sin asignar: añade una clave `groups` a la respuesta y necesita su propio tipo y formateo |
| `POST /environments/{id}/builds/browse/upload` | 1 operación (F5) | Diferida — medido el 2026-08-19 que ningún entorno soporta las tres llamadas del flujo de subida (`POST /uploads/build-workspace`, subida de trozos y `POST .../builds/browse/upload`): local Docker (`0`) da 200 en `/uploads` y 500 `permission denied` en `/builds`; Zabbix da 404 en `/uploads` y 200 en `/builds`; los otros cuatro entornos dan 404 y 500. Son conjuntos disjuntos — ningún entorno gana las dos rutas a la vez, así que no hay e2e posible en ninguno. Reversible en cuanto uno las gane. **Sigue contando en el denominador**, como toda diferida |

> **F3 entregó las cuatro filas que antes estaban aquí:** las tres operaciones de
> `updater` (`status`, `history`, `run`), los tres parámetros `updates` en
> `containers`/`images`/`projects`, y los dos campos `ImageSummary.usedBy` /
> `Project.updateInfo` que la auditoría de drift señalaba como faltantes. Ya no son
> diferidos: siempre contaron en el denominador de la §3 (ver el preámbulo de
> esta sección), y ahora además cuentan en el numerador — están cubiertos.

### 2.5 El modelo tendría que redactar el secreto — 4 operaciones

`POST /container-registries`, `PUT /container-registries/{id}`, `DELETE
/container-registries/{id}` y `POST /container-registries/sync` quedan fuera. F5 solo
implementa las cuatro lecturas (`list`, `get`, `pull-usage`, `test`); ni las cuatro
escrituras ni sus métodos de cliente llegaron a escribirse.

El motivo no es el radio de daño de §2.1 — esto no es infraestructura de Arcane — sino
que la propia forma del contrato obliga a que el secreto pase por el contexto del
modelo. `CreateContainerRegistryRequest` exige `token` (y, para AWS,
`awsAccessKeyId`/`awsSecretAccessKey`) como campo **requerido** del cuerpo: para crear o
actualizar un registro, el modelo tiene que **redactar la credencial en texto plano**
como argumento de la llamada. Las lecturas, medido, no tienen esta propiedad: ni `list`
ni `get` devuelven `token` ni las claves de AWS — es la razón por la que sí se admiten
(la descripción de ambas tools lo declara).

Tres agravantes, todos medidos contra el spec:

- **`sync` es masivo.** `ContainerregistrySyncRequest.registries` es un array: una sola
  llamada puede reescribir la credencial de varios registros a la vez.
- **`update` puede vaciar la credencial.** El mismo campo `token` que crea el registro
  sirve para sobrescribirlo; no hay endpoint separado de solo-lectura para verificar
  que sigue siendo el que el propietario puso.
- **`delete` es irreversible por construcción.** No hay papelera ni confirmación en dos
  pasos: el registro desaparece y con él la configuración de acceso a ese repositorio.

## 3. El denominador honesto

Publicar la cobertura sobre las 347 operaciones del spec compara el avance contra una
API que incluye lo que nunca se va a tocar.

```
  347  operaciones en openapi.txt
 − 51  swarm (infraestructura inexistente, §2.2)
 − 47  escrituras de administración de Arcane (radio de daño, §2.1)
 −  4  escrituras de registro de contenedor (§2.5)
 −  1  builds/browse/download (redundante, §2.3)
 ────
  244  operaciones que este fork pretende poder cubrir
```

**Los balances publican la cobertura explicando el denominador** — a fecha de F4,
`98 de 249`, no `98 de 347`. Ambas cifras son ciertas; la segunda subestima el avance
en un tercio y no dice nada útil sobre lo que queda por hacer. El denominador baja de
249 a 244 en F5 por las dos filas nuevas de arriba: no es que el fork cubra menos, es
que el denominador se afina — las cuatro escrituras de §2.5 nunca iban a implementarse
y `builds/browse/download` nunca iba a añadir cobertura real sobre `.../content`.

Las cifras que aparecen en balances ya escritos se dejan como están: son ciertas en
el momento en que se midieron, y reescribir documentos cerrados cada vez que sube la
cobertura introduciría más ruido que claridad. Este documento en cambio es la
referencia viva: su cifra se actualiza en cada revisión (ver cabecera).

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

Reparto de operaciones y denominador (versión F5, con las dos filas nuevas de §2.5 y
§2.3 — sustituye al comando de F2/F4, que daba 249):

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
const M=['get','post','put','delete','patch','head'];
const ADMIN=['auth','oidc','users','roles','api-keys','federated-credentials'];
const dom=p=>{const g=p.split('/').filter(Boolean);return (g[0]==='environments'&&g.length>=3)?g[2]:g[0];};
const SECRETO=new Set(['POST /container-registries','PUT /container-registries/{id}','DELETE /container-registries/{id}','POST /container-registries/sync']);
const REDUNDANTE=new Set(['GET /environments/{id}/builds/browse/download']);
let total=0,swarm=0,adminE=0,secreto=0,redundante=0;
for(const p of Object.keys(s.paths)) for(const m of M){ if(!s.paths[p][m])continue; total++;
  const clave=m.toUpperCase()+' '+p, d=dom(p);
  if(d==='swarm'){swarm++;continue;}
  if(ADMIN.includes(d)&&!(m==='get'||m==='head')){adminE++;continue;}
  if(SECRETO.has(clave))secreto++;
  if(REDUNDANTE.has(clave))redundante++;
}
console.log('denominador='+(total-swarm-adminE-secreto-redundante));
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
