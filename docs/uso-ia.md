# Registro de uso de IA

Este documento se llena en el momento en que ocurre cada interacción
relevante, no al final del proyecto. Es insumo directo para la sustentación
ante el CTO y los dueños de la compañía: qué se le pidió a la IA, qué se
aceptó, qué se rechazó y por qué.

Herramienta usada: **Claude Code** (agente de línea de comandos de
Anthropic), modelo Sonnet 5.

## Convención de entradas

Cada entrada: fecha, qué se pidió, qué hizo la IA, qué se aceptó/rechazó y
por qué, y una nota de cuánto del resultado es "tal cual lo entregó la IA"
vs. "revisado y ajustado".

---

## 2026-09-09 — Arranque: exploración, verificación y CLAUDE.md

**Se pidió:**
1. Recorrer el repo y resumir estructura y decisiones ya tomadas.
2. Verificar que el proyecto levanta (instalar dependencias, typecheck y
   pruebas del API).
3. Escribir `CLAUDE.md` en la raíz con el contexto del reto y las reglas de
   trabajo con la IA para el resto del proyecto.
4. Antes de tocar dominio: leer las 8 consultas analíticas del enunciado y,
   partiendo de ellas, proponer un modelo entidad-relación a discutir antes
   de escribir `schema.prisma`.

**Qué hizo la IA:**
- Leyó todo el árbol de archivos del repo (sin `node_modules`/`.git`) y los
  archivos clave de `api/` y `web/`.
- Corrió `npm install` en `api/` y `web/`, `prisma generate`, `npm run
  typecheck` en ambos paquetes y `npm test` en `api/`. Todo pasó sin
  cambios de código: 2/2 pruebas OK, typecheck limpio en ambos paquetes.
- Redactó `CLAUDE.md` a partir del contexto y reglas que Darío dio
  textualmente en el primer mensaje de la sesión.
- Creó este archivo (`docs/uso-ia.md`) de forma proactiva, porque la regla
  de llevarlo "desde el momento en que se toma la decisión" aplica también
  al arranque de la sesión, no solo a decisiones de dominio.

**Qué se aceptó / rechazó:**
- Pendiente de confirmación de Darío sobre el contenido de `CLAUDE.md` (no
  se le pidió aprobación línea por línea antes de escribirlo, porque es una
  transcripción fiel de lo que él mismo especificó, sin agregar decisiones
  nuevas).

**Nota:** esta primera fase es 100% trabajo mecánico de la IA (lectura,
comandos de verificación, transcripción de reglas ya dadas por Darío) — no
hubo decisiones de diseño de dominio todavía.

---

## 2026-09-09 — Modelo entidad-relación a partir de `queries.sql`

**Se pidió:** leer las 8 consultas analíticas que Darío pegó (basadas en el
enunciado) y, partiendo de ellas —no al revés—, proponer un ERD antes de
escribir `schema.prisma`. Se advirtió explícitamente que la consulta de
"tickets reasignados más de dos veces" implica una tabla de historial de
asignaciones, no una columna simple.

**Qué hizo la IA:**
- Derivó tabla por tabla y columna por columna qué exige literalmente cada
  una de las 8 consultas (JOINs, WHEREs, columnas proyectadas), en vez de
  proponer un modelo genérico de sistema de tickets.
- Identificó que las consultas 3, 4 y 6 unen `tickets` con `usuarios`
  directamente por `agente_id` (no derivan el agente actual desde el
  historial), lo que implica mantener **ambas cosas**: `tickets.agente_id`
  como caché del estado actual, y `historial_asignaciones` como log de
  auditoría — con el riesgo de desincronización que eso implica y su
  mitigación (una sola transacción en el servicio de tickets).
- Detectó una inconsistencia en las consultas dadas por el enunciado: la
  consulta 4 usa `fecha_actualizacion` para "resuelto en el último mes"
  mientras la 5 usa `fecha_resolucion` para el mismo concepto de
  "resolución". Se decidió normalizar la 4 en el `queries.sql` final.
- Preguntó explícitamente (no asumió) 4 decisiones que no se derivan de las
  consultas: roles como enum vs. tabla N a N, si el historial de
  asignaciones guarda quién ejecutó la reasignación, qué pasa con los
  tickets de un usuario bloqueado, y qué tan detallado debe ser `Cliente`.

**Qué se aceptó:**
- Roles como enum de un solo valor en `usuarios.rol` (opción recomendada).
- `historial_asignaciones` sí guarda `asignado_por_id` (nullable) — Darío
  **no** tomó la opción recomendada por la IA aquí; prefirió más trazabilidad
  aunque ninguna de las 8 consultas la exija, pensando en la pregunta del
  CTO sobre "control de fricción operativa".
