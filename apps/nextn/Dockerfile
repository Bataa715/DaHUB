# ---------- BUILD ----------
FROM node:20 AS builder
WORKDIR /app

COPY package*.json nx.json tsconfig*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY . .
WORKDIR /app/apps/nextn
RUN npx next build


# ---------- RUNNER ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9002
ENV HOSTNAME=0.0.0.0

RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# standalone runtime
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/standalone ./

# static MUST go into apps/nextn/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/static ./apps/nextn/.next/static

# public
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/public ./apps/nextn/public

USER nextjs
EXPOSE 9002

CMD ["node", "apps/nextn/server.js"]


# CMD ["node", "server.js"]