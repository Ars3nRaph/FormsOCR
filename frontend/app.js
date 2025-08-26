let state = { pid:null, layout:{workspace:null, rois:[]}, mode:null, selected:-1, img:null, pdf:false, pdfPages:null };
let zoom = { s:1, tx:0, ty:0 }; let isPanning=false, spaceDown=false, panStart=null;

const $ = s => document.querySelector(s);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2400); };
async function jfetch(url,opts={}){ const r=await fetch(url,opts); const txt=await r.text(); let j; try{j=JSON.parse(txt);}catch{j={ok:false,error:txt}}; return {ok:r.ok && (j.ok!==false), data:j, status:r.status}; }

function updateZoomInfo(){ $('#zoomInfo').textContent = `${Math.round(zoom.s*100)}%`; }
function setTransform(ctx){ ctx.setTransform(zoom.s, 0, 0, zoom.s, zoom.tx, zoom.ty); }
function screenToCanvas(e){ const rect=canvas.getBoundingClientRect(); const sx=(e.clientX-rect.left)*(canvas.width/rect.width); const sy=(e.clientY-rect.top)*(canvas.height/rect.height); return {x:(sx-zoom.tx)/zoom.s, y:(sy-zoom.ty)/zoom.s}; }

function fitToView(){ if(!state.img) return; const cw=canvasContainer.clientWidth, ch=canvasContainer.clientHeight; const sw=canvas.width, sh=canvas.height; const s = Math.min(cw/sw, ch/sh); zoom.s = Math.max(0.1, Math.min(4, s));
  const rect=canvas.getBoundingClientRect(); const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  zoom.tx = (rect.width - sw*zoom.s)/2 * scaleX; zoom.ty = (rect.height - sh*zoom.s)/2 * scaleY; updateZoomInfo(); draw(); }
function zoomAt(factor, cx, cy){ const prevS = zoom.s; const newS = Math.max(0.1, Math.min(4, zoom.s*factor)); const rect=canvas.getBoundingClientRect(); const sx=(cx-rect.left)*(canvas.width/rect.width); const sy=(cy-rect.top)*(canvas.height/rect.height);
  zoom.tx = sx - (sx - zoom.tx) * (newS/prevS); zoom.ty = sy - (sy - zoom.ty) * (newS/prevS); zoom.s = newS; updateZoomInfo(); draw(); }
function setOne(){ zoom.s=1; zoom.tx=0; zoom.ty=0; updateZoomInfo(); draw(); }

const canvas=$('#canvas'), ctx=canvas.getContext('2d'); const canvasContainer=document.querySelector('.canvasWrap');
let start=null, temp=null, act=null, handle=null;

function enableEditor(en){ $('#btnWorkspace').disabled=!en; $('#btnAddRoi').disabled=!en; $('#btnClearWs').disabled=!en; $('#btnSaveLayout').disabled=!en; $('#btnProcess').disabled=!en; if(!state.pdf){ $('#btnApplyPdfPage').disabled=true; } else { $('#btnApplyPdfPage').disabled=false; } }

function draw(){ const c=canvas, ctx=c.getContext('2d'); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,c.width,c.height);
  if(state.img){ setTransform(ctx); ctx.drawImage(state.img,0,0);
    if(state.layout.workspace){ const ws=state.layout.workspace; ctx.strokeStyle='#34d399'; ctx.lineWidth=2/zoom.s; ctx.strokeRect(ws.x,ws.y,ws.w,ws.h);
      state.layout.rois.forEach((roi,i)=>{ const r=roiToPx(roi); ctx.strokeStyle=i===state.selected?'#fbbf24':'#60a5fa'; ctx.lineWidth=2/zoom.s; ctx.strokeRect(r.x,r.y,r.w,r.h); ctx.fillStyle='rgba(96,165,250,0.16)'; ctx.fillRect(r.x,r.y,r.w,r.h); ctx.fillStyle='#e5e7eb'; ctx.font=`${12/zoom.s}px system-ui`; ctx.fillText(`${roi.name} [${roi.type}]`, r.x+6/zoom.s, r.y+16/zoom.s); const hs=6/zoom.s; [[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]].forEach(([x,y])=>{ ctx.fillStyle='#0ea5e9'; ctx.fillRect(x-hs,y-hs,hs*2,hs*2); }); }); } }
  if(act && temp){ setTransform(ctx); drawTemp(); }
}