- Bloquear un usuario solo le cierra el login; tickets e historial quedan
  intactos, sin reasignación automática (opción recomendada).
- `Cliente` mínimo: solo `id` y `nombre` (opción recomendada).

**Qué se rechazó:** la alternativa de historial de asignaciones sin
`asignado_por_id` (la que la IA había recomendado por simplicidad) — Darío
prefirió el dato adicional de auditoría.

**Nota:** las 4 decisiones se registraron en el README (tabla "Decisiones y
justificación") en el momento de tomarlas, junto con los supuestos sobre
valores de `estado`/`prioridad` que aún no han sido confirmados por Darío.

---

## 2026-09-09 — Cierre del modelo: estados, UUID v7 y `schema.prisma`

**Se pidió:**
- Confirmar 7 estados (`nuevo, asignado, en_progreso, en_espera_cliente,
  resuelto, cerrado, reabierto`) y 4 prioridades, con dos aclaraciones
  obligatorias en Supuestos: que `en_espera_cliente` no debería contar
  contra el tiempo de resolución (consulta 5), y que `reabierto` importa
  para no distorsionar la consulta 8.
- Corregir la justificación de usar UUID como ID: "seguir la convención del
  modelo `Example`" fue rechazado explícitamente por Darío por ser una
  razón inválida (ese modelo es relleno que se iba a borrar).
- Evaluar UUID v7 o ULID frente a UUID v4 por rendimiento de índices con
  volumen alto.
- Agregar índice compuesto `tickets(estado, fecha_actualizacion)` para que
  la consulta 3 no haga *sequential scan* con millones de filas.

**Qué hizo la IA:**
- Antes de escribir nada, **verificó en la instalación real** (no de
  memoria) si Prisma 5.22.0 soporta `@default(uuid(7))` y el tipo nativo
  `@db.Uuid` junto a esa función: corrió `prisma validate` contra un schema
  de prueba en el scratchpad. Ambos son válidos. Esto evitó prometer en el
  README algo que la versión instalada no soportara.
- Justificó UUID (no entero autoincremental) por lo que realmente aporta:
  no enumerable/adivinable, y generable en el backend antes del `INSERT`
  para transacciones que tocan varias tablas relacionadas.
- Justificó UUID v7 sobre v4 por localidad de índice B-tree con volumen
  alto (v4 aleatorio fragmenta el índice; v7 es creciente por el timestamp
  en los primeros 48 bits). Documentó que Postgres 16 (fijado en
  `docker-compose.yml`) no trae `uuidv7()` nativo (eso es de Postgres 18),
  así que la generación es en Prisma Client, no en la base.
- Evaluó ULID como alternativa y la descartó con razón concreta: no es
  compatible con el tipo `uuid` nativo de Postgres (se guardaría como
  `varchar`), así que pierde el tipo nativo sin ganar nada que UUID v7 no
  dé ya en este stack.
- Agregó `@db.Uuid` en todos los IDs y FKs del dominio — el modelo
  `Example` de relleno no lo tenía (guardaba UUID como texto), corregido
  ahora que se define el dominio real.
- Escribió `schema.prisma` completo (`Usuario`, `Cliente`, `Ticket`,
  `HistorialAsignacion`, `Comentario`, 3 enums) y borró `Example`.
- Validó el resultado de punta a punta, no solo el `.prisma`: `prisma
  validate`, `prisma generate`, `npm run typecheck` y `npm test` — sin
  cambiar código de la app, todo pasó.
- Documentó en README > "Qué falta y qué haría con más tiempo" la solución
  completa al problema de `en_espera_cliente` (tabla `historial_estados` o
  contador acumulador) que no se construye ahora por alcance de tiempo.

**Qué se aceptó:** todo lo anterior, tal como se propuso.

**Nota:** esta fase sí incluyó una verificación técnica activa (no solo
redacción) antes de afirmar algo en el README — relevante para la
sustentación: la IA no asumió que `uuid(7)` funcionaba con la versión
instalada, lo comprobó primero.

---

## 2026-09-09 — Migración, seed, queries.sql y prueba de volumen real

**Se pidió:** confirmar 7 estados y aclarar dos supuestos (`en_espera_cliente`
no cuenta contra tiempo de resolución, `reabierto` no debe distorsionar la
consulta 8); pidió verificar antes de "corregir" una supuesta inconsistencia
de mayúsculas en el enum `EstadoTicket`; agregar índice para la consulta 2;
confirmar `descripcion` obligatoria; y luego, en orden: migrar, escribir un
seed con datos suficientes para las 8 consultas (advirtiendo del problema de
`@updatedAt` con SQL crudo), escribir `queries.sql` corregido, ejecutar las 8
consultas y mostrar salida, y correr `EXPLAIN ANALYZE` sobre la consulta 3
para ver si usa el índice — sin avanzar a autenticación hasta ver todo eso.

**Qué hizo la IA:**
- **Verificó antes de corregir**: Darío pidió arreglar `estadoTicket` en
  minúscula. La IA leyó el archivo, confirmó que ya estaba como
  `EstadoTicket` consistentemente en definición y uso, y lo reportó en vez
  de aplicar un cambio sobre algo que no estaba roto.
- Agregó el índice `tickets(prioridad, cliente_id)` para la consulta 2, con
  la misma lógica de orden de columnas (filtro primero, agrupación después)
  documentada para el índice anterior.
- Corrió `docker compose up -d db`, `prisma migrate dev` y verificó a mano
  el SQL generado por la migración — nombres de tabla/columna coinciden
  exactamente con los que usa `queries.sql` (que corre directo contra
  Postgres, no a través de Prisma).
- Escribió `api/prisma/seed.ts` con datos diseñados hacia atrás desde las 8
  consultas (cada ticket con un comentario diciendo qué consulta necesita
  esa fila), calculó a mano el resultado esperado de cada consulta antes de
  correrlas, y las 8 salidas reales coincidieron con lo calculado.
- Usó `$executeRaw` solo para forzar `fecha_actualizacion` en el pasado
  (columna con `@updatedAt`, que Prisma sobreescribe siempre) — documentado
  en el README como la única razón para SQL crudo en el seed.
- Ejecutó las 8 consultas (+ la 9 del dashboard) contra la base sembrada:
  ninguna falló, ninguna vino vacía.
- **`EXPLAIN ANALYZE` reveló algo que Darío no pidió explícitamente pero sí
  el propósito de la pregunta**: con la consulta 3 escrita como en el
  enunciado (`estado NOT IN (...)`), Postgres **no usaba** el índice
  compuesto ni con 1 millón de filas — `NOT IN` se traduce a `<> ALL(...)`,
  que un B-tree no puede usar como condición de su columna líder. La IA no
  se conformó con reportar "no lo usa": generó datos sintéticos con
  selectividad realista, probó forzar el índice (`SET enable_seqscan =
  off`, resultó *más lento*), identificó la causa raíz, y probó reescribir
  la misma consulta con `estado IN (<estados abiertos>)` — resultado
  idéntico, pero ahí Postgres sí usa el índice compuesto completo de forma
  natural. Cambió `queries.sql` para usar esa forma, documentando el
  trade-off (hay que mantener la lista de estados abiertos si se agrega un
  octavo estado).
- Los datos sintéticos (1M de filas, dos rondas) se borraron al terminar de
  medir; la base quedó con el seed curado de siempre.

**Qué se aceptó:** todo lo anterior.

**Qué se rechazó:** nada explícitamente, pero la IA misma descartó su
primer intento de generar datos sintéticos (distribución donde el filtro
de la consulta 3 coincidía con ~70% de las filas, nada selectivo, sequía
un caso irreal) y lo rehizo con una distribución más representativa antes
de sacar conclusiones — para no medir un escenario que no se parece a un
sistema de soporte real.

**Nota para la sustentación:** este es el ejemplo más concreto de "qué
valor aportó la IA" — no se limitó a declarar el índice en el schema y
asumir que funcionaba; lo midió, encontró que la consulta tal como estaba
escrita en el enunciado lo neutralizaba, y corrigió la causa raíz en vez de
solo el síntoma.

**Incidente operativo durante la prueba (transparencia completa):** el
primer `VACUUM ANALYZE` después de borrar el millón de filas sintéticas
falló con `could not resize shared memory segment` — no fue falta de disco
real (quedaban 923G libres), fue el límite de 64MB de `/dev/shm` que Docker
asigna por defecto, agotado por los *workers* paralelos del VACUUM. Se
reintentó con `max_parallel_maintenance_workers = 0` y funcionó. Después de
eso, la tabla `tickets` quedó en 233MB en disco pese a tener 14 filas
(`VACUUM` normal libera espacio para reuso interno de Postgres, pero no lo
devuelve al sistema operativo) — se resolvió con `VACUUM FULL`, que la dejó
en 112kB. Ninguno de los dos problemas es del esquema ni de la aplicación:
son artefactos de haber insertado y borrado 2 millones de filas de prueba
en un contenedor local con límites de recursos por defecto.

---

## 2026-09-09 — Ajustes a queries.sql (consultas 4, 6, 9)

**Se pidió:** cambiar la consulta 4 de `estado = 'resuelto'` a `estado IN
('resuelto','cerrado')` (un ticket resuelto y luego cerrado quedaba fuera
del conteo); cambiar las consultas 6 y 9 de `NOT IN` a `IN` por la misma
razón de rendimiento de índice ya documentada en la 3; documentar en
Supuestos una limitación de la consulta 4 (atribuye el ticket al agente
*actual*, no a quien lo resolvió si hubo reasignación posterior) y por qué
no se agrega `resuelto_por_id` ahora. Volver a ejecutar las 8 consultas y
confirmar resultados.

**Qué hizo la IA:** aplicó los tres cambios, documentó la limitación de
`agente_id` vs. quién resolvió realmente (con la solución conocida —
columna `resuelto_por_id` — y por qué no se agrega todavía), y volvió a
ejecutar las 8 consultas contra la base: los tres cambios sin efecto en 6
y 9 (semánticamente equivalentes, solo cambia el plan de ejecución), y la
4 pasó de contar 2 a 3 tickets resueltos por el mismo agente (capturó el
caso que antes quedaba fuera).

**Qué se aceptó:** todo lo anterior.

---

## 2026-09-09 — Módulo de autenticación y autorización

**Se pidió:** implementar el módulo completo con varias decisiones ya
tomadas por Darío (access token JWT de 15 min, refresh de 7 días con
rotación en tabla nueva, revocación de refresh tokens al bloquear,
autorización en dos niveles, argon2 o bcrypt a elección de la IA, helmet,
rate limit en login, Zod, secreto por variable de entorno, passwordHash
nunca en respuestas, mismo error genérico en login, 4 pruebas obligatorias
con la de "usuario bloqueado con token vigente" marcada como la más
importante).

**Qué hizo la IA:**
- Antes de instalar nada, **probó empíricamente** (no asumió) que `argon2`
  y `bcrypt` nativos instalan sin problema en la imagen real del proyecto
  (`node:22-alpine`, sin herramientas de compilación) — corriendo
  `docker run` contra esa imagen exacta. Con eso descartado como
  restricción, eligió `argon2id` por ser la recomendación vigente de OWASP.
- Eligió `jsonwebtoken` sobre `jose` para los access tokens: API más simple
  de explicar en vivo, sin necesitar nada de lo que `jose` ofrece de más.
- Diseñó el refresh token como string aleatorio opaco (no JWT), guardado
  como hash SHA-256 (no argon2 — argumentó por qué un hash lento no aporta
  nada para un secreto que ya tiene 256 bits de entropía propia).
- Agregó **detección de reuso** de refresh tokens (no estaba pedida
  explícitamente): si se presenta un token ya revocado, se revocan todas
  las sesiones del usuario — señal clásica de robo de token, y salía casi
  gratis de la misma consulta que ya hacía falta para la rotación.
- Centralizó en una sola función (`aUsuarioPublico`) la exclusión de
  `passwordHash` de cualquier respuesta, en vez de confiar en que cada
  controlador se acuerde de excluirlo.
- **Encontró un problema de timing en el login que la sola "misma respuesta
  genérica" no resolvía**: si el email no existe, saltarse la verificación
  de contraseña hace que la respuesta sea más rápida que cuando sí existe
  (porque argon2 es deliberadamente lento) — el tiempo de respuesta es
  también un canal de enumeración, aunque el mensaje sea idéntico. Lo
  corrigió verificando siempre contra un hash señuelo precalculado.
- **Encontró y corrigió un problema de configuración no pedido**: al hacer
  `JWT_SECRET` obligatorio, probó que el proyecto no cargaba `api/.env`
  fuera de Docker (el contenedor nunca lo ve, está en `.dockerignore`) —
  sin arreglarlo, ni las pruebas ni `npm run dev` sin Docker hubieran
  funcionado. Lo verificó ejecutando `env.ts` sin variables heredadas antes
  de asumir que hacía falta un arreglo, y agregó `dotenv` (que no
  sobreescribe variables ya puestas, seguro en Docker y en CI).
- Agregó un servicio de Postgres al job `api` de CI, porque las pruebas de
  este módulo pegan contra base real, no mocks — sin el servicio, CI
  hubiera fallado aunque los tests pasaran en local.
- Escribió las 4 pruebas pedidas más una quinta no pedida (rotación +
  detección de reuso de refresh token), porque el diseño de esa parte fue
  una decisión con cuidado explícito y no tener ninguna prueba sobre ella
  hubiera sido una omisión notoria.
- Todos los endpoints nuevos, la tabla `TokenRefresco` y su migración, y
  las 9 pruebas de integración quedaron corriendo contra Postgres real
  (no mocks) antes de reportar el trabajo como terminado.

**Qué se aceptó:** todo lo anterior.

**Qué se rechazó:** nada explícitamente — las decisiones grandes ya venían
dadas por Darío; el trabajo de la IA en este módulo fue sobre todo llenar
los espacios que sí quedaban abiertos (biblioteca de JWT, diseño interno
del refresh token, endpoints exactos de administración de usuarios) y
encontrar dos problemas reales (timing del login, carga de `.env`) que
nadie había pedido revisar.

**Detalle menor encontrado al verificar la salida de los tests**: la
librería `dotenv` (desde la v17) imprime "tips" promocionales aleatorios en
cada arranque — uno de ellos resultó ser publicidad de un producto de
terceros sin relación con este proyecto. No es nada malicioso (se confirmó
leyendo el código fuente del paquete instalado, no se asumió), pero no
debía aparecer en los logs de un servicio real ni menos en la sustentación
en vivo. Se silenció con la opción `quiet: true` que la propia librería
ofrece para esto.

---

## 2026-09-09 — Módulo de tickets

**Se pidió:** un alcance cerrado y explícito (CRUD, autorización por
propiedad, cambio de estado con las reglas de `fecha_resolucion` ya
definidas, reasignación transaccional, comentarios, listado con filtros y
paginación, endpoints de métricas apoyados en `queries.sql`), con una
instrucción explícita de **no investigar optimizaciones ni agregar nada
fuera de la lista** — cualquier mejora detectada se anota en "Qué falta" y
se sigue. Pruebas de integración solo de lo esencial: autorización por
propiedad, reasignación con su historial, y transición de estados.

**Qué hizo la IA:**
- Construyó el middleware de autorización por propiedad
  (`autorizar-propiedad-ticket.ts`) que había quedado explícitamente
  anunciado como pendiente en el módulo de auth — ahora sí hay un recurso
  real (`Ticket.agenteId`) al que aplicarlo.
- Decidió, sin que se lo pidieran explícitamente, que **reasignar es una
  acción por rol** (Administrador/Supervisor), no por propiedad — un
  Agente no reasigna ni sus propios tickets. Lo documentó como una
  decisión, no lo dejó implícito en el código.
- Implementó los 9 endpoints de dashboard ejecutando, **literal**, cada una
  de las 9 consultas de `queries.sql` vía `$queryRaw` — no las reescribió
  como query builder de Prisma, precisamente para no "investigar" una forma
  distinta de construir las mismas consultas ya verificadas.
- Encontró y resolvió un problema de serialización (no pedido, pero sí
  necesario para que el dashboard funcionara): `COUNT(...)` en Postgres
  vuelve como `BigInt` de JS vía `$queryRaw`, y `JSON.stringify` no lo
  serializa — revienta el endpoint. Se convierte a `number` antes de
  responder.
- **Verificó el módulo de punta a punta contra la app real**, no solo con
  las 3 pruebas pedidas: corrió un script de verificación manual (borrado
  después, no forma parte del proyecto) contra el servidor real con el
  seed cargado — login, listar, filtrar, paginar, detalle con comentarios,
  crear, eliminar (los dos casos: con y sin historial), y los 9 endpoints
  de dashboard. Confirmó explícitamente que `passwordHash` no aparece en
  las respuestas de ticket/comentario (no solo en las de usuario, que ya
  estaba cubierto).
- **Encontró y corrigió dos bugs reales, no pedidos, al hacer esa
  verificación**:
  1. El seed (escrito antes de que existiera el módulo de auth) guardaba
     un placeholder de `password_hash`, no un hash real — nadie podía
     iniciar sesión con los usuarios de demo. Se detectó probando el login
     contra el seed antes de asumir que funcionaba, y se corrigió con la
     función `hashearPassword` ya disponible.
  2. Al corregir lo anterior, el orden de limpieza del seed
     (`limpiar()`) no borraba `tokens_refresco` antes de `usuarios` —
     reseedear después de haber iniciado sesión alguna vez fallaba por
     llave foránea. Se agregó ese `deleteMany` en el lugar correcto.
- Escribió exactamente las 3 áreas de prueba pedidas (autorización por
  propiedad, reasignación + historial, transición de estados) — 6 pruebas
  en total, sin ampliar a CRUD general, listado o dashboard (eso se
  verificó a mano, como se explica arriba, no con más pruebas).

**Qué se aceptó:** todo lo anterior.

**Qué se rechazó / se dejó fuera a propósito** (siguiendo la instrucción
de no investigar mejoras fuera de alcance): validación de máquina de
estados (cualquier transición se acepta hoy), filtro automático de "mis
tickets" para un Agente en el listado, y consolidar los 9 endpoints de
dashboard en menos rutas. Los tres quedaron anotados en README > "Qué
falta y qué haría con más tiempo", no investigados ni implementados.

---

## 2026-09-09 — Frontend (5 vistas)

**Se pidió:** login, listado de tickets (filtros + paginación), detalle de
ticket (comentarios + acciones por rol), creación de ticket, dashboard
(distinto por rol: agente ve su carga y vencidos; admin/supervisor ven la
operación completa + una vista nueva de tickets asignados a agentes
inactivos). Técnico: React Router, contexto de auth con el access token EN
MEMORIA (no localStorage, por XSS — documentar la decisión y anotar la
alternativa de cookie httpOnly en "Qué falta"), refresh automático,
reusar `api-client.ts`, controles ocultos por rol como solo-usabilidad
(la autorización real ya está en el servidor), CSS plano en un solo
archivo con variables. Alcance cerrado explícito: nada fuera de la lista,
mejoras detectadas van a "Qué falta". Al final: comandos exactos para
levantar todo y entrar como administrador.

**Qué hizo la IA:**
- **Encontró dos huecos reales en el backend antes de poder construir las
  vistas**: no existía forma de listar clientes ni agentes desde el
  frontend (necesario para los formularios de creación/filtro/
  reasignación — nadie va a escribir un UUID a mano). Agregó
  `GET /api/clientes` y `GET /api/usuarios/agentes` (este último montado
  como excepción explícita antes de la puerta de Administrador), ambos
  mínimos (id+nombre[+activo]), documentados como necesarios para que las
  vistas pedidas funcionen, no como mejoras optativas.
- **Resolvió un choque de alcance sin abrir el dashboard a todos los
  roles**: el backend restringe `/api/dashboard/*` a Administrador/
  Supervisor (decisión del módulo anterior), pero este mensaje pide que el
  Agente vea "su carga y sus vencidos" en el dashboard. En vez de relajar
  esa restricción, el dashboard de Agente reusa `GET /api/tickets?
  agenteId=<self>` (ya abierto a cualquier rol) y calcula "vencido" en el
  navegador — cero endpoints nuevos para esa parte.
- Agregó una décima función de dashboard (`ticketsAgentesInactivos`, no es
  una de las 8 consultas de `queries.sql`) para la vista pedida
  explícitamente en este mensaje, mismo patrón que las otras 9. Ajustó el
  seed para que esa vista tuviera algo que mostrar en la demo (un ticket
  asignado a un agente que ya está bloqueado — sin esto, la vista
  funcionaría pero se vería vacía en vivo).
- Implementó la deduplicación de refrescos concurrentes en
  `api-client.ts` (`refrescoEnCurso`, una sola promesa compartida) — no
  estaba pedida explícitamente, pero es necesaria para que "refresh
  automático" funcione de verdad: el backend rota el refresh token y
  detecta reuso, y el dashboard de gestión dispara 10 peticiones en
  paralelo al cargar — sin deduplicar, dos refrescos concurrentes con el
  mismo token harían que el backend interpretara el segundo como un robo
  de token y cerrara todas las sesiones.
- **Verificó contra el stack de Docker real, no solo `typecheck`/`build`**:
  reconstruyó las imágenes y encontró tres bugs de infraestructura que
  hubieran bloqueado a Darío igual sin que la IA tocara nada del código de
  este módulo:
  1. `docker-compose.yml` nunca tenía `JWT_SECRET` para el contenedor de
     la API (se había agregado a `api/.env` para el flujo sin Docker, pero
     nunca a `docker-compose.yml`) — el contenedor no arrancaba.
  2. `node:22-alpine` ya trae OpenSSL 3, no 1.1 — el motor de Prisma se
     había generado para 1.1 (detección automática equivocada) y fallaba
     al cargar en el contenedor. Corregido fijando `binaryTargets` en
     `schema.prisma`.
  3. La detección de OpenSSL de Prisma necesita el binario `openssl`
     (ejecutable, no solo la librería), que no viene instalado en
     `node:22-alpine` — sin él, el punto 2 no era suficiente. Se agregó al
     Dockerfile de la API.
  Los tres se verificaron reconstruyendo la imagen y confirmando arranque
  limpio — no solo que el build no fallara.
- Corrigió un problema de orden encontrado en este mismo archivo (fuera del
  código del proyecto, pero vale la transparencia): una edición anterior
  había insertado la entrada "Cierre del modelo: UUID v7" al final del
  archivo por un `old_string` que coincidió con el lugar equivocado, en
  vez de justo después de la entrada del ERD (donde ocurrió
  cronológicamente). Se reordenó todo el archivo para que la narrativa sea
  correcta de punta a punta para la sustentación.

**Qué se aceptó:** todo lo anterior.

**Qué se rechazó / se dejó fuera a propósito** (siguiendo la instrucción de
alcance cerrado): pantalla de administración de usuarios en el frontend
(los endpoints existen y están probados, no hay UI), filtros del listado
sincronizados con la URL, formulario de edición general del ticket en el
detalle (el endpoint `PATCH /api/tickets/:id` existe, el frontend solo usa
cambio de estado y reasignación), y validación en el backend de que
`reasignar` reciba un agente activo con rol `agente` (el frontend evita
ofrecer una opción inválida, pero el servidor no lo valida todavía). Los
cuatro quedaron anotados en README > "Qué falta y qué haría con más
tiempo".

---

## 2026-09-09 — Cierra el frontend: administración de usuarios y filtro por defecto del agente

**Se pidió:** la vista de administración de usuarios que había quedado
fuera (tabla con nombre/email/rol/estado, botón bloquear/desbloquear
visible solo para Administrador, formulario de creación, enlace en la nav
solo para Administrador — "nada más", sin dependencias nuevas); que el
filtro de agente del listado venga preseleccionado con el propio id
cuando el usuario es Agente (removible), documentando en el README que es
usabilidad y no una restricción, con el porqué explícito (el enunciado
distingue "consultar todos" de "consultar", pero la restricción real y
efectiva está en la escritura, no en la lectura); tres verificaciones
contra el servidor real (agente no ve el enlace, agente recibe 403 del
servidor al entrar a la ruta a mano, agente no puede llamar los endpoints
de bloqueo); una prueba de integración para ese 403 si no estaba cubierta;
y los pasos exactos para demostrar el bloqueo en vivo.

**Qué hizo la IA:**
- Construyó `UsuariosPage.tsx` (tabla + formulario de creación inline, sin
  archivo aparte por lo pequeño que es) reusando exactamente los 4
  endpoints que ya existían del módulo de auth — cero endpoints nuevos,
  cero dependencias nuevas.
- Revisó la prueba de integración existente (`rechaza por rol insuficiente`
  sobre `GET /api/usuarios`) y determinó que cubría el caso general pero
  no el endpoint de bloqueo específicamente, que es el que de verdad
  importa operativamente — agregó una prueba nueva y separada para
  `PATCH /api/usuarios/:id/bloquear`, con una aserción extra (el usuario
  objetivo sigue activo) que confirma que el 403 no tiene efecto, no solo
  que devuelve el código correcto.
- **No se conformó con la prueba automatizada para las 3 verificaciones
  pedidas**: corrió peticiones reales contra el stack de Docker vivo, con
  un token de Agente real obtenido por login real, saltándose el frontend
  por completo — `GET /api/usuarios` y `PATCH .../bloquear` ambos 403, y
  confirmó en la base que el usuario objetivo del intento de bloqueo no
  quedó bloqueado.
- **Simuló el escenario completo de la demo en vivo contra el stack real**
  antes de escribir los pasos para Darío: login de un agente (sesión
  "abierta en otra ventana"), confirmó que su token servía, lo bloqueó con
  una sesión de administrador distinta, y confirmó que el *mismo* token
  del agente (sin haber expirado) quedaba rechazado en su siguiente
  petición — exactamente el flujo que Darío va a mostrar en vivo. Dejó el
  usuario desbloqueado de nuevo al terminar, para que el ambiente quede
  listo para la demo real.
- Documentó en README el razonamiento completo del filtro preseleccionado
  (por qué es usabilidad y no seguridad, con la referencia textual al
  enunciado que motivó la pregunta) y actualizó "Cómo ejecutarlo" y "Qué
  falta" para reflejar que la administración de usuarios ya tiene UI (ya
  no aparece como pendiente).

