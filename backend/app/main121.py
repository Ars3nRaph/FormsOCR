import os, io, shutil
from datetime import datetime
from typing import List
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from .auth import get_db, get_current_user, hash_password, verify_password, create_access_token
from .models import User
from .schemas import Layout, UserCreate, TokenResponse, MeResponse
from . import storage
from .ocr import process_batch, ENGINES_STATUS
from .utils_pdf import render_pdf_to_image_bytes, render_pdf_to_image_arrays, pdf_page_count
from .rate_limit import PLANS
app = FastAPI(title="FormsOCR Studio — SaaS v5.1 (Railway-ready)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
@app.get("/api/health")
def health(): return {"status":"ok"}
@app.get("/api/engines")
def engines(): return {"ok": True, **ENGINES_STATUS}
@app.post("/api/auth/register", response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.strip().lower()
    if not email or not user.password: raise HTTPException(400, "Email et mot de passe requis")
    if db.query(User).filter(User.email == email).first(): raise HTTPException(409, "Email déjà utilisé")
    u = User(email=email, password_hash=hash_password(user.password), plan=os.environ.get("DEFAULT_PLAN","free"))
    db.add(u); db.commit(); db.refresh(u)
    token = create_access_token({"sub": str(u.id)})
    return TokenResponse(access_token=token)
@app.post("/api/auth/login", response_model=TokenResponse)
def login(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.strip().lower(); u = db.query(User).filter(User.email == email).first()
    if not u or not verify_password(user.password, u.password_hash): raise HTTPException(401, "Identifiants invalides")
    token = create_access_token({"sub": str(u.id)}); return TokenResponse(access_token=token)
def _reset_month_if_needed(u: User, db: Session):
    cur = datetime.utcnow().strftime("%Y-%m")
    if u.usage_month != cur:
        u.usage_month = cur; u.docs_processed = 0; db.add(u); db.commit()
@app.get("/api/me", response_model=MeResponse)
def me(u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _reset_month_if_needed(u, db); limits = PLANS.get(u.plan, PLANS["free"])
    return MeResponse(email=u.email, plan=u.plan, month=u.usage_month, docs_processed=u.docs_processed, limits=limits)
def _ensure_under_limits_templates(db: Session, u: User):
    limits = PLANS.get(u.plan, PLANS["free"]); plist = storage.list_projects(u.id)
    with_template = sum(1 for p in plist if p.get("has_template"))
    if with_template >= limits["templates"]: raise HTTPException(402, f"Limite de templates atteinte ({limits['templates']}).")
@app.get("/api/projects")
def api_list_projects(u: User = Depends(get_current_user)):
    try: return {"ok": True, "projects": storage.list_projects(u.id)}
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.post("/api/projects")
def api_new_project(name: str = Form(...), u: User = Depends(get_current_user)):
    pid = storage.new_project(u.id, name)
    storage.save_json(u.id, pid, 'project.json', {"name": name, "layouts": {}, "template_is_pdf": False, "template_pages": 1})
    return {"ok": True, "project_id": pid}
@app.get("/api/projects/{pid}")
def api_get_project(pid: str, u: User = Depends(get_current_user)):
    try:
        meta = storage.load_json(u.id, pid, 'project.json')
        return {"ok": True, "project": meta, "project_id": pid}
    except FileNotFoundError:
        raise HTTPException(404, "Project not found")
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.delete("/api/projects/{pid}")
def api_delete_project(pid: str, u: User = Depends(get_current_user)):
    try: storage.delete_project(u.id, pid); return {"ok": True}
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.post("/api/projects/{pid}/template")
def api_upload_template(pid: str, file: UploadFile = File(...), u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_under_limits_templates(db, u)
    try:
        pdir = storage.project_dir(u.id, pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".png",".jpg",".jpeg",".pdf"]:
            raise HTTPException(400,"Formats supportés: PNG/JPG/PDF")
        tpath = os.path.join(pdir, f"template{ext}")
        with open(tpath, 'wb') as out:
            shutil.copyfileobj(file.file, out)
        meta = storage.load_json(u.id, pid, 'project.json')
        meta["template_path"] = tpath
        meta["template_is_pdf"] = ext == ".pdf"
        if ext == ".pdf":
            pages = pdf_page_count(tpath)
            meta["template_pages"] = pages
            png = render_pdf_to_image_bytes(tpath, 0, scale=2.0)
            import cv2, numpy as np
            im = cv2.imdecode(np.frombuffer(png, dtype=np.uint8), cv2.IMREAD_COLOR)
            h, w = im.shape[:2]
        else:
            import cv2
            im = cv2.imread(tpath, cv2.IMREAD_COLOR)
            if im is None:
                raise HTTPException(400, "Image template invalide")
            h, w = im.shape[:2]
            meta["template_pages"] = 1
        meta["template_width"] = w; meta["template_height"] = h
        storage.save_json(u.id, pid, 'project.json', meta)
        return {"ok": True, "template_path": tpath, "width": w, "height": h, "ext": ext, "pages": meta["template_pages"]}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.get("/api/projects/{pid}/template-image")
def api_template_image(pid: str, pg: int = Query(1, ge=1), u: User = Depends(get_current_user)):
    try:
        meta = storage.load_json(u.id, pid, 'project.json'); path = meta.get("template_path")
        if not path or not os.path.isfile(path): raise HTTPException(404,"Template non trouvé")
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pdf":
            png = render_pdf_to_image_bytes(path, pg-1, scale=2.0)
            return Response(content=png, media_type="image/png")
        media = "image/png" if ext==".png" else "image/jpeg"
        return FileResponse(path, media_type=media)
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.post("/api/projects/{pid}/layout")
def api_save_layout(pid: str, layout: Layout, page: int = Query(1, ge=1), u: User = Depends(get_current_user)):
    try:
        pdir = storage.project_dir(u.id, pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        meta = storage.load_json(u.id, pid, 'project.json')
        layouts = meta.get("layouts", {})
        layouts[str(page)] = layout.dict()
        meta["layouts"] = layouts
        storage.save_json(u.id, pid, 'project.json', meta)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.get("/api/projects/{pid}/layout")
def api_get_layout(pid: str, page: int = Query(1, ge=1), u: User = Depends(get_current_user)):
    try:
        meta = storage.load_json(u.id, pid, 'project.json')
        layout = meta.get("layouts", {}).get(str(page))
        if not layout:
            raise HTTPException(404, "Aucun layout pour cette page")
        return {"ok": True, "layout": layout}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.get("/api/projects/{pid}/outputs")
def api_outputs(pid: str, u: User = Depends(get_current_user)):
    try: return {"ok": True, "files": storage.list_outputs(u.id, pid)}
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.get("/api/projects/{pid}/download/{fname}")
def api_download(pid: str, fname: str, u: User = Depends(get_current_user)):
    try:
        pdir = storage.project_dir(u.id, pid); fpath = os.path.join(pdir, "outputs", fname)
        if not os.path.isfile(fpath): raise HTTPException(404,"File not found")
        return FileResponse(fpath, media_type="text/csv", filename=fname)
    except HTTPException: raise
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
@app.post("/api/projects/{pid}/process")
def api_process(pid: str, files: List[UploadFile] = File(...), u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        pdir = storage.project_dir(u.id, pid)
        if not os.path.isdir(pdir): raise HTTPException(404, "Project not found")
        meta = storage.load_json(u.id, pid, 'project.json')
        if not meta.get('template_path') or not meta.get('layouts'): raise HTTPException(400,"Template et layouts requis (au moins 1 page)")
        plan = os.environ.get("DEFAULT_PLAN", u.plan); limits = PLANS.get(plan, PLANS["free"])
        files_list = list(files)
        if len(files_list) > limits["batch_size"]:
            raise HTTPException(402, f"Votre plan autorise {limits['batch_size']} documents par lot.")
        import numpy as np, cv2
        rows_all = []
        if meta.get("template_is_pdf", False):
            tpages = {}
            for pidx in [int(k) for k in meta.get("layouts", {}).keys()]:
                png = render_pdf_to_image_bytes(meta["template_path"], pidx-1, scale=2.0)
                tim = cv2.imdecode(np.frombuffer(png, dtype=np.uint8), cv2.IMREAD_COLOR)
                tpages[pidx] = tim
        else:
            tim = cv2.imread(meta["template_path"], cv2.IMREAD_COLOR)
            if tim is None: raise HTTPException(400, "Template image introuvable")
        for uf in files_list:
            ext=os.path.splitext(uf.filename)[1].lower()
            if ext not in [".png",".jpg",".jpeg",".pdf"]:
                continue
            images_for_file=[]
            if ext==".pdf":
                tmp_path=os.path.join(pdir,'tmp_input.pdf')
                with open(tmp_path,'wb') as out: shutil.copyfileobj(uf.file, out)
                pages = render_pdf_to_image_arrays(tmp_path, scale=2.0)
                for idx, im in enumerate(pages, start=1):
                    images_for_file.append((f"{os.path.basename(uf.filename)}#p{idx}", im))
            else:
                data=uf.file.read()
                im=cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                images_for_file.append((os.path.basename(uf.filename), im))
            for fname, img in images_for_file:
                if img is None: continue
                page_idx = 1
                if "#p" in fname:
                    try: page_idx = int(fname.split("#p")[-1])
                    except Exception: page_idx = 1
                layout = meta.get("layouts", {}).get(str(page_idx)) or meta.get("layouts", {}).get("1")
                if not layout: continue
                timg = tpages[page_idx] if meta.get("template_is_pdf", False) else tim
                rows = process_batch(timg, layout, [(fname, img)]); rows_all.extend(rows)
        if not rows_all: raise HTTPException(400, "Aucune page traitée (vérifiez les layouts/pages)")
        df = pd.DataFrame(rows_all); out_dir=os.path.join(pdir,'outputs'); os.makedirs(out_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d-%H%M%S'); fname=f"results-{ts}.csv"; csv_path=os.path.join(out_dir, fname)
        df.to_csv(csv_path, index=False)
        from .rate_limit import PLANS
        u.docs_processed += len(rows_all)
        limits = PLANS.get(u.plan, PLANS["free"])
        if u.docs_processed > limits["monthly_docs"]:
            db.commit(); raise HTTPException(402, f"Limite mensuelle atteinte ({limits['monthly_docs']} lignes/pages).")
        db.add(u); db.commit()
        return {"ok": True, "rows": rows_all, "csv": csv_path.replace('\\','/'), "csv_url": f"/api/projects/{pid}/download/{fname}"}
    except HTTPException: raise
    except Exception as e: return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
@app.on_event("startup")
def _init_db():
    from .database import Base, engine
    Base.metadata.create_all(bind=engine)