function roiToPx(roi){ const ws=state.layout.workspace; return { x:(ws.x+roi.x*ws.w), y:(ws.y+roi.y*ws.h), w:(roi.w*ws.w), h:(roi.h*ws.h) }; }
function pxToRoiRect(x,y,w,h){ const ws=state.layout.workspace; return { x:(x-ws.x)/ws.w, y:(y-ws.y)/ws.h, w:w/ws.w, h:h/ws.h }; }
function norm(r){ let x=r.x,y=r.y,w=r.w,h=r.h; if(w<0){x+=w; w*=-1;} if(h<0){y+=h; h*=-1;} return {x,y,w,h}; }
function drawTemp(){ const r=norm(temp); const ctx=canvas.getContext('2d'); ctx.save(); ctx.setLineDash([6/zoom.s,4/zoom.s]); ctx.strokeStyle=act==='draw_ws'?'#34d399':'#60a5fa'; ctx.lineWidth=1.5/zoom.s; ctx.strokeRect(r.x,r.y,r.w,r.h); ctx.restore(); }

canvas.addEventListener('wheel',(e)=>{ e.preventDefault(); const factor = e.deltaY<0 ? 1.1 : 0.9; zoomAt(factor, e.clientX, e.clientY); }, {passive:false});
window.addEventListener('keydown',(e)=>{ if(e.code==='Space'){ spaceDown=true; canvas.style.cursor='grab'; } });
window.addEventListener('keyup',(e)=>{ if(e.code==='Space'){ spaceDown=false; canvas.style.cursor='default'; isPanning=false; } });

canvas.addEventListener('mousedown',(e)=>{
  const p=screenToCanvas(e);
  if(spaceDown){ isPanning=true; panStart={x:e.clientX, y:e.clientY, tx:zoom.tx, ty:zoom.ty}; return; }
  if(!state.layout.workspace){ state.mode='workspace'; }
  if(state.mode==='workspace'){ act='draw_ws'; start=p; temp={x:p.x,y:p.y,w:0,h:0}; return;}
  if(state.mode==='roi'&&state.layout.workspace){ act='draw_roi'; start=p; temp={x:p.x,y:p.y,w:0,h:0}; return; }
});
canvas.addEventListener('mousemove',(e)=>{
  if(isPanning && spaceDown){ const rect=canvas.getBoundingClientRect(); const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height; const dx=e.clientX-panStart.x, dy=e.clientY-panStart.y; zoom.tx=panStart.tx+dx*scaleX; zoom.ty=panStart.ty+dy*scaleY; draw(); return; }
  if(!act) return; const p=screenToCanvas(e);
  if(act==='draw_ws'||act==='draw_roi'){ temp.w=p.x-start.x; temp.h=p.y-start.y; draw(); return; }
});
canvas.addEventListener('mouseup',()=>{
  if(isPanning){ isPanning=false; return; }
  if(act==='draw_ws'){ const r=norm(temp); state.layout.workspace=r; state.layout.rois=[]; state.selected=-1; renderRoiList(); draw(); toast('Zone de travail définie'); enableEditor(true); }
  if(act==='draw_roi'){ const r=norm(temp); if(!state.layout.workspace){ act=null; return; } const roi=pxToRoiRect(r.x,r.y,r.w,r.h); const name=$('#roiName').value.trim()||`ROI_${state.layout.rois.length+1}`; const type=$('#roiType').value||'text'; const pattern=$('#roiPattern').value.trim()||null; state.layout.rois.push({name,type,pattern,...roi}); state.selected=state.layout.rois.length-1; renderRoiList(); draw(); toast('ROI ajouté'); }
  act=null; handle=null;
});

