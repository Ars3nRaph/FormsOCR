#!/usr/bin/env bash
set -e
if [ ! -d ".venv" ]; then python3 -m venv .venv; fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
export JWT_SECRET=dev-secret-change-me
export DEFAULT_PLAN=free
echo "Starting ROI Template OCR Studio (SaaS)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
