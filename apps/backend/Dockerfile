# ---------- BUILD ----------
FROM node:20 AS builder
WORKDIR /app

# HTTP_PROXY зөвхөн build үед — final image-д үлдэхгүй
ARG HTTP_PROXY
ARG HTTPS_PROXY

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY apps/backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY apps/backend ./
RUN npm run build

# ---------- RUNNER ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# curl: healthcheck-д хэрэгтэй
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodejs && useradd -r -g nodejs nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs
EXPOSE 3001

CMD ["node", "dist/main.js"]
