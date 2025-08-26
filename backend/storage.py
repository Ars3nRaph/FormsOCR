import json, os, shutil, glob
from datetime import datetime
BASE=os.path.join(os.path.dirname(__file__),'data'); os.makedirs(os.path.join(BASE,'projects'), exist_ok=True)
PROJECTS=os.path.join(BASE,'projects')

def slugify(s):
    return ''.join(c.lower() if c.isalnum() else '-' for c in s).strip('-')

def new_project(name):
    from datetime import datetime
    pid=f"{slugify(name)}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"; os.makedirs(os.path.join(PROJECTS,pid), exist_ok=True)
    return pid

def project_dir(pid): return os.path.join(PROJECTS,pid)

def save_json(pid,name,data):
    with open(os.path.join(project_dir(pid),name),'w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)

def load_json(pid,name):
    with open(os.path.join(project_dir(pid),name),'r',encoding='utf-8') as f: return json.load(f)

def list_projects():
    out=[]
    for pid in sorted(os.listdir(PROJECTS)):
        pdir=project_dir(pid); meta={}
        if os.path.isfile(os.path.join(pdir,'project.json')):
            try:
                with open(os.path.join(pdir,'project.json'),'r',encoding='utf-8') as f: meta=json.load(f)
            except: meta={}
        out.append({'id':pid,'name':meta.get('name',pid),'has_template':bool(meta.get('template_path')),'has_layout':bool(meta.get('layout')),'pdf':bool(meta.get('template_pdf')),'pdf_page':meta.get('template_pdf_page'),'pdf_pages':meta.get('template_pdf_pages')})
    return out
