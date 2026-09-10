# Contexto del proyecto

Prueba técnica para el cargo de **Tech Lead Full Stack** en Infinivirt
Technologies (Medellín), integrador de telefonía IP. Entrega: viernes 11 de
septiembre de 2026, 2:00 p. m.

## El reto

Plataforma interna de gestión de tickets de soporte:

- Autenticación con roles: **Administrador, Agente, Supervisor**.
- Gestión de tickets con estados y prioridades.
- Frontend React: login, dashboard con métricas, listado con filtros, detalle
  con comentarios, creación de tickets.
- API REST en Node con validación de entrada, manejo centralizado de errores
  y respuestas consistentes.
- Base de datos relacional.
- Dedicación estimada por el enunciado: 8 a 14 horas.

**Entregable adicional obligatorio:** `queries.sql` con 8 consultas
analíticas sobre el modelo.

## Después de entregar

Sustentación en vivo ante CTO y dueños de la compañía. Temas anticipados:

- Uso de IA: por qué, qué porcentaje del trabajo, qué valor aportó.
- Estructura y lógica del código.
- Dónde y cómo se gestionan las bases de datos.
- Metodología usada.
- Manejo de millones de registros y optimización del consumo de la API para
  reducir costos.
- Administración de usuarios y qué pasa cuando un usuario es bloqueado.
- Seguridad.

**Consecuencia directa para cómo se trabaja aquí:** Darío tiene que poder
explicar cada línea en vivo. Se prefiere código simple y defendible sobre
código sofisticado que no se pueda sustentar. Si algo es más complejo de lo
necesario, la IA debe proponer la versión simple y decir explícitamente qué
se pierde con ella.

## Estado del repo

Andamiaje ya montado: Node + TypeScript + Express + Prisma + PostgreSQL,
React + Vite, Docker Compose, Vitest y GitHub Actions. Aún no hay dominio ni
autenticación. **El stack es fijo** (declarado en la postulación a la
empresa): no se cambia sin que Darío lo apruebe explícitamente.

Estructura:

```
api/
  src/
    config/       configuración validada al arranque (Zod, falla rápido)
    shared/       utilidades transversales (HttpError, error-handler, logger, prisma)
    modules/      un directorio por dominio: rutas, controlador, servicio
    routes.ts     registro único de módulos (no se toca app.ts al agregar uno)
    app.ts        construcción de la app (sin abrir puerto, para testear con supertest)
    server.ts     arranque y apagado ordenado (SIGTERM/SIGINT)
  tests/          pruebas de integración contra la app en memoria
  prisma/         esquema y migraciones
web/
  src/            interfaz React, con un único cliente de API (api-client.ts)
```

Convenciones ya establecidas (ver `modules/health` como referencia): rutas
finas que delegan a controller, controller que delega a service, errores vía
`HttpError` + middleware único, validación de entrada con Zod cuyo `ZodError`
el middleware de errores ya sabe formatear.

## Cómo trabajar en este repo

- **Antes de cambios de arquitectura o de agregar dependencias**: proponer y
  esperar aprobación de Darío. Explicar el porqué, no solo el qué.
- **README.md**: cada decisión de diseño se anota en las secciones
  "Decisiones y justificación" y "Supuestos" en el momento de tomarla, no al
  final. Formato de la tabla de decisiones: qué se decidió, qué alternativa
  se descartó, por qué.
- **docs/uso-ia.md**: registro de uso de IA para la sustentación — qué se
  pidió, qué se aceptó, qué se rechazó y por qué. Se actualiza en el momento,
  no al cierre.
- **Commits**: pequeños, descriptivos, en español, estilo Conventional
  Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- **Pruebas**: todo módulo nuevo lleva al menos una prueba de integración con
  Vitest (siguiendo el patrón de `tests/health.test.ts`: levantar `createApp()`
  y pegarle con supertest, sin abrir puerto ni depender de un estado externo
  que no se controle en el test).
- **TypeScript estricto**, sin `any`. El `tsconfig.json` ya tiene
  `strict: true` y `noUncheckedIndexedAccess: true`; no se relaja.
- **Explicar mientras se hace**: el objetivo no es solo que el código quede
  listo, es que Darío lo entienda lo suficiente para sustentarlo línea por
  línea frente al CTO.

## Verificación estándar

```bash
cd api && npm install && npm run prisma:generate && npm run typecheck && npm test
cd web && npm install && npm run typecheck
```

CI (`.github/workflows/ci.yml`) corre typecheck + test en `api/` y
typecheck + build en `web/` en cada push.
