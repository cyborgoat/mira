# Multi-stage Dockerfile for Mira Web Frontend
# Stage 1: Builder - Build React application
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build production bundle
RUN npm run build


# Stage 2: Runtime - Serve with Nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for Nginx
RUN adduser -D -u 1000 mira && \
    chown -R mira:mira /usr/share/nginx/html && \
    chown -R mira:mira /var/cache/nginx && \
    chown -R mira:mira /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown mira:mira /var/run/nginx.pid

# Switch to non-root user
USER mira

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
