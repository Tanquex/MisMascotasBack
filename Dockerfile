# ==========================================
# Multi-stage Dockerfile for NestJS (Production)
# ==========================================

# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# 2. Production Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user
USER node

# Expose port (Render overrides with its own PORT variable)
EXPOSE 3000

# Launch application
CMD ["node", "dist/main.js"]
