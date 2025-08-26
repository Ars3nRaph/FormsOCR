import os, cv2, pandas as pd
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .models import Layout
from . import storage
from .ocr import process_batch
from .utils_pdf import render_pdf_page_to_bgr

MAX_FILE_MB=10
MAX_FILE_BYTES=MAX_FILE_MB*1024*1024

app=FastAPI(title='ROI Template OCR Studio v4.1.1 (PDF page switch fix)')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

def save_stream_limited(up: UploadFile, dst_path: str, limit: int = MAX_FILE_BYTES):
    total=0
    with open(dst_path,'wb') as out:
        while True:
            chunk=up.file.read(1024*1024)
            if not chunk: break
            total+=len(chunk)
            if total>limit:
                out.close()
                try: os.remove(dst_path)
                except: pass
                raise HTTPException(413, f'File too large (> {MAX_FILE_MB} MB)')
            out.write(chunk)
    return total

@app.get('/api/projects')
def api_list_projects():
    return {'ok':True,'projects': storage.list_projects()}

@app.post('/api/projects')
def api_new_project(name: str = Form(...)):
    pid=storage.new_project(name)
    storage.save_json(pid,'project.json',{'name':name})
    return {'ok':True,'project_id':pid}

@app.get('/api/projects/{pid}')
def api_get_project(pid: str):
    meta=storage.load_json(pid,'project.json')
    return {'ok':True,'project':meta,'project_id':pid,'is_pdf':bool(meta.get('template_pdf')),'pdf_page':meta.get('template_pdf_page'),'pdf_pages':meta.get('template_pdf_pages')}

@app.post('/api/projects/{pid}/template')
def api_upload_template(pid: str, file: UploadFile = File(...), page: Optional[int] = Form(default=1)):
    pdir=storage.project_dir(pid)
    ext=os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png','.jpg','.jpeg','.pdf']: raise HTTPException(400,'Only PNG/JPG/PDF supported')
    raw=os.path.join(pdir, f'template{ext}')
    save_stream_limited(file, raw)
    meta=storage.load_json(pid,'project.json')
    if ext=='.pdf':
        img,pages,used=render_pdf_page_to_bgr(raw, page=page or 1, dpi=300)
        png=os.path.join(pdir,'template_raster.png'); cv2.imwrite(png,img)
        h,w=img.shape[:2]
        meta.update({'template_path':png,'template_pdf':raw,'template_pdf_page':int(used),'template_pdf_pages':int(pages),'template_width':w,'template_height':h})
        storage.save_json(pid,'project.json',meta)
        return {'ok':True,'from_pdf':True,'page':int(used),'pages':int(pages)}
    else:
        from PIL import Image
        with Image.open(raw) as im: w,h=im.size
        meta.update({'template_path':raw,'template_pdf':None,'template_pdf_page':None,'template_pdf_pages':None,'template_width':w,'template_height':h})
        storage.save_json(pid,'project.json',meta)
        return {'ok':True,'from_pdf':False,'width':w,'height':h}

@app.post('/api/projects/{pid}/template-page')
def api_template_page(pid: str, page: int = Form(...)):
    meta=storage.load_json(pid,'project.json')
    pdf=meta.get('template_pdf')
    if not pdf or not os.path.isfile(pdf):
        # fallback: template.pdf if exists
        cand=os.path.join(storage.project_dir(pid),'template.pdf')
        if os.path.isfile(cand): pdf=cand; meta['template_pdf']=pdf
        else: raise HTTPException(400,'No PDF template stored for this project. Upload a PDF template first.')
    img,pages,used=render_pdf_page_to_bgr(pdf, page=page or 1, dpi=300)
    png=os.path.join(storage.project_dir(pid),'template_raster.png'); cv2.imwrite(png,img)
    h,w=img.shape[:2]
    meta.update({'template_path':png,'template_pdf_page':int(used),'template_pdf_pages':int(pages),'template_width':w,'template_height':h})
    storage.save_json(pid,'project.json',meta)
    return {'ok':True,'page':int(used),'pages':int(pages)}

@app.get('/api/projects/{pid}/template-image')
def api_template_image(pid: str):
    meta=storage.load_json(pid,'project.json'); path=meta.get('template_path')
    if not path or not os.path.isfile(path): raise HTTPException(404,'Template image not found')
    ext=os.path.splitext(path)[1].lower(); media='image/png' if ext=='.png' else 'image/jpeg'
    return FileResponse(path, media_type=media)

@app.post('/api/projects/{pid}/layout')
def api_save_layout(pid: str, layout: Layout):
    meta=storage.load_json(pid,'project.json'); meta['layout']=layout.dict(); storage.save_json(pid,'project.json',meta); return {'ok':True}

@app.post('/api/projects/{pid}/process')
def api_process(pid: str, files: List[UploadFile] = File(...), pdf_page: Optional[int] = Form(default=1)):
    pdir=storage.project_dir(pid); meta=storage.load_json(pid,'project.json')
    up=os.path.join(pdir,'uploads'); os.makedirs(up, exist_ok=True)
    ras=os.path.join(pdir,'uploads_raster'); os.makedirs(ras, exist_ok=True)
    paths=[]
    for uf in files:
        ext=os.path.splitext(uf.filename)[1].lower(); dst=os.path.join(up, uf.filename)
        # limit
        total=0
        with open(dst,'wb') as out:
            while True:
                chunk=uf.file.read(1024*1024)
                if not chunk: break
                total+=len(chunk)
                if total>MAX_FILE_BYTES:
                    out.close();
                    try: os.remove(dst)
                    except: pass
                    raise HTTPException(413,f'File too large (> {MAX_FILE_MB} MB)')
                out.write(chunk)
        if ext=='.pdf':
            img,pages,used=render_pdf_page_to_bgr(dst, page=pdf_page or 1, dpi=300)
            outp=os.path.join(ras, f"{os.path.splitext(os.path.basename(dst))[0]}-p{int(used)}.png")
            cv2.imwrite(outp,img); paths.append(outp)
        else:
            paths.append(dst)
    rows=process_batch(meta['template_path'], meta['layout'], paths)
    outdir=os.path.join(pdir,'outputs'); os.makedirs(outdir, exist_ok=True)
    ts=datetime.now().strftime('%Y%m%d-%H%M%S'); fname=f'results-{ts}.csv'; csv=os.path.join(outdir,fname)
    pd.DataFrame(rows).to_csv(csv,index=False)
    return {'ok':True,'rows':rows,'csv_url':f'/api/projects/{pid}/download/{fname}'}

@app.get('/api/projects/{pid}/download/{fname}')
def api_download(pid: str, fname: str):
    path=os.path.join(storage.project_dir(pid),'outputs',fname)
    if not os.path.isfile(path): raise HTTPException(404,'File not found')
    return FileResponse(path, media_type='text/csv', filename=fname)

FRONTEND_DIR=os.path.join(os.path.dirname(__file__),'..','frontend')
app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')
