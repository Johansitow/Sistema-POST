# ============================================================================
# Backend POS — imagen de producción (multi-stage)
# Base Debian slim (glibc) para que bcrypt y Prisma usen binarios precompilados.
# ============================================================================

# ---- Etapa de build ----
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- Etapa de runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Solo dependencias de producción (prisma CLI está en dependencies).
COPY package*.json ./
RUN npm ci --omit=dev

# Cliente Prisma (necesita el schema) + código compilado.
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist

# Entrypoint: aplica migraciones y arranca el servidor.
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
