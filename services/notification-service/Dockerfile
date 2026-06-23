# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/notification-service/package.json ./services/notification-service/

RUN npm ci --workspace=packages/shared --workspace=services/notification-service

COPY packages/shared ./packages/shared
COPY services/notification-service ./services/notification-service
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=services/notification-service
RUN npm run build --workspace=services/notification-service

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/notification-service/package.json ./services/notification-service/

RUN npm ci --workspace=packages/shared --workspace=services/notification-service --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@api-gateway-ms/notification-prisma-client ./node_modules/@api-gateway-ms/notification-prisma-client
COPY services/notification-service/prisma ./services/notification-service/prisma

EXPOSE 3003

USER node

CMD ["node", "services/notification-service/dist/index.js"]
