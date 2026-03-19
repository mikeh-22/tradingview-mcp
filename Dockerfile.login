# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Uses Microsoft's official Playwright image which ships Chromium and all
# required system dependencies out of the box.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Install only Chromium (skip Firefox/WebKit to keep the image smaller)
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

# Chromium requires --no-sandbox inside containers
ENV DOCKER=1
ENV TV_SESSION_FILE=/data/.tv_session.json
ENV NODE_ENV=production

# Session volume — must match the volume mounted on the MCP server container
VOLUME ["/data"]

ENTRYPOINT ["node", "dist/login.js"]
