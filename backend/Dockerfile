# ── Stage 1: Dependencies ────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files only (layer cache)
COPY package*.json ./
RUN npm ci --production

# ── Stage 2: Final image ─────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Non-root user for security
RUN addgroup -S meetsync && adduser -S meetsync -G meetsync

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY package.json ./

# Temp directory for audio processing
RUN mkdir -p /tmp/meetsync-uploads && chown meetsync:meetsync /tmp/meetsync-uploads

USER meetsync

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health/ready || exit 1

CMD ["node", "src/index.js"]
