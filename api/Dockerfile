# syntax=docker/dockerfile:1
#
# Multi-stage build (Bölüm 14) — `deps` katmanı sadece bağımlılık kurulumunu
# cacheler, `build` TypeScript'i derler, `production` ise sadece prod
# bağımlılıklarını + derlenmiş çıktıyı içeren minimal image'dır. `node:24-alpine`
# resmi image'ı multi-arch'tır (amd64 + arm64) — Oracle Cloud'daki ARM
# sunucuya deploy için ek bir işlem gerekmez (Bölüm 14).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Derlenmiş JS + migration SQL dosyaları (migration'lar TypeScript
# derlemesinin parçası değil, doğrudan kaynaktan kopyalanır).
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/migrations ./src/db/migrations

EXPOSE 4000

# Container her başladığında önce migration'ları uygular (Bölüm 15, madde 6 —
# "elle unutulmamalı"), sonra sunucuyu başlatır. `db:migrate:prod`,
# `drizzle-kit`'i (devDependency) gerektirmeyen, drizzle-orm'un runtime
# migrator'ını kullanan bağımsız bir script'tir (bkz. src/db/migrate.ts).
CMD ["sh", "-c", "npm run db:migrate:prod && npm start"]
