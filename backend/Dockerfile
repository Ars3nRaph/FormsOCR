FROM python:3.11-slim

# System deps (tesseract + FR, and glib for headless OpenCV/pdfium)
RUN apt-get update && apt-get install -y --no-install-recommends     tesseract-ocr tesseract-ocr-fra libglib2.0-0   && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code and frontend static files
COPY ./app /app/app
COPY ./frontend /app/frontend

# Runtime env
ENV PYTHONUNBUFFERED=1     JWT_SECRET=change-me-in-prod     DEFAULT_PLAN=free

EXPOSE 8000
# Bind to $PORT if provided (Railway/Heroku), fallback 8000 for local/dev
CMD ["/bin/bash","-lc","uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
