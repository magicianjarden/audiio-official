# Audiio Standalone Server - Docker Image
#
# Build:
#   docker build -t audiio/server .
#
# Run:
#   docker run -d -p 8484:8484 -v audiio-data:/data audiio/server

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ git

# Copy workspace files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm ci --workspace=@audiio/core --workspace=@audiio/server

# Copy source code
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY tsconfig*.json ./

# Build
RUN npm run build --workspace=@audiio/core
RUN npm run build --workspace=@audiio/server

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

# Create non-root user
RUN addgroup -g 1001 audiio && \
    adduser -u 1001 -G audiio -s /bin/sh -D audiio

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Create data directories
RUN mkdir -p /data/plugins /data/cache && \
    chown -R audiio:audiio /data /app

# Switch to non-root user
USER audiio

# Environment configuration
ENV NODE_ENV=production
ENV AUDIIO_PORT=8484
ENV AUDIIO_HOST=0.0.0.0
ENV AUDIIO_PLUGINS_DIR=/data/plugins
ENV AUDIIO_DATABASE=/data/audiio.db
ENV AUDIIO_CACHE_DIR=/data/cache
ENV AUDIIO_LOG_LEVEL=info

# Expose port
EXPOSE 8484

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8484/health || exit 1

# Data volume
VOLUME ["/data"]

# Start server
CMD ["node", "packages/server/dist/index.js"]
