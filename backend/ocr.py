import os, re, cv2, numpy as np, pytesseract
from .utils_image import compute_homography
_cmd=os.environ.get('TESSERACT_CMD');
if _cmd: pytesseract.pytesseract.tesseract_cmd=_cmd
ENGINES_STATUS={'tesseract':True,'rapid':False,'rapid_error':''}
try:
    from rapidocr_onnxruntime import RapidOCR
    RapidOCR(); ENGINES_STATUS['rapid']=True
except Exception as e:
    ENGINES_STATUS['rapid_error']=str(e)

def _tess(img, whitelist=None, psm=7, lang='eng+fra'):
    cfg=f"--oem 1 --psm {psm} -l {lang}"
    if whitelist: cfg+=f" -c tessedit_char_whitelist={whitelist}"
    try: return pytesseract.image_to_string(img, config=cfg).strip()
    except: return ''

def normalize_email(s):
    import re
    s=(s or '').strip().lower(); s=re.sub(r'[^a-z0-9@._-]','',s)
    if s.count('@')>1:
        i=s.find('@'); s=s[:i+1]+s[i+1:].replace('@','')
    if '@' not in s: return s
    local,_,dom=s.partition('@'); local=re.sub(r'[^a-z0-9._+-]','',local).strip('.')
    dom=re.sub(r'[^a-z0-9.-]','',dom).strip('.-');
    if '.' not in dom: dom=dom+'.ch'
    return f"{local}@{dom}"

def normalize_name(s):
    import re
    s=(s or '').strip(); s=re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ' -]+","",s); return s.strip()

def warp_to_template(img_in, tmpl):
    H=compute_homography(img_in, tmpl); h,w=tmpl.shape[:2]
    if H is None: return cv2.resize(img_in,(w,h))
    return cv2.warpPerspective(img_in,H,(w,h))

def crop_roi(warped, ws, roi):
    x=int(ws['x']+roi['x']*ws['w']); y=int(ws['y']+roi['y']*ws['h'])
    w=int(max(5, roi['w']*ws['w'])); h=int(max(5, roi['h']*ws['h']))
    x2,y2=x+w,y+h; h_img,w_img=warped.shape[:2]
    x=max(0,min(x,w_img-1)); y=max(0,min(y,h_img-1))
    x2=max(x+1,min(x2,w_img)); y2=max(y+1,min(y2,h_img))
    return warped[y:y2,x:x2]

def ocr_line(img, roi_type='text', pattern=None):
    if img is None or getattr(img,'size',0)==0: return ''
    if roi_type in ('digits','number','phone','age'):
        t=_tess(img, whitelist='0123456789', lang='eng', psm=7); import re
        t=re.sub(r'[^0-9]','',t)
        if roi_type=='age': t=t[:2]
        if roi_type=='phone' and len(t)==9 and t[0] in '789': t='0'+t
        return t
    if roi_type=='email':
        t=_tess(img, whitelist='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-', lang='eng', psm=7); return normalize_email(t)
    if roi_type=='name': return normalize_name(_tess(img, lang='eng+fra', psm=7))
    return _tess(img, lang='eng+fra', psm=7)

def process_batch(template_path, layout, input_files):
    import numpy as np, cv2, os
    tmpl=cv2.imdecode(np.fromfile(template_path,dtype=np.uint8), cv2.IMREAD_COLOR)
    rows=[]
    for p in input_files:
        img=cv2.imdecode(np.fromfile(p,dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is None: continue
        warped=warp_to_template(img, tmpl)
        row={'_file': os.path.basename(p)}; ws=layout['workspace']
        for roi in layout['rois']:
            patch=crop_roi(warped, ws, roi)
            row[roi['name']]=ocr_line(patch, roi.get('type','text'), roi.get('pattern'))
        rows.append(row)
    return rows
