import os, shutil
import pandas as pd
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .models import Layout
from . import storage
from .ocr import process_batch, ENGINES_STATUS
from .utils_pdf import render_pdf_page_to_bgr
import cv2, numpy as np

MAX_FILE_MB = 10
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

app = FastAPI(title="ROI Template OCR Studio v4.0.8 (PDF+limit10MB, no Paddle)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN","*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def save_stream_limited(up: UploadFile, dst_path: str, limit: int = MAX_FILE_BYTES):
    total = 0
    with open(dst_path, 'wb') as out:
        while True:
            chunk = up.file.read(1024 * 1024)
            if not chunk: break
            total += len(chunk)
            if total > limit:
                out.close()
                try: os.remove(dst_path)
                except: pass
                raise HTTPException(413, f"File too large (> {MAX_FILE_MB} MB)")
            out.write(chunk)
    return total

@app.get("/api/health")
def health():
    return {"status":"ok"}

@app.get("/api/engines")
def engines():
    return {"ok": True, **ENGINES_STATUS}

@app.get("/api/projects")
def api_list_projects():
    try:
        return {"ok": True, "projects": storage.list_projects()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.post("/api/projects")
def api_new_project(name: str = Form(...)):
    pid = storage.new_project(name)
    storage.save_json(pid, 'project.json', {"name": name})
    return {"ok": True, "project_id": pid}

@app.get("/api/projects/{pid}")
def api_get_project(pid: str):
    try:
        meta = storage.load_json(pid, 'project.json')
        return {"ok": True, "project": meta, "project_id": pid}
    except FileNotFoundError:
        raise HTTPException(404, "Project not found")
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.delete("/api/projects/{pid}")
def api_delete_project(pid: str):
    try:
        storage.delete_project(pid); return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.post("/api/projects/{pid}/template")
def api_upload_template(pid: str, file: UploadFile = File(...), page: Optional[int] = Form(default=1)):
    try:
        pdir = storage.project_dir(pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".png",".jpg",".jpeg",".pdf"]:
            raise HTTPException(400,"Only PNG/JPG/PDF supported")
        raw_path = os.path.join(pdir, f"template{ext}")
        save_stream_limited(file, raw_path)
        if ext == ".pdf":
            img = render_pdf_page_to_bgr(raw_path, page=page or 1, dpi=300)
            png_path = os.path.join(pdir, "template_raster.png")
            cv2.imwrite(png_path, img)
            h, w = img.shape[:2]
            meta = storage.load_json(pid, 'project.json')
            meta.update({"template_path": png_path, "template_pdf": raw_path, "template_pdf_page": int(page or 1), "template_width": w, "template_height": h})
            storage.save_json(pid, 'project.json', meta)
            return {"ok": True, "template_path": png_path, "width": w, "height": h, "ext": ".png", "from_pdf": True, "page": int(page or 1)}
        else:
            from PIL import Image
            with Image.open(raw_path) as im: w,h = im.size
            meta = storage.load_json(pid, 'project.json')
            meta.update({"template_path": raw_path, "template_width": w, "template_height": h})
            storage.save_json(pid, 'project.json', meta)
            return {"ok": True, "template_path": raw_path, "width": w, "height": h, "ext": ext}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/api/projects/{pid}/template-image")
def api_template_image(pid: str):
    try:
        meta = storage.load_json(pid, 'project.json'); path = meta.get("template_path")
        if not path or not os.path.isfile(path): raise HTTPException(404,"Template image not found")
        ext = os.path.splitext(path)[1].lower(); media = "image/png" if ext==".png" else "image/jpeg"
        return FileResponse(path, media_type=media)
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.post("/api/projects/{pid}/layout")
def api_save_layout(pid: str, layout: Layout):
    try:
        pdir = storage.project_dir(pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        meta = storage.load_json(pid, 'project.json')
        meta['layout'] = layout.dict()
        storage.save_json(pid, 'project.json', meta)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/api/projects/{pid}/outputs")
def api_outputs(pid: str):
    try: return {"ok": True, "files": storage.list_outputs(pid)}
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/api/projects/{pid}/download/{fname}")
def api_download(pid: str, fname: str):
    try:
        pdir = storage.project_dir(pid); fpath = os.path.join(pdir, "outputs", fname)
        if not os.path.isfile(fpath): raise HTTPException(404,"File not found")
        return FileResponse(fpath, media_type="text/csv", filename=fname)
    except HTTPException: raise
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.post("/api/projects/{pid}/process")
def api_process(pid: str, files: List[UploadFile] = File(...), pdf_page: Optional[int] = Form(default=1)):
    try:
        pdir = storage.project_dir(pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        meta = storage.load_json(pid, 'project.json')
        if not meta.get('template_path') or not meta.get('layout'): raise HTTPException(400,"Template and layout required")
        up = os.path.join(pdir, 'uploads'); os.makedirs(up, exist_ok=True)
        raster_dir = os.path.join(pdir, 'uploads_raster'); os.makedirs(raster_dir, exist_ok=True)
        raster_paths = []
        for uf in files:
            ext = os.path.splitext(uf.filename)[1].lower()
            if ext not in [".png",".jpg",".jpeg",".pdf"]: 
                continue
            dst = os.path.join(up, uf.filename)
            save_stream_limited(uf, dst)
            if ext == ".pdf":
                img = render_pdf_page_to_bgr(dst, page=pdf_page or 1, dpi=300)
                out_name = f"{os.path.splitext(os.path.basename(dst))[0]}-p{int(pdf_page or 1)}.png"
                out_path = os.path.join(raster_dir, out_name)
                cv2.imwrite(out_path, img)
                raster_paths.append(out_path)
            else:
                raster_paths.append(dst)
        if not raster_paths: raise HTTPException(400,"No valid images/PDFs uploaded")
        rows = process_batch(meta['template_path'], meta['layout'], raster_paths)
        df = pd.DataFrame(rows); out_dir = os.path.join(pdir, 'outputs'); os.makedirs(out_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d-%H%M%S'); fname = f"results-{ts}.csv"; csv_path = os.path.join(out_dir, fname)
        df.to_csv(csv_path, index=False)
        return {"ok": True, "rows": rows, "csv": csv_path.replace('\\\\','/'), "csv_url": f"/api/projects/{pid}/download/{fname}"}
    except HTTPException: raise
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
