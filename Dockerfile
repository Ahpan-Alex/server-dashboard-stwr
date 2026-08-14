# syntax=docker/dockerfile:1
# Build context: server-dashboard-stwr (repo root)
# Dokploy: Dockerfile path = Dockerfile, context = .

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @stwr/shared
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 stwr \
  && useradd --system --uid 1001 --gid stwr stwr

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R stwr:stwr /app

USER stwr
WORKDIR /app/apps/api
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
