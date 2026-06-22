# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/event-service/package.json ./services/event-service/

RUN npm ci --workspace=packages/shared --workspace=services/event-service

COPY packages/shared ./packages/shared
COPY services/event-service ./services/event-service
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=services/event-service
RUN npm run build --workspace=services/event-service

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/event-service/package.json ./services/event-service/

RUN npm ci --workspace=packages/shared --workspace=services/event-service --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/event-service/dist ./services/event-service/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@api-gateway-ms/event-prisma-client ./node_modules/@api-gateway-ms/event-prisma-client
COPY services/event-service/prisma ./services/event-service/prisma

EXPOSE 3002

USER node

CMD ["node", "services/event-service/dist/index.js"]
