FROM node:24-bullseye-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate \
  && npm prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY .env.example ./.env.example

RUN groupadd --system inventory \
  && useradd --system --gid inventory --create-home --home-dir /home/inventory inventory \
  && chown -R inventory:inventory /app

USER inventory

EXPOSE 2500

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:2500/health/ready', res=>process.exit(res.statusCode===200?0:1)); req.on('error', ()=>process.exit(1));"

CMD ["node", "src/server.js"]
