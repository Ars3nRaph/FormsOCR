FROM node:18-alpine

RUN apk add --no-cache \
  tesseract-ocr \
  # vérifier les noms des paquets langue sur ta version d'alpine :
  # tesseract-ocr-data-eng tesseract-ocr-data-fra tesseract-ocr-data-deu tesseract-ocr-data-spa \
  poppler-utils ghostscript \
  python3 py3-pip build-base \
  curl

WORKDIR /app
COPY package*.json ./
# Pour builder: installe TOUT (dev + prod)
RUN npm ci
COPY . .
RUN npm run build
# Prune en prod
RUN npm prune --omit=dev && npm cache clean --force

RUN mkdir -p uploads temp results && chmod 755 uploads temp results

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["npm", "start"]