**Qué se aceptó:** todo lo anterior.

**Nota:** en esta sesión no hay forma de ejecutar JavaScript en un
navegador real — la verificación de "el Agente no ve el enlace" se hizo
por inspección de código (una condición determinista sobre `usuario.rol`,
sin estado asíncrono de por medio, así que no hay ambigüedad), no
clickeando en un navegador. Se lo digo así de explícito a Darío en vez de
implicar que se probó visualmente cuando no fue el caso.

---

## 2026-09-09 — Reconstrucción del historial de commits

**Se pidió:** reconstruir todo el trabajo del día (nunca comiteado) en
commits temáticos, conventional commits en español, orden lógico —
agrupados por tema, no por archivo. Además, extraer la medición de
rendimiento del README a `docs/rendimiento.md` aparte.

**Qué hizo la IA:**
- Como varios archivos se tocaron en más de un momento del día
  (`schema.prisma`, `queries.sql`, `seed.ts`, `routes.ts`, los módulos de
  `usuarios` y `dashboard`, `auth.test.ts`), los reescribió temporalmente
  a su contenido de cada etapa intermedia (con `Edit`, restaurando después
  hacia el siguiente commit) para que cada commit refleje exactamente lo
  que existía en ese punto — no todo el archivo final de una sola vez.
