FROM node:20-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0 \
  LOCOPREP_DB_PATH=/data/locoprep.db \
  LOCOPREP_CONFIG_PATH=/data/locoprep.config.json

WORKDIR /app

RUN mkdir -p /data

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]