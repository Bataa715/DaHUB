# ============================================
# Backend (NestJS + ClickHouse)
# ============================================
FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++

# --- Production dependencies ---
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi && npm cache clean --force

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi
COPY . .
RUN npm run build

# --- Production ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

RUN mkdir -p /app/data/rag_uploads /app/data/training-data /app/data/vector_store && \
    chown -R nestjs:nodejs /app/data

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs
EXPOSE 3001

CMD ["node", "dist/main"]
