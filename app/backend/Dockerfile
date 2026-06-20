# Build context: repo root (set in docker-compose.yml)
# Reason: backend tsconfig includes packages/shared and app/services/* — all must be in context.
# Runtime: tsx (resolves tsconfig path aliases natively, avoids alias rewriting after tsc).

FROM node:20-alpine
WORKDIR /repo

# Install deps in dependency order (layer cache friendly)
COPY packages/shared/package.json packages/shared/package-lock.json* packages/shared/
RUN cd packages/shared && npm ci --omit=dev

COPY app/services/rag/package.json app/services/rag/package-lock.json* app/services/rag/
RUN cd app/services/rag && npm ci --omit=dev

COPY app/services/llm/package.json app/services/llm/package-lock.json* app/services/llm/
RUN cd app/services/llm && npm ci --omit=dev

# Backend: full install (tsx is a devDep but needed at runtime for alias resolution)
COPY app/backend/package.json app/backend/package-lock.json* app/backend/
RUN cd app/backend && npm ci

# Source
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY app/services/rag app/services/rag
COPY app/services/llm app/services/llm
COPY app/backend/src app/backend/src
COPY app/backend/tsconfig.json app/backend/tsconfig.json

WORKDIR /repo/app/backend
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
