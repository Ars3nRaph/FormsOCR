import os, re
from typing import List, Dict, Tuple, Optional
import cv2, numpy as np, pytesseract
from .utils_image import compute_homography

_cmd = os.environ.get("TESSERACT_CMD")
if _cmd: pytesseract.pytesseract.tesseract_cmd = _cmd

ENGINES_STATUS = {"tesseract": True, "rapid": False, "paddle": False, "rapid_error": "", "paddle_error": ""}

rapid_ocr=None
try:
    from rapidocr_onnxruntime import RapidOCR
    rapid_ocr = RapidOCR(); ENGINES_STATUS["rapid"]=True
except Exception as e: ENGINES_STATUS["rapid_error"]=str(e)

paddle_ocr=None
try:
    from paddleocr import PaddleOCR
    try: paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en')
    except Exception: paddle_ocr = PaddleOCR()
    ENGINES_STATUS["paddle"]=True
except Exception as e: ENGINES_STATUS["paddle_error"]=str(e)+" (tip: run install_optional_ocr.bat)"

def _prep_variants(img: np.ndarray) -> List[np.ndarray]:
    if img is None: return []
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim==3 else img.copy()
    out=[]; scale=2.0 if max(g.shape[:2])<1200 else 1.0
    base = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale!=1.0 else g
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8)); c=clahe.apply(base)
    v1 = cv2.adaptiveThreshold(c,255,cv2.ADAPTIVE_THRESH_MEAN_C,cv2.THRESH_BINARY,31,10)
    v2 = cv2.adaptiveThreshold(c,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,31,8)
    _, v3 = cv2.threshold(c,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    k = cv2.getStructuringElement(cv2.MORPH_RECT,(2,2)); v4=cv2.morphologyEx(v2,cv2.MORPH_OPEN,k,iterations=1)
    blurred=cv2.GaussianBlur(c,(0,0),2.0); v5=cv2.addWeighted(c,1.6,blurred,-0.6,0)
    out += [v1,v2,v3,v4,v5]; return out

def _tess(img, whitelist=None, psm=7, lang="eng+fra")->str:
    cfg=f"--oem 1 --psm {psm} -l {lang}"; 
    if whitelist: cfg+=f" -c tessedit_char_whitelist={whitelist}"
    return pytesseract.image_to_string(img, config=cfg).strip()

def ocr_tesseract_line(img, whitelist=None, lang="eng+fra", psm=7)->str:
    texts=[]
    for v in _prep_variants(img):
        for p in (7,6,psm):
            try: 
                t=_tess(v, whitelist, p, lang=lang)
                if t: texts.append(t)
            except Exception: pass
    if not texts: return ""
    texts=list(dict.fromkeys([t.strip() for t in texts]))
    return max(texts, key=lambda s: len(s.replace(" ","")))

def ocr_rapid_line(img): 
    if rapid_ocr is None: return "",0.0
    try: res,_ = rapid_ocr(img)
    except Exception: return "",0.0
    if not res: return "",0.0
    text = " ".join([t for _,t,_ in res]).strip(); score=float(np.mean([s for _,_,s in res]))
    return text, score

def ocr_paddle_line(img):
    if paddle_ocr is None: return "",0.0
    try:
        try: out=paddle_ocr.ocr(img, det=False, rec=True, cls=False)
        except TypeError:
            try: out=paddle_ocr.ocr(img, rec=True)
            except TypeError: out=paddle_ocr.ocr(img)
    except Exception: return "",0.0
    texts,scores=[],[]
    for item in out or []:
        for rec in item or []:
            try: t,s = rec[0], float(rec[1])
            except Exception: continue
            texts.append(t); scores.append(s)
    if not texts: return "",0.0
    return " ".join(texts).strip(), float(np.mean(scores))

def normalize_name(s:str)->str:
    s=(s or "").strip()
    if not s: return ""
    import re
    s=re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ' -]+","",s)
    s=re.sub(r"(?<=[A-Za-zÀ-ÖØ-öø-ÿ])[0](?=[A-Za-zÀ-ÖØ-öø-ÿ])","O",s)
    s=re.sub(r"(?<=[A-Za-zÀ-ÖØ-öø-ÿ])[1](?=[A-Za-zÀ-ÖØ-öø-ÿ])","l",s)
    s=re.sub(r"\s{2,}"," ",s)
    return s.strip()

def normalize_email(s:str)->str:
    s=(s or "").strip().lower()
    if not s: return ""
    trans={" ": "", ",": ".", ";": ".", "|":"l", "!":"l", "＠":"@", "．":".", "－":"-", "＿":"_", "，":"."}
    for a,b in trans.items(): s=s.replace(a,b)
    while ".." in s: s=s.replace("..",".")
    if "@" not in s: return s
    local,_,dom=s.partition("@")
    import re
    local=re.sub(r"[^a-z0-9._%+\-]","",local).strip(".")
    dom=re.sub(r"[^a-z0-9.\-]","",dom).strip(".-")
    if "." not in dom and len(dom)>2: dom=dom[:-2]+"."+dom[-2:]
    return f"{local}@{dom}"

def pick_best(cands, scorer):
    if not cands: return ""
    return max(cands, key=lambda x: scorer(x[0]) + 0.1*x[1])[0]

def ocr_line(img, roi_type="text", pattern=None)->str:
    out = ocr_line_debug(img, roi_type, pattern); return out.get("best","")

def ocr_line_debug(img, roi_type="text", pattern=None)->dict:
    if img is None or getattr(img,"size",0)==0: return {"best": ""}
    r_txt,r_sc = ocr_rapid_line(img); p_txt,p_sc = ocr_paddle_line(img)
    if roi_type in ("digits","number","phone","age"):
        t_txt = ocr_tesseract_line(img, whitelist="0123456789", lang="eng", psm=7)
    elif roi_type=="email":
        t_txt = ocr_tesseract_line(img, whitelist="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-", lang="eng", psm=7)
    else:
        t_txt = ocr_tesseract_line(img, lang="eng+fra", psm=7)

    if roi_type in ("digits","number"):
        import re as _re
        cands=[(_re.sub(r"[^0-9]","",s), sc) for s,sc in [(r_txt,r_sc),(p_txt,p_sc),(t_txt,0.6)] if s]
        best = pick_best(cands, lambda x: len(x))
        return {"best": best, "rapid": r_txt, "paddle": p_txt, "tesseract": t_txt}

    if roi_type=="phone":
        import re as _re
        cands=[]
        for s,sc in [(r_txt,r_sc),(p_txt,p_sc),(t_txt,0.6)]:
            if not s: continue
            ds=_re.sub(r"[^0-9]","",s)
            if len(ds)==9 and ds[0] in "789": ds="0"+ds
            cands.append((ds, sc))
        best = pick_best(cands, lambda x: (10<=len(x)<=12)*3 + min(len(x),12)*0.1)
        return {"best": best[:12], "rapid": r_txt, "paddle": p_txt, "tesseract": t_txt}

    if roi_type=="age":
        rx=__import__("re").compile(r"(1[01][0-9]|1[0-2]0|[1-9][0-9]?)"); vals=[]
        for s in [r_txt,p_txt,t_txt]:
            if not s: continue
            m=rx.search(s)
            if m: vals.append(m.group(0))
        if not vals:
            ds=__import__("re").sub(r"[^0-9]","", t_txt or r_txt or p_txt)
            if ds: vals=[ds[:2]]
        best=max(vals, key=lambda x: len(x)) if vals else ""
        return {"best": best, "rapid": r_txt, "paddle": p_txt, "tesseract": t_txt}

    if roi_type=="email":
        c=[]; 
        for s,sc in [(r_txt,r_sc),(p_txt,p_sc),(t_txt,0.6)]:
            if not s: continue
            c.append((normalize_email(s), sc))
        if not c: return {"best":"", "rapid":r_txt, "paddle":p_txt, "tesseract":t_txt}
        def score_email_local(s): 
            import re
            score=0.0
            if re.match(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", s): score+=1.0
            if "@" in s: score+=0.3
            if ".." in s or " " in s: score-=0.5
            return score
        best = pick_best(c, lambda x: score_email_local(x))
        return {"best": best, "rapid": r_txt, "paddle": p_txt, "tesseract": t_txt}

    cand=[(s,sc) for s,sc in [(r_txt,r_sc),(p_txt,p_sc),(t_txt,0.05)] if s]
    ordered=[c for c,_ in sorted(cand, key=lambda x:x[1], reverse=True)]
    final = ordered[0] if ordered else ""
    if roi_type=="name": final = normalize_name(final)
    return {"best": final, "rapid": r_txt, "paddle": p_txt, "tesseract": t_txt}

def warp_to_template(img_in, img_template):
    H = compute_homography(img_in, img_template)
    h,w = img_template.shape[:2]
    if H is None:
        try:
            import numpy as np, cv2
            g1 = cv2.cvtColor(img_in, cv2.COLOR_BGR2GRAY) if img_in.ndim==3 else img_in
            g2 = cv2.cvtColor(img_template, cv2.COLOR_BGR2GRAY) if img_template.ndim==3 else img_template
            g1 = cv2.resize(g1,(w,h)); warp=np.eye(2,3,dtype=np.float32)
            cv2.findTransformECC(g2,g1,warp,cv2.MOTION_EUCLIDEAN)
            return cv2.warpAffine(img_in, warp, (w,h))
        except Exception: 
            return cv2.resize(img_in,(w,h))
    return cv2.warpPerspective(img_in, H, (w, h))

def crop_roi(warped, ws, roi):
    x=int(ws['x'] + roi['x']*ws['w']); y=int(ws['y'] + roi['y']*ws['h'])
    w=int(max(5, roi['w']*ws['w'])); h=int(max(5, roi['h']*ws['h']))
    x2,y2=x+w, y+h; h_img,w_img=warped.shape[:2]
    x=max(0,min(x,w_img-1)); y=max(0,min(y,h_img-1))
    x2=max(x+1,min(x2,w_img)); y2=max(y+1,min(y2,h_img))
    patch=warped[y:y2, x:x2]
    if getattr(patch,"size",0)==0: return None
    ph=int(0.08*patch.shape[0]); pw=int(0.06*patch.shape[1])
    patch=cv2.copyMakeBorder(patch, ph, ph, pw, pw, cv2.BORDER_REPLICATE)
    return patch

def process_batch(template_img, layout, input_images):
    results=[]
    for fname, img in input_images:
        if img is None: continue
        warped = warp_to_template(img, template_img)
        row={"_file": fname}; ws=layout['workspace']
        for roi in layout['rois']:
            patch=crop_roi(warped, ws, roi)
            row[roi['name']] = ocr_line(patch, roi.get('type','text'), roi.get('pattern'))
        results.append(row)
    return results
