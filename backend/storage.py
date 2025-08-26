import json, os, shutil, glob
from datetime import datetime
from typing import Dict, List

BASE = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
PROJECTS = os.path.join(BASE, "projects")
os.makedirs(PROJECTS, exist_ok=True)

def slugify(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")

def new_project(name: str) -> str:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    pid = f"{slugify(name)}-{ts}"
    os.makedirs(os.path.join(PROJECTS, pid), exist_ok=True)
    return pid

def project_dir(pid: str) -> str:
    return os.path.join(PROJECTS, pid)

def save_json(pid: str, name: str, data: Dict):
    with open(os.path.join(project_dir(pid), name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_json(pid: str, name: str) -> Dict:
    with open(os.path.join(project_dir(pid), name), "r", encoding="utf-8") as f:
        return json.load(f)

def list_projects() -> List[Dict]:
    out = []
    for pid in sorted(os.listdir(PROJECTS)):
        pdir = os.path.join(PROJECTS, pid)
        if not os.path.isdir(pdir):
            continue
        meta = {}
        mp = os.path.join(pdir, "project.json")
        if os.path.isfile(mp):
            try:
                with open(mp, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception:
                meta = {}
        out.append({
            "id": pid,
            "name": meta.get("name", pid),
            "has_template": bool(meta.get("template_path")),
            "has_layout": bool(meta.get("layout")),
            "pdf": bool(meta.get("template_pdf")),
            "pdf_page": meta.get("template_pdf_page"),
            "pdf_pages": meta.get("template_pdf_pages"),
        })
    return out

def list_outputs(pid: str):
    pdir = project_dir(pid)
    outdir = os.path.join(pdir, "outputs")
    if not os.path.isdir(outdir):
        return []
    return [os.path.basename(p) for p in sorted(glob.glob(os.path.join(outdir, "results-*.csv")), reverse=True)]

def delete_project(pid: str):
    pdir = project_dir(pid)
    if os.path.isdir(pdir):
        shutil.rmtree(pdir)
