# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Slim image — no Playwright browser. Requires a pre-existing session file
# mounted at TV_SESSION_FILE (default: /data/.tv_session.json).
FROM node:22-slim AS runner

WORKDIR /app

# Install production deps only, skip playwright browser download
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

# Tell auth.ts to skip the browser and give a helpful error if no session exists
ENV DOCKER=1
ENV TV_SESSION_FILE=/data/.tv_session.json
ENV NODE_ENV=production

# Session volume — mount a named volume or host directory here
VOLUME ["/data"]

ENTRYPOINT ["node", "dist/index.js"]
