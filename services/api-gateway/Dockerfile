# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api-gateway/package.json ./services/api-gateway/

# Install all dependencies (workspaces)
RUN npm ci --workspace=packages/shared --workspace=services/api-gateway

# Copy source
COPY packages/shared ./packages/shared
COPY services/api-gateway ./services/api-gateway
COPY tsconfig.base.json ./

# Build shared then gateway
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/api-gateway

# ─── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only prod dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci --workspace=packages/shared --workspace=services/api-gateway --omit=dev

# Copy built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

EXPOSE 3000

USER node

CMD ["node", "services/api-gateway/dist/index.js"]
