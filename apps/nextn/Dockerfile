# ============================================
# Frontend (Next.js) — Standalone Image
# ============================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package*.json nx.json tsconfig*.json ./
COPY apps/nextn/ ./apps/nextn/
RUN npm ci --legacy-peer-deps

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/nx.json ./
COPY --from=deps /app/tsconfig*.json ./
COPY --from=deps /app/apps/nextn ./apps/nextn

WORKDIR /app/apps/nextn
RUN ../../node_modules/.bin/next build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9002
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/static ./apps/nextn/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/public ./apps/nextn/public

USER nextjs
EXPOSE 9002

CMD ["node", "apps/nextn/server.js"]