function renderRoiList(){ const box=$('#roiList'); box.innerHTML=''; if(!state.layout.rois.length) return; state.layout.rois.forEach((r,i)=>{ const b=document.createElement('button'); b.className='roi-pill'+(i===state.selected?' active':''); b.textContent=`${r.name} [${r.type}]`; b.onclick=()=>{ state.selected=i; draw(); renderRoiList(); $('#roiName').value=r.name; $('#roiType').value=r.type; $('#roiPattern').value=r.pattern||''; $('#btnRenameRoi').disabled=false; $('#btnDeleteRoi').disabled=false; }; box.appendChild(b); }); }
$('#btnRenameRoi').onclick=()=>{ const i=state.selected; if(i<0) return; state.layout.rois[i].name=$('#roiName').value.trim()||state.layout.rois[i].name; state.layout.rois[i].type=$('#roiType').value||'text'; state.layout.rois[i].pattern=$('#roiPattern').value.trim()||null; renderRoiList(); draw(); };
$('#btnDeleteRoi').onclick=()=>{ const i=state.selected; if(i<0) return; state.layout.rois.splice(i,1); state.selected=-1; renderRoiList(); draw(); };

function refreshEngines(){ jfetch('/api/engines').then(({ok,data})=>{ if(!ok) return; const badge=$('#engBadge'); const txt=`Tess ✅ · Rapid ${data.rapid?'✅':'❌'}`; badge.querySelector('span:last-child').textContent = txt; const dot=badge.querySelector('.dot'); dot.style.background = (data.rapid) ? '#22c55e' : '#ef4444'; if(!data.rapid){ badge.title=`RapidOCR désactivé: ${data.rapid_error||'non installé / échec du chargement'}`;} }); }

async function refreshProjects(){ const {ok,data}=await jfetch('/api/projects'); if(!ok){toast(data.error||'Erreur de liste'); return;} const ul=$('#projList'); ul.innerHTML=''; (data.projects||[]).forEach(p=>{ const li=document.createElement('li'); li.textContent=`${p.name}${p.has_layout?' [layout]':''}${p.has_template?' [template]':''}${p.pdf?` [pdf p${p.pdf_page||1}/${p.pdf_pages||'?'}]`:''}`; li.dataset.pid=p.id; li.onclick=()=>openProject(p.id, li); ul.appendChild(li); }); refreshEngines(); }

async function openProject(pid, liEl){ [...$('#projList').children].forEach(x=>x.classList.remove('active')); if(liEl) liEl.classList.add('active'); const {ok,data}=await jfetch(`/api/projects/${pid}`); if(!ok) return toast(data.error||'Ouverture impossible'); state.pid=pid; $('#crumbs').textContent=`${data.project.name} (${pid})`; $('#btnUpload').disabled=false; $('#btnDelete').disabled=false;
  state.pdf = !!data.is_pdf; state.pdfPages=data.pdf_pages||null;
  const info = state.pdf ? `PDF (page ${data.pdf_page||1}/${data.pdf_pages||'?'})` : 'Image';
  $('#tmplPdfInfo').textContent = info;
  if(state.pdf){ $('#tmplPdfPage').min = 1; if(state.pdfPages){ $('#tmplPdfPage').max = state.pdfPages; } $('#btnApplyPdfPage').disabled=false; }
  if(data.project.template_path){ loadTemplateFromServer(); enableEditor(true);} else { state.img=null; draw(); enableEditor(false); }
  if(data.project.layout){ state.layout=data.project.layout; enableEditor(true);} else { state.layout={workspace:null, rois:[]}; }
  if(data.pdf_page){ $('#tmplPdfPage').value = data.pdf_page; }
  renderRoiList(); renderOutputs();
}

