
let state={pid:null,pdf:false,pdfPages:null,img:null};
const $=s=>document.querySelector(s);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
async function jfetch(u,o={}){let r=await fetch(u,o);let tx=await r.text();let j;try{j=JSON.parse(tx)}catch{j={ok:false,error:tx}}return {ok:r.ok&&(j.ok!==false),data:j,status:r.status};}

async function ensureProject(){
  if(state.pid) return state.pid;
  const fd=new FormData(); fd.append('name', 'auto-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'));
  const r = await fetch('/api/projects',{method:'POST', body:fd}); const j = await r.json();
  if(!r.ok || j.ok===false){ toast(j.error||'Impossible de créer un projet'); throw new Error('no project'); }
  state.pid = j.project_id; return state.pid;
}

function loadTemplateImage(){
  const img = new Image();
  img.onload=()=>{ state.img=img; const c=$('#canvas'); c.width=img.width; c.height=img.height; const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0); };
  img.onerror=()=>toast('Échec de chargement du template');
  img.src=`/api/projects/${state.pid}/template-image?ts=${Date.now()}`;
}

async function uploadTemplateFile(f){
  if(!f){ toast('Choisissez un fichier'); return; }
  await ensureProject();
  const fd=new FormData(); fd.append('file', f);
  fd.append('page', $('#tmplPdfPage').value || '1');
  const {ok,data,status} = await jfetch(`/api/projects/${state.pid}/template`, {method:'POST', body:fd});
  if(!ok){ toast(data.error || ('Upload échoué ('+status+')')); return; }
  state.pdf = !!data.from_pdf; state.pdfPages = data.pages || null;
  $('#tmplPdfInfo').textContent = state.pdf ? `PDF (page ${data.page||1}/${data.pages||'?'})` : 'Image';
  $('#btnApplyPdfPage').disabled = !state.pdf;
  if(data.page) $('#tmplPdfPage').value = data.page;
  loadTemplateImage();
  toast('Template chargé');
}

$('#tmplFile').addEventListener('change', e=>{
  const f = e.target.files[0];
  $('#btnUpload').disabled = !f;
  if(f){ uploadTemplateFile(f); } // auto-upload
});

$('#btnUpload').onclick=()=>{
  const f=$('#tmplFile').files[0];
  if(!f) return toast('Aucun fichier');
  uploadTemplateFile(f);
};

$('#btnCreate').onclick=async()=>{
  const name=$('#newProjName').value.trim(); if(!name) return toast('Nom requis');
  const fd = new FormData(); fd.append('name', name);
  const r = await fetch('/api/projects',{method:'POST', body:fd}); const j=await r.json();
  if(!r.ok || j.ok===false) return toast(j.error||'Échec de création');
  state.pid = j.project_id; toast('Projet créé'); 
};

$('#btnRefresh').onclick=async()=>{
  const {ok,data} = await jfetch('/api/projects'); if(!ok) return;
  const ul = document.querySelector('#projList'); ul.innerHTML='';
  (data.projects||[]).forEach(p=>{ const li=document.createElement('li'); li.textContent=p.name; li.onclick=async()=>{
    state.pid=p.id; const r=await jfetch(`/api/projects/${p.id}`); if(r.ok && r.data.project.template_path) loadTemplateImage();
  }; ul.appendChild(li); });
};

$('#btnDelete').onclick=async()=>{
  if(!state.pid) return toast('Aucun projet');
  await fetch(`/api/projects/${state.pid}`, {method:'DELETE'}); state.pid=null; toast('Projet supprimé');
};

$('#btnApplyPdfPage').onclick=async()=>{
  if(!state.pdf){ toast('Le template courant n’est pas un PDF'); return; }
  let page=parseInt($('#tmplPdfPage').value||'1',10);
  if(state.pdfPages) page=Math.max(1, Math.min(state.pdfPages, page));
  const fd=new FormData(); fd.append('page', String(page));
  const {ok,data,status} = await jfetch(`/api/projects/${state.pid}/template-page`, {method:'POST', body:fd});
  if(!ok){ toast(data.error || ('Changement de page échoué ('+status+')')); return; }
  $('#tmplPdfPage').value = data.page;
  $('#tmplPdfInfo').textContent = `PDF (page ${data.page}/${data.pages})`;
  loadTemplateImage();
};
