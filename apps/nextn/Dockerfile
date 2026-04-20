# FROM node:20 AS builder
# WORKDIR /app

# COPY package*.json nx.json tsconfig*.json ./
# RUN npm ci --legacy-peer-deps

# COPY . .
# WORKDIR /app/apps/nextn
# RUN npx next build


# FROM node:20-slim AS runner
# WORKDIR /app

# RUN apt-get update && apt-get install -y curl

# ENV NODE_ENV=production
# ENV PORT=9002
# ENV HOSTNAME=0.0.0.0

# RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# # COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/standalone ./
# # COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/static ./.next/static
# # COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/public ./public
# COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/.next ./.next
# COPY --from=builder --chown=nextjs:nodejs /app/apps/nextn/public ./public

# USER nextjs
# EXPOSE 9002

# # CMD ["node", "server.js"]
# CMD ["node", "apps/nextn/server.js"]


# ---------- BUILD ----------
# ---------- BUILD ----------
# ---------- BUILD ----------
# ---------- BUILD ----------
FROM node:20 AS builder
WORKDIR /app

COPY package*.json nx.json tsconfig*.json ./
RUN npm ci --legacy-peer-deps

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