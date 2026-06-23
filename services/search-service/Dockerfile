# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/search-service/package.json ./services/search-service/

RUN npm ci --workspace=packages/shared --workspace=services/search-service

COPY packages/shared ./packages/shared
COPY services/search-service ./services/search-service
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=services/search-service
RUN npm run build --workspace=services/search-service

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/search-service/package.json ./services/search-service/

RUN npm ci --workspace=packages/shared --workspace=services/search-service --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/search-service/dist ./services/search-service/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@api-gateway-ms/search-prisma-client ./node_modules/@api-gateway-ms/search-prisma-client
COPY services/search-service/prisma ./services/search-service/prisma

EXPOSE 3004

USER node

CMD ["node", "services/search-service/dist/index.js"]
