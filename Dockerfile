# ==========================================
# Multi-stage Dockerfile for NestJS (Production)
# ==========================================

# 1. Build Stage
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# 2. Production Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user
USER node

# Launch application with memory safeguard for Render 512MB free tier
CMD ["node", "--max-old-space-size=400", "dist/main.js"]

