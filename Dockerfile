# Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dépendances système pour OpenCV + Tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend /app/backend
COPY frontend /app/frontend

# Astuce: si le build échoue faute de RAM, commente paddleocr dans requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r backend/requirements.txt

# PORT imposé par Railway via env PORT
ENV PORT=8080
EXPOSE 8080

# Utilise le PORT fourni par Railway si présent
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
