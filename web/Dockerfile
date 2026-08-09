# syntax=docker/dockerfile:1
#
# Multi-stage build (Bölüm 14). `node:24-alpine` multi-arch'tır (amd64 + arm64)
# — Oracle Cloud'daki ARM sunucuya deploy için ek bir işlem gerekmez.
#
# ⚠️ NEXT_PUBLIC_API_URL, tarayıcıda çalışan client bundle'a BUILD SIRASINDA
# gömülür (runtime env değişkeni değil) — bu yüzden bir build ARG olarak
# alınıp `next build`'den önce ENV'e yazılmalı. Değeri docker-compose.yml
# üzerinden kök .env'den geliyor; burada hardcode edilmiyor (Bölüm 15,
# madde 7 — domain kararına bağlı).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# `output: 'standalone'` (next.config.ts) sadece gerekli node_modules alt
# kümesini + derlenmiş sunucuyu içeren minimal bir klasör üretir.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
