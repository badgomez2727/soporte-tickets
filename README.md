# [Nombre de la prueba]

> Reemplazar esta línea con una descripción del problema en dos frases: qué resuelve y para quién.

## Stack

- **Backend:** Node.js + TypeScript, Express, Prisma
- **Base de datos:** PostgreSQL
- **Frontend:** React + TypeScript (Vite)
- **Infraestructura local:** Docker Compose
- **Calidad:** Vitest (pruebas de integración sobre el API), typecheck estricto, CI en GitHub Actions

## Cómo ejecutarlo

Requiere Docker y Docker Compose.

```bash
cp api/.env.example api/.env
docker compose up --build
```

- API: http://localhost:3000/api/health
- Frontend: http://localhost:5173

Aplicar las migraciones y cargar los datos de prueba (una sola vez, o
cuando cambie el esquema):

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed
```

**Para entrar a la aplicación**: http://localhost:5173/login — cualquier
usuario del seed, contraseña `Demo1234!`. El administrador es
`admin@infinivirt.test` (ve el dashboard completo y la administración de
usuarios, en `/usuarios`).

### Sin Docker

```bash
cd api && npm install && npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed && npm run dev
cd web && npm install && npm run dev
```

## Pruebas

```bash
cd api && npm test
cd api && npm run typecheck
cd web && npm run typecheck
cd web && npm run build
```

**Timeout de los tests, distinto en CI**: `argon2id` (hash de contraseñas)
es deliberadamente costoso en CPU. El default de Vitest (5s) alcanza en
una máquina sin carga, pero bajo contención real un test puede superarlo
sin que el código esté roto — medido en desarrollo local (máquina
compartida con otros procesos): corriendo la suite 3 veces seguidas,
tests individuales tardaron entre 3s y 5.1s, cerca del límite viejo sin
margen real. `api/vitest.config.ts` sube el timeout a 15s en local.

En CI (GitHub Actions, runner de 2 vCPU) el mismo cuello de botella aplica
igual o peor — es una máquina modesta, y Postgres corre como contenedor
compitiendo por esos mismos 2 vCPU durante los tests. No se pudo medir
directamente ahí antes de la primera corrida real de CI de este proyecto,
así que se asume el escenario más conservador en vez de reusar el mismo
margen que ya resultó justo en local: **el doble, 30s**
(`testTimeout: process.env.CI ? 30000 : 15000`) — `CI` la pone GitHub
Actions automáticamente en cada job, no hace falta configurarla.

## Estructura

```
api/
  src/
    config/       configuración validada al arranque
    shared/       utilidades transversales (errores, logger, cliente de datos)
    modules/      un directorio por dominio: rutas, controlador, servicio
    routes.ts     registro único de módulos
    app.ts        construcción de la aplicación (sin abrir puerto)
    server.ts     arranque y apagado ordenado
  tests/          pruebas de integración contra la app en memoria
  prisma/         esquema y migraciones
web/
  src/            interfaz React, con un único cliente de API
```

La separación por módulos permite agregar un dominio nuevo sin tocar `app.ts`:
se crean `modules/<dominio>/` y se monta en `routes.ts`.

## Modelo de datos

Se partió de las 8 consultas analíticas exigidas (`queries.sql`) en vez de
diseñar el modelo primero: cada tabla y columna de abajo existe porque alguna
consulta la necesita literalmente, no por intuición de "qué suele tener un
sistema de tickets".

```
Cliente 1───N Ticket N───1 Usuario (agente, nullable)
                │
                ├───N HistorialAsignacion N───1 Usuario (agente asignado)
                │                          N───1 Usuario (asignado_por, nullable)
                │
                └───N Comentario N───1 Usuario (autor)
