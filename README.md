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

Aplicar las migraciones de base de datos:

```bash
docker compose exec api npx prisma migrate dev
```

### Sin Docker

```bash
cd api && npm install && npm run prisma:generate && npm run dev
cd web && npm install && npm run dev
```

## Pruebas

```bash
cd api && npm test
cd api && npm run typecheck
```

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

> Diagrama o descripción de las entidades y sus relaciones. Explicar las decisiones
> de modelado que no sean obvias: por qué esa cardinalidad, por qué ese índice,
> qué se guarda desnormalizado y por qué.

## Decisiones y justificación

> Una entrada por decisión, escrita en el momento de tomarla y no al final.
> Formato: qué se decidió, qué alternativa se descartó y por qué.

| Decisión | Alternativa descartada | Razón |
| --- | --- | --- |
| Separar `app.ts` de `server.ts` | Levantar el servidor en el mismo archivo | Permite probar el API en memoria con supertest, sin puertos ni esperas |
| Validar la configuración con Zod al arranque | Leer `process.env` donde se necesite | Un servicio mal configurado falla de inmediato y con mensaje claro, no en la primera petición |
| Errores como clase `HttpError` con middleware único | `res.status().json()` en cada controlador | Un solo formato de error en todo el API y un solo lugar donde cambiarlo |

## Supuestos

> Todo lo que el enunciado no especificaba y hubo que asumir. Esta sección vale
> tanto como el código: muestra qué preguntas se hicieron sobre el problema.

## Qué falta y qué haría con más tiempo

> Deuda técnica consciente. Nombrar lo que quedó fuera por el límite de tiempo
> y cómo se resolvería, distinguiéndolo de lo que se desconoce.