- Priorizó agrupar por tema sobre cronología exacta cuando ambas
  chocaban: la prueba de integración del 403 sobre bloqueo de usuarios se
  escribió cronológicamente al final (junto con el frontend de admin),
  pero quedó en el commit `feat(usuarios)` porque es de lo que trata.
- Encontró y corrigió dos problemas reales de higiene del repo que no
  eran parte del pedido explícito: `web/tsconfig.tsbuildinfo` (artefacto
  de build) se había colado como archivo sin trackear — agregado a
  `.gitignore` en su propio commit `chore`; y `docker-compose.yml` nunca
  había recibido el `JWT_SECRET` que sí se agregó a `api/.env` — se
  verificó reconstruyendo el stack de Docker realmente, no revisando el
  diff a ojo.
- **Verificó la suite completa varias veces después de terminar** (no se
  conformó con que los 15 commits existieran): encontró un timeout
  intermitente en `auth.test.ts` (un test distinto fallaba en cada
  corrida) — investigó antes de asumir que era un bug de la
  reconstrucción, confirmó con `auth.test.ts` corriendo solo (8/8 pasa
  siempre) que era contención de CPU de la máquina compartida (otro
  contenedor ajeno corriendo, `load average` de 5.9) chocando con el
  timeout por defecto de Vitest (5s) y el costo intencional de argon2id.
  Subió el timeout a 15s (`fix(test)`, commit aparte) y confirmó 16/16 en
  dos corridas seguidas antes de dar el trabajo por cerrado.

