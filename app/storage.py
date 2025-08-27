import json, os, shutil, glob
from datetime import datetime
from typing import Dict, List

BASE = os.path.join(os.path.dirname(__file__), 'data')
USERS = os.path.join(BASE, 'users')
os.makedirs(USERS, exist_ok=True)

def _user_dir(uid: int) -> str:
    d = os.path.join(USERS, str(uid)); os.makedirs(d, exist_ok=True); return d

def projects_dir(uid: int) -> str:
    d = os.path.join(_user_dir(uid), 'projects'); os.makedirs(d, exist_ok=True); return d

def slugify(s: str) -> str: return ''.join(c.lower() if c.isalnum() else '-' for c in s).strip('-')

def new_project(uid: int, name: str) -> str:
    ts = datetime.now().strftime('%Y%m%d-%H%M%S'); pid = f"{slugify(name)}-{ts}"
    os.makedirs(os.path.join(projects_dir(uid), pid), exist_ok=True); return pid

def project_dir(uid: int, pid: str) -> str: return os.path.join(projects_dir(uid), pid)

def save_json(uid: int, pid: str, name: str, data: Dict):
    with open(os.path.join(project_dir(uid, pid), name), 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=2)

def load_json(uid: int, pid: str, name: str) -> Dict:
    with open(os.path.join(project_dir(uid, pid), name), 'r', encoding='utf-8') as f: return json.load(f)

def list_projects(uid: int) -> List[Dict]:
    out=[]; pbase=projects_dir(uid)
    for pid in sorted(os.listdir(pbase)):
        pdir = os.path.join(pbase, pid)
        if not os.path.isdir(pdir): continue
        meta_path = os.path.join(pdir, 'project.json')
        if not os.path.isfile(meta_path): continue
        try:
            with open(meta_path, 'r', encoding='utf-8') as f: meta=json.load(f)
            out.append({
                "id": pid, "name": meta.get("name", pid),
                "has_template": bool(meta.get("template_path")),
                "width": meta.get("template_width"), "height": meta.get("template_height"),
                "template_is_pdf": bool(meta.get("template_is_pdf", False)),
                "pages": meta.get("template_pages", 1),
                "has_layout": bool(meta.get("layouts"))
            })
        except Exception: continue
    return out

def list_outputs(uid: int, pid: str) -> List[str]:
    pdir = project_dir(uid, pid); out_dir=os.path.join(pdir, 'outputs')
    if not os.path.isdir(out_dir): return []
    files = sorted(glob.glob(os.path.join(out_dir, 'results-*.csv')), reverse=True)
    return [os.path.basename(f) for f in files]

def delete_project(uid: int, pid: str):
    pdir = project_dir(uid, pid)
    if os.path.isdir(pdir): shutil.rmtree(pdir)