$('#btnCreate').onclick=async()=>{ const name=$('#newProjName').value.trim(); if(!name) return toast('Nom requis'); const fd=new FormData(); fd.append('name',name); const r=await fetch('/api/projects',{method:'POST', body:fd}); const j=await r.json(); if(!r.ok || j.ok===false) return toast(j.error||'Échec de création'); await refreshProjects(); openProject(j.project_id); };
$('#btnRefresh').onclick=()=>refreshProjects();
$('#btnDelete').onclick=async()=>{ if(!state.pid) return; if(!confirm('Supprimer ce projet et ses fichiers ?')) return; const {ok,data}=await jfetch(`/api/projects/${state.pid}`,{method:'DELETE'}); toast(ok?'Supprimé':(data.error||'Échec de suppression')); state.pid=null; enableEditor(false); refreshProjects(); };

function loadTemplateFromServer(){ const img=new Image(); img.onload=()=>{ state.img=img; canvas.width=img.width; canvas.height=img.height; setOne(); fitToView(); draw(); enableEditor(true); }; img.onerror=()=>toast('Échec de chargement du template'); img.src=`/api/projects/${state.pid}/template-image?ts=${Date.now()}`; }

async function ensureProject(){ if(state.pid) return; const name='auto-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); const fd=new FormData(); fd.append('name', name); const r=await fetch('/api/projects',{method:'POST', body:fd}); const j=await r.json(); if(r.ok&&j.project_id){ state.pid=j.project_id; refreshProjects(); $('#crumbs').textContent=`${name} (${state.pid})`; } }

async function uploadTemplateFile(f){
  if(!f) return toast('Choisissez un fichier'); await ensureProject(); const fd=new FormData(); fd.append('file',f); const page = parseInt($('#tmplPdfPage').value||'1',10); fd.append('page', String(page));
  const {ok,data}=await jfetch(`/api/projects/${state.pid}/template`,{method:'POST', body:fd});
  if(!ok){ toast(data.error||'Échec d’upload'); return; }
  state.pdf = !!data.from_pdf; state.pdfPages = data.pages || null;
  $('#tmplPdfInfo').textContent = state.pdf ? `PDF (page ${data.page||1}/${data.pages||'?'})` : 'Image';
  if(state.pdf){ $('#btnApplyPdfPage').disabled=false; $('#tmplPdfPage').min=1; if(state.pdfPages){ $('#tmplPdfPage').max=state.pdfPages; } }
  if(data.page){ $('#tmplPdfPage').value = data.page; }
  loadTemplateFromServer(); enableEditor(true); toast('Template chargé');
}

$('#tmplFile').addEventListener('change', (e)=>{ const f=e.target.files[0]; $('#btnUpload').disabled=!f; if(f) uploadTemplateFile(f); });
$('#btnUpload').onclick=()=>{ const f=$('#tmplFile').files[0]; uploadTemplateFile(f); };
$('#btnApplyPdfPage').onclick=async()=>{ if(!state.pid) return; if(!state.pdf) { toast('Le template actuel n’est pas un PDF. Réuploade un PDF.'); return; } let page=parseInt($('#tmplPdfPage').value||'1',10); if(state.pdfPages) page=Math.max(1, Math.min(state.pdfPages, page)); const fd=new FormData(); fd.append('page', String(page)); const {ok,data}=await jfetch(`/api/projects/${state.pid}/template-page`,{method:'POST', body:fd}); if(!ok){ toast(data.error||'Impossible de changer la page'); return;} $('#tmplPdfPage').value = data.page; $('#tmplPdfInfo').textContent = `PDF (page ${data.page}/${data.pages})`; loadTemplateFromServer(); toast(`Page PDF appliquée: ${data.page}/${data.pages}`); };

$('#btnWorkspace').onclick=()=>state.mode='workspace'; $('#btnAddRoi').onclick=()=>state.mode='roi';
$('#btnFit').onclick=fitToView; $('#btnOne').onclick=setOne; $('#btnZoomIn').onclick=(e)=>zoomAt(1.2, e.clientX, e.clientY); $('#btnZoomOut').onclick=(e)=>zoomAt(1/1.2, e.clientX, e.clientY);

$('#btnSaveLayout').onclick=async()=>{ if(!state.pid||!state.layout.workspace) return toast('Définissez la zone de travail'); const {ok,data}=await jfetch(`/api/projects/${state.pid}/layout`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({workspace:state.layout.workspace, rois:state.layout.rois})}); toast(ok?'Template enregistré':(data.error||'Échec enregistrement')); };

