FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

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
