import json, os, shutil, glob
from datetime import datetime
BASE = os.path.join(os.path.dirname(__file__), 'data')
PROJECTS=os.path.join(BASE,'projects'); os.makedirs(PROJECTS, exist_ok=True)

def new_project(name):
    ts=datetime.now().strftime('%Y%m%d-%H%M%S'); pid=name.replace(' ','-')+'-'+ts
    os.makedirs(os.path.join(PROJECTS,pid), exist_ok=True); return pid

def project_dir(pid):
    return os.path.join(PROJECTS, pid)

def save_json(pid,name,data):
    with open(os.path.join(project_dir(pid),name),'w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)

def load_json(pid,name):
    with open(os.path.join(project_dir(pid),name),'r',encoding='utf-8') as f: return json.load(f)

def list_outputs(pid):
    pdir=project_dir(pid); out=os.path.join(pdir,'outputs')
    if not os.path.isdir(out): return []
    return sorted([f for f in os.listdir(out) if f.endswith('.csv')], reverse=True)

def list_projects(): return []
