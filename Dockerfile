
# Railway-optimized Dockerfile for FormsOCR Backend
FROM node:18-alpine AS base

# Install system dependencies for OCR and build tools
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    tesseract-ocr \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-spa \
    imagemagick \
    poppler-utils \
    ghostscript \
    curl \
    && rm -rf /var/cache/apk/*

# Install Python OCR dependencies
RUN pip3 install --no-cache-dir rapidocr-onnxruntime

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy package files for better caching
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/temp /app/results /app/logs && \
    chmod -R 755 /app/uploads /app/temp /app/results /app/logs && \
    chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port (Railway uses dynamic PORT)
EXPOSE 8080

# Health check optimized for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Set NODE_ENV
ENV NODE_ENV=production

# Start command
CMD ["node", "dist/server.js"]
