FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
# Prisma detecta la versión de OpenSSL corriendo el binario `openssl` — sin
# él (no viene instalado en node:22-alpine) la detección falla y Prisma
# asume por defecto OpenSSL 1.1, que ya no existe en esta imagen (trae 3.x).
# Sin esto el motor de Prisma no carga y la API no arranca — se encontró
# levantando el contenedor real, no leyendo el Dockerfile.
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS dev
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
