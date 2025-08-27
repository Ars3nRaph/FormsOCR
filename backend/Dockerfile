FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-fra libglib2.0-0 libgl1 libgomp1 \  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \    && pip install --no-cache-dir --force-reinstall --no-deps "opencv-python-headless>=4.7,<5"

# Copy backend & frontend
COPY ./app /app/app
COPY ./frontend /app/frontend

ENV PYTHONUNBUFFERED=1 \    JWT_SECRET=change-me-in-prod \    DEFAULT_PLAN=free

EXPOSE 8000
CMD ["bash","-lc","uvicorn app.main:app --host 0.0.0.0 --port {${PORT:-8000}"]
