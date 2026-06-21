# Build context: app/frontend (set in docker-compose.yml)
# Next.js runs in standard server mode (no standalone output needed).
# BACKEND_URL is a runtime env var used by next.config.ts rewrites (server-side).
# NEXT_PUBLIC_* vars are baked at build time — only public ones go here.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Disable telemetry and skip linting on CI build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
# next start default port is 3000; the package.json "start" script uses -p 3001 for local dev.
# Override to 3000 so docker-compose can map 3001:3000.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
