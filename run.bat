@echo off
setlocal
if not exist venv ( python -m venv venv )
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
set JWT_SECRET=dev-secret-change-me
set DEFAULT_PLAN=free
echo.
echo Starting ROI Template OCR Studio (SaaS)...
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
