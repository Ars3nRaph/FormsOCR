ENGINES_STATUS={'tesseract':True,'rapid':False,'rapid_error':''}
from rapidocr_onnxruntime import RapidOCR
try:
    RapidOCR(); ENGINES_STATUS['rapid']=True
except Exception as e:
    ENGINES_STATUS['rapid_error']=str(e)
