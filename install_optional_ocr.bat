@echo off
call venv\Scripts\activate
pip install rapidocr-onnxruntime onnxruntime paddleocr
echo Done. If PaddleOCR errors persist, run this as Administrator.
