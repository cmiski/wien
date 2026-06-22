# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/user-service/package.json ./services/user-service/

RUN npm ci --workspace=packages/shared --workspace=services/user-service

COPY packages/shared ./packages/shared
COPY services/user-service ./services/user-service
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=services/user-service
RUN npm run build --workspace=services/user-service

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/user-service/package.json ./services/user-service/

RUN npm ci --workspace=packages/shared --workspace=services/user-service --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@api-gateway-ms/user-prisma-client ./node_modules/@api-gateway-ms/user-prisma-client
COPY services/user-service/prisma ./services/user-service/prisma

EXPOSE 3001

USER node

CMD ["node", "services/user-service/dist/index.js"]