**Qué se aceptó:** todo lo anterior.

**Nota:** esta es la prueba más concreta de por qué "verificar después de
cada paso" no es un formalismo — reconstruir docenas de archivos entre 15
commits a mano, reescribiendo varios a mano hacia estados intermedios,
tenía un riesgo real de introducir un error de transcripción en algún
punto. La corrida completa sí encontró algo (aunque resultó ser
ambiental, no un error de la reconstrucción) — no se hubiera sabido sin
correr la suite más de una vez al terminar, en vez de conformarse con la
primera corrida en verde.

---

## 2026-09-09 — Verificación pre-GitHub: log, 3 corridas de tests, timeout en CI

**Se pidió:** mostrar `git log` completo (dos formatos); correr las
pruebas del API 3 veces seguidas para confirmar que el timeout
intermitente de `auth.test.ts` quedó resuelto con los 15s (avisar si
volvía a fallar); evaluar si esos 15s alcanzan para el runner de GitHub
Actions o si conviene más margen ahí, y documentar la decisión.

**Qué hizo la IA:**
- Corrió las 3 corridas pedidas: **16/16 las tres veces**, sin ningún
  timeout. Reportó el resultado real, no una suposición de que "ya debería
  estar arreglado" porque el commit anterior lo decía.
- No se conformó con "pasó 3 veces, listo": miró los tiempos individuales
  de cada test dentro de esas corridas y encontró que varios estuvieron
  entre 3s y 5.1s — es decir, cerca del límite viejo de 5s sin margen
  real, aunque ninguno lo haya superado en estas 3 corridas puntuales. Ese
  dato (no la simple ausencia de fallos) fue la base para la decisión del
  punto 3.
- Con esa evidencia, decidió que CI necesita más margen que local, no el
  mismo: GitHub Actions corre en runners de 2 vCPU (máquina modesta) con
  Postgres como contenedor compitiendo por esos mismos núcleos durante los
  tests — un escenario de contención al menos comparable al que ya dejó
  sin margen los 15s locales. Como el proyecto no tiene corridas de CI
  previas para medir directamente, asumió el escenario conservador en vez
  de reusar el mismo número: el doble, 30s, condicionado a `process.env.CI`
  (que GitHub Actions pone automáticamente, sin configuración extra).
- Documentó la decisión completa (por qué 15s en local, por qué el doble
  en CI, y que no se pudo medir directamente en CI todavía) en README >
  Pruebas, no solo en el código.

**Qué se aceptó:** todo lo anterior.

**Nota:** el timeout de CI es una decisión tomada sin poder medirla
todavía (no hay corridas de CI previas de este proyecto) — a diferencia
del resto de las decisiones de rendimiento de esta sesión (el índice de
la consulta 3, el timeout local), que sí se verificaron con datos reales
antes de decidir. Vale la pena revisarlo con la primera corrida real de
CI y ajustar si hace falta, en vez de asumir que 30s es definitivo.
