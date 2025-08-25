@echo off
setlocal
cd /d "%~dp0"
echo Installing PaddleOCR (CPU) and ONNX runtime (optional for RapidOCR)...
".venv\Scripts\python.exe" -m pip install --upgrade pip wheel setuptools
".venv\Scripts\python.exe" -m pip install paddleocr
".venv\Scripts\python.exe" -m pip install onnxruntime
echo Done. Please restart run_ocr_studio.bat