document.getElementById('batchFiles').addEventListener('change', (e)=>{
  const n = e.target.files.length;
  document.getElementById('batchCount').textContent = n ? `${n} document${n>1?'s':''} sélectionné${n>1?'s':''}` : '0 sélection';
});

function setLoading(on){ const el=document.getElementById('loader'); if(on){ el.classList.remove('hidden'); } else { el.classList.add('hidden'); } }
$('#btnProcess').onclick=async()=>{ const list=document.getElementById('batchFiles').files; if(!list.length){ toast('Sélectionnez des fichiers'); return; } setLoading(true); $('#btnProcess').disabled=true; try{ const fd=new FormData(); [...list].forEach(f=>fd.append('files',f)); const pdfPage = parseInt($('#batchPdfPage').value||'1',10); fd.append('pdf_page', String(pdfPage)); const {ok,data}=await jfetch(`/api/projects/${state.pid}/process`,{method:'POST', body:fd}); if(!ok){ toast(data.error||'Échec OCR'); return;} $('#processInfo').textContent=`CSV: ${data.csv}`; renderTable(data.rows, data.csv_url); renderOutputs(); toast('OCR terminé'); } finally { setLoading(false); $('#btnProcess').disabled=false; } };

function renderTable(rows,url){ const div=$('#results'); div.innerHTML=''; if(!rows||!rows.length){ div.textContent='Aucun résultat'; return;} const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr'); Object.keys(rows[0]).forEach(k=>{ const th=document.createElement('th'); th.textContent=k; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead); const tbody=document.createElement('tbody'); rows.forEach(r=>{ const tr=document.createElement('tr'); Object.keys(rows[0]).forEach(k=>{ const td=document.createElement('td'); td.textContent=r[k]??''; tr.appendChild(td); }); tbody.appendChild(tr); }); table.appendChild(tbody); div.appendChild(table); if(url){ const a=document.createElement('a'); a.href=url; a.textContent='⬇ Télécharger le CSV'; a.className='btn btn-primary'; a.style.display='inline-block'; a.style.marginTop='10px'; a.download=''; div.appendChild(a);} }

async function renderOutputs(){ if(!state.pid) return; const {ok,data}=await jfetch(`/api/projects/${state.pid}/outputs`); const div=$('#outputsHist'); div.innerHTML='<h4 style="margin:10px">Historique des exports</h4>'; if(!ok){ div.append(' (erreur)'); return;} if(!data.files||!data.files.length){ div.append(' — aucun'); return;} const ul=document.createElement('ul'); ul.style.listStyle='none'; ul.style.padding='10px'; data.files.forEach(f=>{ const li=document.createElement('li'); li.style.margin='6px 0'; const a=document.createElement('a'); a.href=`/api/projects/${state.pid}/download/${f}`; a.textContent=f; a.className='btn btn-ghost'; a.download=''; li.appendChild(a); ul.appendChild(ul.lastChild||li); ul.appendChild(li); }); div.appendChild(ul); }

function loadTemplateFromServer(){ const img=new Image(); img.onload=()=>{ state.img=img; canvas.width=img.width; canvas.height=img.height; setOne(); fitToView(); draw(); }; img.onerror=()=>toast('Échec de chargement du template'); img.src=`/api/projects/${state.pid}/template-image?ts=${Date.now()}`; }

refreshProjects(); refreshEngines(); updateZoomInfo();
