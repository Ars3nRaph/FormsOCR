@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"
if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" (
  set "TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe"
)
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv .venv
)
echo Installing dependencies...
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
start "" "http://127.0.0.1:8000/"
if defined TESSERACT_CMD ( set "TESSERACT_CMD=%TESSERACT_CMD%" )
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
