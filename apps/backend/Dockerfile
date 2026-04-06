# ---------- BUILD ----------
FROM node:20 AS builder

WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY


RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# backend package.json copy
COPY apps/backend/package*.json ./

RUN npm ci

# copy source
COPY apps/backend ./

RUN npm run build

# ---------- RUNNER ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN apt-get update && \
    apt-get install -y python3 python3-pip curl && \
    rm -rf /var/lib/apt/lists/*
COPY apps/backend/python/requirements.txt .

# 👇 Python packages install
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt
RUN groupadd -r nodejs && useradd -r -g nodejs nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs
EXPOSE 3001

CMD ["node", "dist/main.js"]