```

- **Cliente**: `id, nombre, fecha_creacion`. No inicia sesión — los roles del
  enunciado (Administrador, Agente, Supervisor) son de personal interno, el
  cliente es solo la referencia a nombre de quién se abre el ticket.
- **Usuario**: `id, nombre, email, password_hash, rol, activo, fecha_creacion`.
- **Ticket**: `id, titulo, descripcion, estado, prioridad, cliente_id,
  agente_id (nullable), fecha_creacion, fecha_actualizacion, fecha_resolucion
  (nullable)`.
- **HistorialAsignacion**: `id, ticket_id, agente_id, asignado_por_id
  (nullable), fecha_asignacion`. Una fila por cada evento de asignación,
  incluida la primera.
- **Comentario**: `id, ticket_id, usuario_id (autor), cuerpo, fecha_creacion`.
  No está en ninguna de las 8 consultas, pero el enunciado exige "detalle con
  comentarios" en el frontend. Se modela plano (sin respuestas anidadas):
  nadie pidió threading y complica el modelo sin necesidad real.

### Por qué `tickets.agente_id` Y `historial_asignaciones`, no solo uno

Las consultas 3, 4 y 6 hacen `JOIN`/`LEFT JOIN` de `tickets` con `usuarios`
directamente por `agente_id` — ninguna deriva el agente actual desde el
historial. Eso obliga a que el ticket tenga su propia columna de asignación
actual (caché barata de leer para dashboard y filtros), separada del
historial (log de auditoría que responde "cuántas veces cambió de manos",
consulta 7).

**Riesgo de este diseño:** las dos fuentes se pueden desincronizar si algo
actualiza una sin la otra. Se mitiga en el servicio de tickets, no en el
esquema: toda reasignación escribe ambas tablas dentro de la misma
transacción de Prisma.

## Decisiones y justificación

> Una entrada por decisión, escrita en el momento de tomarla y no al final.
> Formato: qué se decidió, qué alternativa se descartó y por qué.

| Decisión | Alternativa descartada | Razón |
| --- | --- | --- |
| Separar `app.ts` de `server.ts` | Levantar el servidor en el mismo archivo | Permite probar el API en memoria con supertest, sin puertos ni esperas |
| Validar la configuración con Zod al arranque | Leer `process.env` donde se necesite | Un servicio mal configurado falla de inmediato y con mensaje claro, no en la primera petición |
| Errores como clase `HttpError` con middleware único | `res.status().json()` en cada controlador | Un solo formato de error en todo el API y un solo lugar donde cambiarlo |
| `usuarios.rol` como enum de un solo valor | Tabla `usuarios_roles` N a N | El enunciado pide 3 roles fijos y un usuario con un solo rol a la vez; una tabla intermedia agrega un join a cada chequeo de permisos sin que nada lo requiera. Se pierde: si algún día un usuario necesita dos roles simultáneos, hay que migrar. |
| `historial_asignaciones` guarda `agente_id` y `asignado_por_id` | Guardar solo `agente_id` | Ninguna de las 8 consultas pide quién hizo la reasignación, pero es la tabla pensada para "control de fricción operativa" (comentario de la consulta 7) y el campo es una FK nullable barata de mantener. |
| Bloquear un usuario solo cierra su login (`activo=false`) | Reasignar en cascada sus tickets abiertos al bloquear | Reasignación automática exige una regla de negocio (¿a quién? ¿con qué criterio?) que nadie pidió. Preservar `agente_id` e historial intactos mantiene la auditoría íntegra; la reasignación de tickets huérfanos queda como acción manual de un supervisor. |
| `Cliente` mínimo: solo `id` y `nombre` | Agregar `email`/`teléfono` de contacto | Es todo lo que las 8 consultas necesitan; campos de contacto no tienen ningún consumidor en el alcance actual. |
| IDs de dominio como UUID (`@db.Uuid`), no enteros | Enteros autoincrementales (`serial`/`bigserial`) | Un ID autoincremental es adivinable y enumerable (`/tickets/1042` implica que `1041` y `1043` existen) — en un sistema de soporte con datos de clientes eso es una fuga de información gratuita. UUID también se puede generar en el backend antes del `INSERT`, lo que permite crear un ticket y su primera fila de `historial_asignaciones` con el mismo ID ya conocido dentro de una sola transacción, sin depender de que la base devuelva el ID generado. |
| UUID **v7**, no v4, y tipo nativo `@db.Uuid` (no `text`) | UUID v4 aleatorio, o mantener el `text` que traía el modelo `Example` de relleno | Un UUID v4 es aleatorio en sus 128 bits, así que cada `INSERT` cae en una posición impredecible del índice B-tree de la PK — con volumen alto eso fragmenta el índice, ensancha las páginas y hunde la tasa de acierto de caché. UUID v7 lleva un timestamp en los primeros 48 bits, así que los IDs se generan en orden creciente: el índice crece "al final", igual que con un `serial`, pero sin ser adivinable. Se genera en Prisma Client (`@default(uuid(7))`, soportado desde la versión ya instalada, 5.22), no en Postgres — Postgres 16 (la versión fijada en `docker-compose.yml`) todavía no trae `uuidv7()` nativo, eso llegó en Postgres 18. Se agrega `@db.Uuid` para que la columna se guarde como los 16 bytes binarios nativos de Postgres en vez de como texto de 36 caracteres — la mitad del espacio y comparación más rápida. Se evaluó ULID como alternativa: da el mismo ordenamiento temporal, pero se codifica en base32 (26 caracteres) y no calza con el tipo `uuid` nativo de Postgres, así que habría que guardarlo como `varchar` — se pierde el tipo nativo sin ganar nada que UUID v7 no dé ya en este stack. |
| `tickets(estado, fecha_actualizacion)` como índice compuesto | Índices separados en `estado` y en `fecha_actualizacion`, o ninguno | Es el índice que responde la consulta 3 (tickets sin actualizar hace más de 48h, la que usa Supervisor). Sin él, con millones de filas esa consulta hace *sequential scan* completo de `tickets` en cada carga del dashboard de Supervisor. El orden de las columnas importa: `estado` primero porque el filtro `estado NOT IN (...)` reduce el conjunto antes de comparar `fecha_actualizacion`. |
| `tickets(prioridad, cliente_id)` como índice compuesto | Índices separados en `prioridad` y en `cliente_id`, o ninguno | Responde la consulta 2 (top 5 clientes con tickets de prioridad alta/crítica): filtra por `prioridad IN ('alta','critica')` y agrupa por `cliente_id`. `prioridad` va primero por el mismo motivo que en el índice anterior — es el filtro (`WHERE`), reduce el conjunto antes de agrupar; `cliente_id` va segundo porque es la columna del `GROUP BY`, así Postgres puede recorrer el índice ya agrupado por cliente dentro de cada prioridad en vez de ordenar aparte. |

## Supuestos

> Todo lo que el enunciado no especificaba y hubo que asumir. Esta sección vale
> tanto como el código: muestra qué preguntas se hicieron sobre el problema.

- **Valores de `estado`** (confirmados por Darío): `nuevo`, `asignado`,
  `en_progreso`, `en_espera_cliente`, `resuelto`, `cerrado`, `reabierto`.
- **Valores de `prioridad`** (confirmados): `baja`, `media`, `alta`,
  `critica`.
- **`en_espera_cliente` no debería contar contra el tiempo de resolución**
  (consulta 5). La consulta 5, tal como está escrita, calcula
  `fecha_resolucion - fecha_creacion` de forma lineal — no descuenta el
  tiempo que el ticket pasó esperando respuesta del cliente, que no es
  tiempo de trabajo del agente. Medirlo con precisión exigiría una tabla de
  historial de estados (análoga a `historial_asignaciones` pero por
  transición de estado, con timestamp de entrada y salida de cada uno) para
  poder sumar exactamente los tramos en `en_espera_cliente`. No se
  construye esa tabla en esta entrega por alcance/tiempo — queda anotada en
  "Qué falta y qué haría con más tiempo". El `queries.sql` final se entrega
  con la fórmula simple (consciente de esta limitación), dejando explícito
  que el promedio de la consulta 5 sobreestima el tiempo real de trabajo en
  tickets que pasaron por `en_espera_cliente`.
- **`reabierto` y su efecto sobre `fecha_resolucion`**: al reabrir un ticket
  (transición `resuelto`/`cerrado` → `reabierto`), la aplicación debe volver
  `fecha_resolucion` a `null`. Si no se hiciera, la consulta 8 (% cerrados
  en 30 días) y la 5 (tiempo promedio de resolución) seguirían contando ese
  ticket como resuelto por tener `fecha_resolucion` no nula, aunque su
  `estado` actual ya sea `reabierto` — distorsionando ambas métricas. Esta
  limpieza es responsabilidad del servicio de tickets (transición de
  estado), no del esquema; se documenta aquí porque es la razón de ser del
  campo `reabierto` como estado propio y no como un simple regreso a
  `nuevo`/`asignado`.
- **`fecha_actualizacion` vs. `fecha_resolucion`**: la consulta 4 del
  enunciado filtra "resuelto en el último mes" usando `fecha_actualizacion`,
  pero `fecha_actualizacion` se toca con cualquier cambio al ticket (un
  comentario, una reasignación), no solo al resolverlo. Se asume que es un
  descuido del enunciado y en el `queries.sql` final la consulta 4 usa
  `fecha_resolucion`, igual que la consulta 5 — para no contar como
  "resuelto este mes" un ticket que solo se tocó este mes sin resolverse.
- **Cliente no es un rol de autenticación**: el enunciado define 3 roles
  (Administrador, Agente, Supervisor), todos personal interno. Se asume que
  los clientes no inician sesión en la plataforma; son solo el destinatario
  del ticket.
- **La consulta 4 atribuye el ticket al agente *actual*, no a quien
  realmente lo resolvió.** `tickets.agente_id` es la asignación vigente
  (ver "Modelo de datos" arriba); si un ticket se resuelve y *después* se
  reasigna a otra persona (por ejemplo, para que revise o cierre
  administrativamente), la consulta 4 le da el crédito de la resolución al
  agente nuevo, no a quien hizo el trabajo real. Una columna
  `resuelto_por_id` (FK a `usuarios`, fijada una sola vez cuando `estado`
  pasa a `resuelto`, igual que `fecha_resolucion`) resolvería esto de raíz.
  No se agrega ahora: no hay evidencia de que las reasignaciones
  post-resolución sean un caso frecuente en este dominio, y es una columna
  que se puede sumar después sin romper nada (nullable, se rellena hacia
  adelante) — se prefiere no anticipar una tabla/columna para un caso que
  todavía no se sabe si ocurre. Queda en "Qué falta y qué haría con más
  tiempo".
- **Listado de tickets sin restricción automática por rol.** Un Agente ve
  el mismo `GET /api/tickets` que Administrador/Supervisor (puede filtrar
  por `?agenteId=<su-id>` si quiere solo los suyos, pero no está forzado).
  Se asume que ver contexto de otros tickets es útil para el trabajo en
  equipo; la restricción real está en las acciones de escritura
  (autorización por propiedad), no en la lectura.
- **Creación de tickets abierta a los 3 roles**, sin restricción — el
  enunciado no distingue quién puede abrir un ticket.
- **No hay auto-registro de usuarios.** Los 3 roles del enunciado son
  personal interno (Administrador, Agente, Supervisor); se asume que las
  cuentas las crea un Administrador (`POST /api/usuarios`), no que cualquiera
  se registra solo. Coherente con el supuesto ya hecho de que `Cliente`
  tampoco inicia sesión.
- **`descripcion` es obligatoria en `Ticket`** (confirmado por Darío): un
  ticket sin descripción no es accionable para la operación — un agente no
  puede trabajar ni un supervisor puede auditar un ticket que solo tiene
  título. Se rechaza como inválido en la validación de entrada, no se
  permite `null`/cadena vacía a nivel de esquema.

## Datos de prueba (`api/prisma/seed.ts`)

`npm run prisma:seed` (o `npx prisma db seed`) carga 5 clientes, 6 usuarios
(uno inactivo), 15 tickets cubriendo los 7 estados y las 4 prioridades, 21
filas de historial de asignaciones y 7 comentarios — suficiente para que las
8 consultas de `queries.sql` devuelvan resultados no vacíos, más un ticket
asignado a propósito al agente inactivo (para la vista de dashboard que
pidió el frontend, ver más abajo).

**Para iniciar sesión con cualquier usuario del seed**: la contraseña de
los 6 es `Demo1234!` (ej. `admin@infinivirt.test` / `Demo1234!`). Ver
`api/prisma/seed.ts` para la lista completa de emails y roles.

**Por qué el seed usa SQL crudo (`$executeRaw`) en un punto:** `fechaActualizacion`
tiene `@updatedAt`, así que Prisma Client la sobreescribe con la fecha actual
en cada `create()`/`update()` — es justamente lo que se quiere en producción
(que se actualice sola), pero significa que **no hay forma de sembrar un
ticket que "lleva 3 días sin tocarse"** usando el cliente de Prisma: apenas
se crea, ya quedó con fecha de hoy. Para poder demostrar la consulta 3
(tickets sin actualizar hace más de 48h) el seed crea los tickets normalmente
y después corre un `UPDATE` de SQL crudo directo sobre `fecha_actualizacion`,
saltándose a Prisma para esa columna específica. Es la única razón para usar
SQL crudo en el seed — todo lo demás pasa por el cliente de Prisma.

## Autenticación y autorización

**Access token**: JWT firmado (HS256), 15 minutos, payload `{ sub: usuarioId, rol }`.
Se valida con `jsonwebtoken` — se prefirió sobre `jose` por tener una API
mucho más simple de explicar en vivo (`sign`/`verify` con dos argumentos),
sin que este proyecto necesite nada de lo que `jose` ofrece de más (más
algoritmos, JWK sets, etc.).

**El middleware `autenticar` valida la firma Y consulta `usuarios.activo`
en cada petición** (`shared/middleware/autenticar.ts`). Es lo que hace que
bloquear a alguien surta efecto de inmediato, en vez de esperar hasta 15
minutos a que su token expire por sí solo — ver el test "usuario bloqueado
con token vigente" en `tests/auth.test.ts`, la prueba más importante del
módulo.
- **Costo**: una consulta a `usuarios` por cada petición autenticada.
- **Mitigación pensada, no implementada**: una caché en memoria
  `{ usuarioId → activo }` con TTL corto (segundos), invalidada explícitamente
  al bloquear/desbloquear. No se construye ahora porque con una sola
  instancia del API el costo real es insignificante, y agregar la caché
  introduce una pregunta que sí importaría con más de una instancia corriendo
  en paralelo (¿cómo se entera la otra instancia de que alguien fue
  bloqueado?) que no vale la pena resolver todavía.

**Refresh token**: 7 días, con rotación (tabla `TokenRefresco`, migración
`auth_tokens_refresco`). No es un JWT — es un string aleatorio opaco (256
bits, `crypto.randomBytes`), y solo se guarda su **hash SHA-256** en la
base, nunca el valor en texto plano. Dos decisiones dentro de esto:
- **Por qué no es un JWT**: de todas formas hay que consultar la base para
  poder rotarlo y revocarlo — un JWT ahí solo agregaría una verificación de
  firma redundante sin evitar la consulta.
- **Por qué SHA-256 y no argon2/bcrypt para el token**: el hash lento
  (argon2) existe para proteger secretos de *baja* entropía como una
  contraseña humana, que un atacante puede intentar adivinar. Este token ya
  tiene 256 bits aleatorios — no hay ataque de fuerza bruta viable contra
  él — así que un hash lento solo penalizaría cada refresh sin ganar nada.
- **Detección de reuso**: si se presenta un refresh token cuyo hash
  corresponde a uno YA revocado (rotado antes, cerrado por logout, o el
  usuario fue bloqueado), es la señal clásica de que ese token fue robado —
  se revocan automáticamente **todas** las sesiones del usuario, no solo se
  rechaza la petición. No estaba pedido explícitamente, se agregó porque
  sale gratis de la misma consulta que ya hace falta para rotar.
- **Al bloquear un usuario se revocan también sus refresh tokens**
  (`usuarios.service.ts > bloquear`), para cerrar el otro camino: sin esto,
  bloquear solo detendría el access token vigente, pero el usuario podría
  usar su refresh token para sacar uno nuevo en cuanto el actual expirara.

**Autorización en dos niveles**:
1. **Por rol** — `shared/middleware/autorizar-rol.ts`, un factory
   (`autorizarRol('administrador')`) que se compone con `autenticar`. Ya
   implementado y probado (administración de usuarios, exclusiva de
   Administrador).
2. **Por propiedad del recurso** (ej. un agente solo actualiza tickets
   asignados a él) — **no se implementa en este módulo**: depende de datos
   del recurso mismo (`ticket.agenteId`), que todavía no existe como
   endpoint. Se construye en el módulo de tickets. Escribir ese middleware
   ahora, sin un recurso real al que aplicarlo, sería código sin una prueba
   de integración real que lo ejerza.

**Seguridad**:
- Contraseñas con `argon2id` (recomendación actual de OWASP) —
  `shared/auth/password.ts`. Se evaluó `bcrypt` (la opción alternativa
  pedida): antes de decidir se **probó en la imagen real del proyecto**
  (`node:22-alpine`, sin herramientas de compilación) que ambos instalan
  con binarios precompilados, sin necesidad de tocar el Dockerfile —
  entonces la decisión quedó libre de esa restricción y se tomó por el
  criterio de seguridad (argon2id) en vez de por conveniencia de build.
- `helmet` montado global en `app.ts`. `express-rate-limit` **solo** en
  `POST /auth/login` (10 intentos / 15 min por IP) — pedido así
  explícitamente, no se extendió a otras rutas para no exceder el alcance.
- Validación de entrada con Zod en los 9 endpoints nuevos (`auth.schemas.ts`,
  `usuarios.schemas.ts`), incluido el `:id` de ruta (evita que un id
  mal formado llegue a Prisma como error 500 sin manejar).
- `JWT_SECRET` por variable de entorno, sin default (`config/env.ts`) —
  un secreto con un valor conocido de antemano invalidaría toda la
  autenticación. Agregado a `.env.example` con instrucciones de cómo
  generar uno propio.
- `passwordHash` nunca sale en una respuesta: centralizado en una sola
  función (`shared/auth/usuario-publico.ts`) que lo excluye, usada en los
  3 lugares que devuelven un `Usuario` — en vez de acordarse de excluirlo
  a mano en cada controlador.
- **Login con el mismo error genérico** para email inexistente, contraseña
  incorrecta, o usuario bloqueado (`auth.service.ts`). Con un detalle que no
  bastaba con igualar el mensaje: si el email no existe, un código ingenuo
  se salta la verificación de contraseña (rápida) y responde antes; si
  existe, corre argon2 (deliberadamente lento) antes de responder. Mismo
  mensaje, **tiempo de respuesta distinto** — y el tiempo también sirve para
  enumerar emails. Se corrige verificando siempre contra un hash señuelo
  precalculado cuando el usuario no existe, para que ambos casos tomen un
  tiempo similar.

**Hallazgo no pedido, corregido igual**: `JWT_SECRET` es obligatorio, pero
nada en el proyecto cargaba `api/.env` automáticamente fuera de Docker
(docker-compose inyecta las variables directo; el contenedor nunca ve el
archivo `.env`, está en `.dockerignore`). Se verificó ejecutando `env.ts`
sin variables heredadas: fallaba. Se agregó `dotenv` (`config/env.ts`),
que no sobreescribe variables ya puestas — seguro tanto en Docker como en
CI, donde las variables se ponen directo en el workflow.

**CI**: el job `api` de `.github/workflows/ci.yml` ahora levanta un
servicio de Postgres y corre `prisma migrate deploy` antes de las pruebas —
las de este módulo pegan contra una base real (mismo criterio que se usó
para validar todo el modelo de datos a mano), no contra mocks.

**Endpoints nuevos**:
| Método | Ruta | Quién |
| --- | --- | --- |
| POST | `/api/auth/login` | público (con rate limit) |
| POST | `/api/auth/refresh` | público (requiere refresh token válido) |
| POST | `/api/auth/logout` | público (requiere refresh token válido) |
| GET | `/api/auth/perfil` | cualquier usuario autenticado |
| GET | `/api/usuarios` | Administrador |
| GET | `/api/usuarios/:id` | Administrador |
| POST | `/api/usuarios` | Administrador |
| PATCH | `/api/usuarios/:id/bloquear` | Administrador |
| PATCH | `/api/usuarios/:id/desbloquear` | Administrador |

No hay registro público de usuarios (supuesto: es un sistema interno,
aprovisionado por un Administrador — ver Supuestos).

## Módulo de tickets

**Endpoints**:
| Método | Ruta | Quién |
| --- | --- | --- |
| GET | `/api/tickets` | cualquier autenticado — filtros `estado/prioridad/clienteId/agenteId` + paginación |
| GET | `/api/tickets/:id` | cualquier autenticado — incluye cliente, agente y comentarios |
| POST | `/api/tickets` | cualquier autenticado |
| PATCH | `/api/tickets/:id` | Administrador/Supervisor (cualquiera) o Agente (solo el suyo) |
| PATCH | `/api/tickets/:id/estado` | mismo criterio de propiedad que arriba |
| PATCH | `/api/tickets/:id/reasignar` | Administrador/Supervisor (por rol, no por propiedad) |
| POST | `/api/tickets/:id/comentarios` | cualquier autenticado |
| DELETE | `/api/tickets/:id` | Administrador |
| GET | `/api/dashboard/*` (9 rutas, una por consulta de `queries.sql`) | Administrador/Supervisor |

**Autorización por propiedad** (`autorizar-propiedad-ticket.ts`): el
segundo nivel que quedó pendiente en el módulo de auth. Administrador y
Supervisor operan sobre cualquier ticket; un Agente solo sobre los que
tiene `agenteId` asignado. Vive en el módulo de tickets (no en
`shared/middleware`) porque depende de un dato del recurso, no solo del
usuario — exactamente como se había anticipado.

**Reasignar es una acción de rol, no de propiedad**: un Agente no
reasigna ni siquiera sus propios tickets — es una decisión de gestión
("control de fricción operativa", como dice el comentario de la consulta 7
en `queries.sql`), separada de "actualizar lo que ya es mío". Se autoriza
por rol (`autorizarRol('administrador', 'supervisor')`), no por el
middleware de propiedad.

**Comentar no está sujeto a la restricción de propiedad**: cualquier
usuario autenticado puede comentar en cualquier ticket — es colaboración
entre personal sobre un caso, no una modificación del ticket en sí. No lo
pedía el enunciado explícitamente para comentarios (solo para "actualizar
tickets"), se decidió así por ser el comportamiento más útil y no
contradice lo pedido.

**Cambio de estado** (`cambiarEstado` en `tickets.service.ts`):
- Al pasar a `reabierto`: `fechaResolucion` se limpia (`null`) — pedido
  explícito, evita que las consultas 5 y 8 sigan contando el ticket como
  resuelto.
- Al pasar a `resuelto` (o directo a `cerrado`, sin pasar por `resuelto`):
  se fija `fechaResolucion = ahora`, **solo si todavía era `null`** — para
  no pisar la fecha real de resolución si un ticket ya resuelto se cierra
  después.
- **No se valida que la transición sea "legal"** (ej. nada impide pasar de
  `nuevo` directo a `cerrado`). No estaba pedido y una máquina de estados
  completa es alcance nuevo — queda en "Qué falta".

**Reasignación en transacción** (`reasignar` en `tickets.service.ts`):
`ticket.agenteId` y la fila nueva en `historial_asignaciones` se escriben
juntas con `prisma.$transaction([...])` — mismo mecanismo ya usado en
`crear` (cuando un ticket se crea con agente ya asignado).

**`DELETE` y las llaves foráneas**: `historial_asignaciones` y
`comentarios` apuntan a `tickets` con `ON DELETE RESTRICT` (ver
migración) — un ticket con historial o comentarios no se puede borrar.
"CRUD" lo pedía explícitamente, así que el endpoint existe, pero en la
práctica casi ningún ticket real será borrable (todo ticket asignado tiene
al menos una fila de historial). Se traduce el error de Postgres a un 409
claro (`Prisma.PrismaClientKnownRequestError`, código `P2003`) en vez de
dejarlo pasar como 500 genérico.

**Dashboard**: cada uno de los 9 endpoints corre, **literal**, la consulta
correspondiente de `queries.sql` vía `prisma.$queryRaw` — no se
reescriben como query builder de Prisma. Así el endpoint es demostrablemente
la misma consulta que ya se verificó a mano contra el seed, con el mismo
índice detrás. `COUNT(...)` en Postgres devuelve `bigint`, que Prisma trae
como `BigInt` de JS — no serializable directo a JSON (`JSON.stringify`
revienta) — se convierte a `number` antes de responder en las 9 funciones
de `dashboard.service.ts`.

**Bug real encontrado al verificar el módulo, no al construirlo**: el
seed (escrito antes de que existiera auth) guardaba un *placeholder* como
`password_hash`, no un hash real — nadie podía iniciar sesión con los
usuarios de demo. Se encontró probando el login contra el seed (no se
asumió que funcionaba) y se corrigió generando el hash real con
`hashearPassword` en `seed.ts`. Contraseña de todos los usuarios del seed:
`Demo1234!`. De paso apareció un segundo bug en el mismo archivo: el
orden de limpieza (`limpiar()`) no borraba `tokens_refresco` antes de
`usuarios`, así que reseedear después de haber iniciado sesión alguna vez
fallaba por llave foránea — corregido agregando ese `deleteMany` en el
orden correcto.

## Frontend

6 vistas: login, listado de tickets (filtros + paginación), detalle de
ticket (con comentarios y acciones), creación de ticket, dashboard
(distinto por rol), administración de usuarios (exclusiva de
Administrador). Estructura:

```
web/src/
  api-client.ts       cliente único de fetch: header de auth, 401, refresh
  auth/
    token-store.ts    tokens en memoria, fuera de React (ver abajo)
    AuthContext.tsx    estado de sesión, iniciarSesion/cerrarSesion
    RutaProtegida.tsx  puerta de navegación por sesión/rol
  componentes/         Layout (nav) y Badge (estado/prioridad) — solo lo
                        reutilizado por más de una vista
  paginas/              una por vista
  constantes.ts         estados/prioridades + etiquetas en español
  tipos.ts              formas de respuesta del API, a mano
  styles.css             único archivo de estilos
```

### Autenticación en el frontend: por qué el access token vive en memoria

Decisión ya tomada por Darío, documentada acá con el razonamiento completo
para la sustentación. `token-store.ts` guarda el access token y el refresh
token en una variable de módulo (`let`), **no** en `localStorage` ni
`sessionStorage`.

**Por qué**: `localStorage` es legible por cualquier script que corra en
la página. Si el frontend tuviera una vulnerabilidad XSS (una librería de
terceros comprometida, un campo de texto mal saneado que se renderiza como
HTML), ese script podría leer `localStorage.getItem('token')` y exfiltrar
un token que sigue siendo válido hasta que expire — hasta 15 minutos para
el access token, hasta 7 días si el refresh token también estuviera ahí.
Una variable en memoria no es accesible desde fuera del módulo que la
declara; un script inyectado tendría que ejecutar código dentro de esa
misma página en el momento justo, no simplemente leer un valor persistido.

**El costo real de esta decisión**: al no persistir nada, **recargar la
página cierra la sesión**. No hay una pantalla de carga inicial
"restaurando sesión" porque no hay nada que restaurar — `AuthProvider`
siempre arranca en `no-autenticado`. Es una fricción real de UX a cambio
de la mitigación de XSS.

**La alternativa robusta de verdad** (no implementada, ver "Qué falta"):
una cookie `httpOnly` para el refresh token, puesta por el servidor —
inaccesible para JavaScript incluso con XSS activo, y sobrevive a un
recargue de página. El access token seguiría en memoria (vive poco,
15 minutos, el costo de perderlo al recargar es bajo). Requiere cambios en
el backend (el login pondría la cookie en vez de devolver el refresh token
en el body) que no se hicieron ahora por alcance.

### Refresh automático — por qué deduplicar refrescos concurrentes no es opcional

`api-client.ts` reintenta una petición una sola vez si recibe 401: primero
intenta `/auth/refresh`, y si funciona, repite la petición original con el
token nuevo; si el refresh falla, cierra la sesión y redirige a login (vía
`notificarSesionExpirada` → `RutaProtegida`).

Esto por sí solo tiene un problema real con el propio diseño del backend:
el refresh token **rota** en cada uso y el backend **detecta reuso** (ver
README > Autenticación y autorización) — si dos peticiones expiran al
mismo tiempo y cada una dispara su propio `/auth/refresh` con el mismo
refresh token, la segunda en llegar se ve exactamente igual a un robo de
token, y el backend cerraría **todas** las sesiones del usuario. El
dashboard de Administrador/Supervisor dispara 10 peticiones en paralelo al
cargar — es el caso que lo haría fallar en la práctica, no un caso de
laboratorio. La solución es compartir una sola promesa de refresh entre
todas las peticiones que la disparan al mismo tiempo (`refrescoEnCurso` en
`api-client.ts`). No es una optimización: sin esto, "refresh automático"
no funciona de forma confiable con más de una petición en vuelo.

### Autorización en el frontend: solo usabilidad

Los controles que el rol no permite no se muestran (el enlace a Dashboard
oculto para Agente en `Layout.tsx`, el formulario de reasignar oculto si
no es Administrador/Supervisor, el de cambiar estado oculto si el Agente
no es el dueño del ticket en `TicketDetallePage.tsx`). **Esto es
únicamente para no mostrar un control que el servidor de todas formas va
a rechazar** — la autorización real (por rol y por propiedad del recurso)
ya se verifica en el servidor en cada petición, como quedó documentado en
los módulos de auth y de tickets. Si alguien manipula el frontend para
mostrar un botón oculto, la petición al API sigue devolviendo 403.

### Dos endpoints nuevos, necesarios para que las vistas funcionen

Ninguno estaba en el alcance original del backend — se agregaron ahora
porque sin ellos el formulario de creación y los filtros no pueden
funcionar (no hay forma razonable de pedirle a alguien que escriba un
UUID a mano en un formulario):

- `GET /api/clientes` (cualquier rol autenticado): lista mínima id+nombre.
  No hay CRUD de clientes en el enunciado, este es el único endpoint sobre
  ese modelo.
- `GET /api/usuarios/agentes` (cualquier rol autenticado, excepción
  montada antes de la puerta de Administrador en `usuarios.routes.ts`):
  lista mínima id+nombre+activo. La necesitan el formulario de creación y
  el de reasignación (que filtran a `activo === true` en el frontend —
  ver "Qué falta" sobre por qué el backend no valida esto todavía) y el
  filtro de "agente" del listado.

### El dashboard de Agente no usa `/api/dashboard/*`

El backend restringe todo `/api/dashboard/*` a Administrador/Supervisor
(decisión ya tomada en el módulo de tickets). Este mensaje pide,
explícitamente, que el Agente vea "su carga y sus tickets vencidos" en el
dashboard — un choque directo con esa restricción.

La solución no fue abrir el dashboard a todos los roles: `DashboardAgente`
(en `DashboardPage.tsx`) reusa `GET /api/tickets?agenteId=<su-id>`, que
**ya** está abierto a cualquier rol, y calcula "abierto" y "vencido"
(más de 48h sin actualizar) en el navegador sobre esos datos. Cero
endpoints nuevos para esta parte — el listado que ya existía alcanzaba.

### Una vista de dashboard nueva: tickets de agentes inactivos

Pedida explícita en este mensaje ("visible para supervisor y
administrador"), no es una de las 8 consultas de `queries.sql`. Se agregó
como una décima función en `dashboard.service.ts`
(`ticketsAgentesInactivos`), mismo patrón que las otras 9 (SQL directo,
sin parámetros externos). El seed se ajustó para que esta vista tenga algo
que mostrar en la demo: un ticket (`T13`) asignado a un agente que ya está
bloqueado — ver `api/prisma/seed.ts`.

### Administración de usuarios (exclusiva de Administrador)

Tabla (nombre, email, rol, estado activo/bloqueado) con botón bloquear/
desbloquear por fila, y un formulario de creación debajo — sin dependencias
nuevas, mismo estilo del resto. El backend ya tenía los endpoints desde el
módulo de auth; lo que faltaba era el frontend que los consumiera.

**Dos capas de protección, verificadas por separado, porque son cosas
distintas:**

1. **Usabilidad**: el enlace "Usuarios" en la navegación (`Layout.tsx`) y
   la ruta `/usuarios` (`RutaProtegida rolesPermitidos={['administrador']}`
   en `App.tsx`) solo se muestran/permiten para Administrador. Un Agente
   ni ve el enlace ni puede entrar a la ruta desde la SPA — esto se
   verificó por inspección de código (son condicionales deterministas
   sobre `usuario.rol`, sin estado async de por medio), no hay forma de
   que un Agente autenticado vea ese enlace.
2. **Seguridad real, en el servidor** — esto es lo que importa de verdad,
   y se verificó ejecutando peticiones reales contra el stack corriendo
   (no solo leyendo el código), con un token de Agente real, saltándose
   el frontend por completo:

   ```
   GET   /api/usuarios                    (Agente) -> 403
   PATCH /api/usuarios/:id/bloquear       (Agente) -> 403, sin efecto
                                                        (el usuario objetivo
                                                        siguió activo)
   ```

   Ambos por el mismo middleware que ya protegía estos endpoints desde el
   módulo de auth (`autorizarRol('administrador')`) — el frontend nuevo no
   cambió nada de eso, solo empezó a usarlo. Cubierto además con una
   prueba de integración nueva en `tests/auth.test.ts` (`rechaza por rol
   insuficiente sobre el endpoint de bloqueo de usuarios (agente)`), que
   además del status 403 confirma que el usuario objetivo no quedó
   bloqueado.

### Filtro de agente preseleccionado en el listado — usabilidad, no seguridad

Cuando quien inició sesión es Agente, el filtro "Agente" del listado de
tickets (`TicketsListaPage.tsx`) arranca con su propio id ya seleccionado,
en vez de vacío. Lo puede quitar (elegir "Todos") y ve el resto de los
tickets igual.

**Por qué es un valor por defecto y no una restricción**: el enunciado
original dice que Administrador y Supervisor pueden "consultar todos los
tickets", pero que el Agente puede "consultar tickets" — sin el "todos".
Podría leerse como una restricción de acceso, pero en una mesa de soporte
real eso no tiene sentido operativo: un agente necesita poder ver el
contexto de otros casos (un cliente que ya habló con otro agente antes, un
patrón que se repite) y a veces tiene que cubrir a un compañero que está
de vacaciones o bloqueado. Restringir la **lectura** le quitaría eso sin
ganar nada en seguridad, porque la restricción real y efectiva ya está en
la **escritura**: un Agente no puede actualizar, cambiar estado, ni
reasignar un ticket que no es suyo (autorización por propiedad, verificada
en el servidor). Preseleccionar su propio id es simplemente lo que un
agente quiere ver el 95% del tiempo al entrar — un atajo de usabilidad,
no una puerta.

### Tres bugs de infraestructura reales, encontrados levantando el stack completo

No en el código de este módulo — en la integración. Se encontraron
porque se levantó el stack de Docker real (`docker compose up --build`) y
se probó, no porque se leyera el Dockerfile con cuidado:

1. **`docker-compose.yml` nunca tenía `JWT_SECRET`** para el contenedor de
   la API — se agregó al `.env` local (para "sin Docker") pero nunca a la
   sección `environment` del servicio `api` en `docker-compose.yml`. El
   contenedor no arrancaba (`Configuracion invalida: JWT_SECRET Required`).
2. **`node:22-alpine` ya trae OpenSSL 3, no 1.1** — Prisma generó el motor
   de consultas para OpenSSL 1.1 (su detección automática se equivocó) y
   el contenedor fallaba al arrancar (`Error loading shared library
   libssl.so.1.1`). Se corrigió fijando `binaryTargets = ["native",
   "linux-musl-openssl-3.0.x"]` en `schema.prisma`.
3. **La detección de OpenSSL de Prisma necesita el binario `openssl`**, que
   no viene instalado en `node:22-alpine` — sin él, Prisma asumía 1.1.x
   por defecto sin importar el `binaryTargets` del punto anterior. Se
   agregó `RUN apk add --no-cache openssl` al Dockerfile de la API.

Los tres se verificaron reconstruyendo la imagen y confirmando que el
contenedor arranca limpio, sin warnings — no solo que el build no falla.

## Qué pasa con millones de registros: midiendo el índice de la consulta 3

Es una de las preguntas que van a hacer los CTO en la sustentación, así que
en vez de suponer que el índice `tickets(estado, fecha_actualizacion)` sirve
porque está declarado en el schema, se midió con `EXPLAIN ANALYZE` sobre
datos reales cargados en Postgres — no sobre los tickets del seed
(caben en una sola página, cualquier índice ahí es ruido), sino sobre
**1 millón de filas sintéticas** insertadas temporalmente con una
distribución realista (65% resueltos/cerrados, y del resto solo ~8% con más
de 48h sin tocarse — la mayoría de los tickets abiertos se actualiza
seguido). Se borraron después de medir; el seed que queda cargado en la
base es la del seed curado de siempre.

**Primer resultado, con la consulta escrita como en el enunciado
(`estado NOT IN ('cerrado', 'resuelto')`):** Postgres ignoró el índice
compuesto y usó *sequential scan* (paralelo, con 2 workers) — 260ms sobre 1M
de filas. Forzar el uso del índice a mano (`SET enable_seqscan = off`) lo
hizo más lento, no más rápido: 590ms.

**Por qué:** `NOT IN` se traduce internamente a `<> ALL (...)`, y un índice
B-tree no puede usar una condición de desigualdad como filtro de su columna
líder (`estado`) — solo puede usar igualdad o rangos. Con la columna líder
inutilizable, el índice queda reducido a filtrar solo por
`fecha_actualizacion`, recorriendo todos los valores de `estado` de todas
formas. Es decir: **el índice estaba bien diseñado, la consulta original
estaba escrita de una forma que no lo dejaba usarlo.**

**Segundo resultado, reescribiendo la misma consulta con una lista positiva**
(`estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')`
— los 5 estados que no son cerrado/resuelto, resultado idéntico): Postgres
usó el índice compuesto de forma natural, sin forzar nada — `Bitmap Index
Scan` sobre `tickets_estado_fecha_actualizacion_idx` con la condición
completa (`estado` y `fecha_actualizacion` juntos) resuelta dentro del
índice. Tiempo total: 266ms, prácticamente igual al *sequential scan* — a
un 8% de selectividad todavía están en el mismo orden de magnitud. La
ganancia real del índice crece a medida que la fracción de tickets
"olvidados" es más chica (un backlog sano tiene mucho menos que 8% de
tickets abandonados) — ahí es donde leer solo ese porcentaje del índice le
gana claramente a recorrer la tabla completa.

**Decisión que sale de esta medición:** `queries.sql` (consulta 3) quedó
escrita con `estado IN (...)` en vez de `estado NOT IN (...)`. Son
equivalentes en resultado — hoy el modelo tiene exactamente 7 estados, y
"no cerrado ni resuelto" es lo mismo que enumerar los otros 5 — pero no son
equivalentes en si el motor puede usar el índice. El costo de este cambio:
si algún día se agrega un octavo estado, hay que acordarse de sumarlo a la
lista `IN` de esta consulta (con `NOT IN` no haría falta tocarla). Se acepta
ese costo de mantenimiento a cambio de que la consulta sea la que
efectivamente puede volverse rápida cuando la tabla crezca.

## Qué falta y qué haría con más tiempo

> Deuda técnica consciente. Nombrar lo que quedó fuera por el límite de tiempo
> y cómo se resolvería, distinguiéndolo de lo que se desconoce.

- **Cookie `httpOnly` para el refresh token** en vez de guardarlo en
  memoria en el frontend. Es la mitigación robusta de verdad contra XSS —
  ver README > Frontend > "Autenticación en el frontend" para el
  razonamiento completo. No se implementó ahora: requiere que el login
  ponga la cookie desde el servidor en vez de devolver el refresh token en
  el body, y el cliente de fetch dejaría de necesitar pasarlo a mano.
- **`reasignar` no valida que el nuevo agente esté activo ni que tenga rol
  `agente`** (`tickets.service.ts`) — el frontend evita ofrecer una opción
  inválida filtrando el selector, pero nada en el servidor impide reasignar
  a un usuario bloqueado o a un Administrador si se llama al endpoint
  directo. Con más tiempo: validar `rol === 'agente' && activo` antes de
  escribir.
- **Filtros del listado de tickets no están en la URL** (`useState` local,
  no `useSearchParams`) — recargar la página o compartir un link pierde
  los filtros aplicados. Se prefirió así por simplicidad dado el tiempo
  disponible; sincronizarlos a la URL es un cambio acotado si hace falta.
- **No hay formulario de edición general del ticket** (título/descripción/
  prioridad/cliente) en el detalle — el endpoint `PATCH /api/tickets/:id`
  existe y tiene pruebas, pero el frontend solo expone cambio de estado y
  reasignación (las dos acciones que sí se nombraron explícitamente para
  esta vista).
- **Máquina de estados para `cambiarEstado`.** Hoy se acepta cualquier
  transición (ej. `nuevo` → `cerrado` directo, sin pasar por los estados
  intermedios). Con más tiempo: una tabla de transiciones válidas por
  estado, validada en el servicio antes de escribir.
- **Consolidar los 9 endpoints de dashboard** en uno o dos que devuelvan
  todo lo que la pantalla de dashboard necesita en una sola petición, si el
  frontend termina pidiéndolo así — hoy son 9 rutas 1 a 1 con las 9
  consultas de `queries.sql` a propósito (alcance cerrado, ver
  `docs/uso-ia.md`), no una decisión final de forma de API.
- **`resuelto_por_id` en `Ticket`** para que la consulta 4 (usuario con más
  tickets resueltos) atribuya la resolución a quien realmente resolvió el
  ticket, no al agente asignado actual — ver Supuestos para el detalle
  completo de esta limitación conocida.
- **Historial de estados para medir tiempo de resolución con precisión.**
  Hoy el tiempo de resolución (consulta 5) es `fecha_resolucion -
  fecha_creacion` sin descontar el tiempo en `en_espera_cliente`. Con más
  tiempo agregaría una tabla `historial_estados` (mismo patrón que
  `historial_asignaciones`: una fila por transición, con timestamp), y la
  consulta de tiempo de resolución sumaría solo los tramos en estados
  "activos" (excluyendo `en_espera_cliente`). Alternativa más barata sin
  tabla nueva: un contador `tickets.segundos_en_espera` que se incrementa
  cada vez que el ticket sale de `en_espera_cliente`, y la consulta resta
  ese acumulado — menos auditable que la tabla de historial, pero sin
  agregar una entidad nueva.
