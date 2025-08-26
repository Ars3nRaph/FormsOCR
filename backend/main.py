from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
app=FastAPI()
FRONTEND_DIR = __import__('os').path.join(__import__('os').path.dirname(__file__),'..','frontend')
app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')
