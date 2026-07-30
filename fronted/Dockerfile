# ============================================================================
# Frontend POS — build estático servido por Caddy (que además hace de reverse
# proxy hacia el backend y termina el HTTPS automáticamente).
# ============================================================================

# ---- Etapa de build (Vite) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# La app y el API viven en el MISMO dominio (Caddy proxya /api y /socket.io al
# backend), así que las URLs son relativas y la imagen no queda atada a un dominio.
#   VITE_API_URL=/api/v1  → axios llama al mismo origen
#   VITE_SOCKET_URL=/     → socket.io se conecta al mismo origen
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

# ---- Etapa de runtime (Caddy) ----
FROM caddy:2-alpine AS runtime
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
