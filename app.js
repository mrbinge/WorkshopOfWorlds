/* ---------------- DATA LAYER ---------------- */
const STORAGE_KEY = 'masterskaya-mirov-data';
let data = { projects: [], characters: [], relationships: [], events: [], locations: [], factions: [], scenes: [], sceneLinks: [], creatures: [], myths: [], magicSystems: [], deities: [], maps: [], countries: [], dynasties: [], dynastyMembers: [], dynastyMemberLinks: [], artifacts: [] };
let state = { activeProjectId: null, activeTab: 'overview', graphSelected: null, viewModeNetworks: 'free', viewModeDynasty: 'family' };
let canvasView = { pan:{x:120,y:80}, scale:1 };
let mapCanvasView = { pan:{x:0,y:0}, scale:1 };
let mapFullscreenNeedsCenter = false;
let saveTimer = null;

function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }

function resizeImageFile(file, maxW, maxH, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = reject;
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const ratio = Math.min(1, maxW/w, maxH/h);
        w = Math.max(1, Math.round(w*ratio)); h = Math.max(1, Math.round(h*ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// Персонажные изображения храним как квадратные аватары: единый кадр в карточках и при увеличении.
function makeAvatarImage(file, size=512, quality=.88){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onerror=reject;
    reader.onload=()=>{ const img=new Image(); img.onerror=reject;
      img.onload=()=>{
        const side=Math.min(img.naturalWidth,img.naturalHeight);
        const sx=Math.round((img.naturalWidth-side)/2), sy=Math.round((img.naturalHeight-side)/2);
        const canvas=document.createElement('canvas'); canvas.width=size; canvas.height=size;
        const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
        ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
        resolve(canvas.toDataURL('image/jpeg',quality));
      }; img.src=reader.result;
    }; reader.readAsDataURL(file);
  });
}
function openAvatarCropper(source, onApply){
  const loadImage = src => new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; });
  const readSource = source => {
    if(typeof source==='string') return Promise.resolve(source);
    return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(source); });
  };
  readSource(source).then(loadImage).then(img=>{
    const side=320, baseScale=Math.max(side/img.naturalWidth,side/img.naturalHeight);
    let zoom=1, x=(side-img.naturalWidth*baseScale)/2, y=(side-img.naturalHeight*baseScale)/2;
    const startX=x, startY=y;
    const overlay=document.createElement('div'); overlay.className='avatar-crop-backdrop';
    overlay.innerHTML=`<div class="avatar-crop-dialog" role="dialog" aria-modal="true"><h2>Настроить аватарку</h2><p>Перетаскивай изображение мышью. Колесо мыши приближает и отдаляет. В рамку попадёт круглая область.</p><div class="avatar-crop-window"><img class="avatar-crop-image" draggable="false"></div><div class="avatar-crop-zoom"><kbd>Колесо мыши</kbd><span>— приблизить / отдалить</span></div><div class="avatar-crop-actions"><button type="button" class="btn" data-crop-cancel>Отмена</button><button type="button" class="btn btn-ghost" data-crop-reset>Сбросить</button><button type="button" class="btn btn-primary" data-crop-apply>Применить</button></div></div>`;
    document.body.appendChild(overlay);
    const win=overlay.querySelector('.avatar-crop-window'), preview=overlay.querySelector('.avatar-crop-image');
    preview.src=img.src;
    const draw=()=>{const scale=baseScale*zoom,w=img.naturalWidth*scale,h=img.naturalHeight*scale; x=Math.min(0,Math.max(side-w,x)); y=Math.min(0,Math.max(side-h,y)); preview.style.width=w+'px';preview.style.height=h+'px';preview.style.left=x+'px';preview.style.top=y+'px';};
    draw();
    win.addEventListener('wheel',e=>{e.preventDefault();const rect=win.getBoundingClientRect(), px=(e.clientX-rect.left)*(side/rect.width), py=(e.clientY-rect.top)*(side/rect.height);const old=zoom, next=Math.min(8,Math.max(1,zoom*(e.deltaY<0?1.12:1/1.12))), ratio=next/old;x=px-(px-x)*ratio;y=py-(py-y)*ratio;zoom=next;draw();},{passive:false});
    let drag=null;
    win.addEventListener('pointerdown',e=>{drag={px:e.clientX,py:e.clientY,x,y};win.setPointerCapture?.(e.pointerId);});
    win.addEventListener('pointermove',e=>{if(!drag)return;x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;draw();});
    const stop=()=>drag=null; win.addEventListener('pointerup',stop);win.addEventListener('pointercancel',stop);
    const close=()=>overlay.remove();
    overlay.querySelector('[data-crop-cancel]').onclick=close;
    overlay.querySelector('[data-crop-reset]').onclick=()=>{zoom=1;x=startX;y=startY;draw();};
    overlay.querySelector('[data-crop-apply]').onclick=()=>{
      const scale=baseScale*zoom, sx=(0-x)/scale, sy=(0-y)/scale, sw=side/scale, sh=side/scale;
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,sw,sh,0,0,512,512);
      const result=canvas.toDataURL('image/jpeg',.9);close();onApply(result);
    };
    const escKey=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',escKey);}};document.addEventListener('keydown',escKey);
    overlay.addEventListener('click',e=>{if(e.target===overlay){close();document.removeEventListener('keydown',escKey);}});
  }).catch(()=>showToast('Не удалось открыть изображение'));
}

function openImageViewer(src, caption=''){
  if(!src) return;
  const overlay=document.createElement('div'); overlay.className='image-viewer-backdrop'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
  overlay.innerHTML=`<button class="image-viewer-close" aria-label="Закрыть">×</button><div class="image-viewer-frame"><img src="${src}" alt="${esc(caption)}">${caption?`<div class="image-viewer-caption">${esc(caption)}</div>`:''}</div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay || e.target.closest('.image-viewer-close')) overlay.remove();});
  const onKey=e=>{if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',onKey);}};
  document.addEventListener('keydown',onKey); overlay.addEventListener('remove',()=>document.removeEventListener('keydown',onKey));
  document.body.appendChild(overlay);
}

/* ---------------- CLOUD + LOCAL DATA LAYER ---------------- */
// Вставь значения из Supabase → Project Settings → API.
// Используй только Project URL и publishable/anon key. service_role сюда добавлять нельзя.
const SUPABASE_URL = 'https://iuapbnrrgmyonhnzxksz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ejK9X8mexvAffhsbms7lbQ_VsGAUnsz';
const supabaseConfigured = /^https:\/\/.+/.test(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR_') && !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_');
const supabaseClient = (supabaseConfigured && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const DEFAULT_DATA = { projects:[], characters:[], relationships:[], events:[], locations:[], factions:[], scenes:[], sceneLinks:[], creatures:[], myths:[], magicSystems:[], deities:[], maps:[], countries:[], dynasties:[], dynastyMembers:[], dynastyMemberLinks:[], artifacts:[] };
let currentUser = null;
let cloudLoadInProgress = false;
let saveRevision = 0;
let lastCloudSaveAt = 0;

function parseData(raw){
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Некорректный формат данных');
  const res = Object.assign({}, DEFAULT_DATA, parsed);
  const st = (parsed.settings && typeof parsed.settings==='object' && !Array.isArray(parsed.settings)) ? parsed.settings : {};
  res.settings = Object.assign({}, st, {
    viewModeNetworks: st.viewModeNetworks==='hex' ? 'hex' : 'free',
    viewModeDynasty: st.viewModeDynasty==='hex' ? 'hex' : 'family'
  });
  state.viewModeNetworks = res.settings.viewModeNetworks;
  state.viewModeDynasty = res.settings.viewModeDynasty;
  return res;
}
/* Данные хранятся только в облаке (Supabase). Старая локальная копия читается один раз — для предложения переноса. */
function readLocalData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('story-bible-data');
    return raw ? parseData(raw) : null;
  }catch(e){ return null; }
}
function clearLocalData(){
  try{ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('story-bible-data'); }catch(e){}
}
function setAuthMessage(message, kind=''){
  const el = document.getElementById('authMessage');
  if(!el) return;
  el.textContent = message || '';
  el.className = kind;
}
function showAuthGate(message='', kind=''){
  document.getElementById('app').hidden = true;
  document.getElementById('authGate').hidden = false;
  document.getElementById('authSetupWarning').hidden = supabaseConfigured;
  document.getElementById('accountEmail').textContent = '';
  document.getElementById('signOutBtn').hidden = true;
  setAuthMessage(message, kind);
}
function showAppForUser(user){
  currentUser = user || null;
  document.getElementById('authGate').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('accountEmail').textContent = user?.email || '';
  document.getElementById('accountEmail').title = user?.email || '';
  document.getElementById('signOutBtn').hidden = !user;
}
async function loadData(){
  if(!supabaseConfigured || !supabaseClient){
    showAuthGate('Supabase еще не настроен. Заполни SUPABASE_URL и SUPABASE_ANON_KEY в коде, затем обнови страницу.', 'error');
    return;
  }
  cloudLoadInProgress = true;
  try{
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if(sessionError) throw sessionError;
    const user = sessionData?.session?.user;
    if(!user){
      currentUser = null;
      showAuthGate();
      return;
    }
    currentUser = user;
    const { data: row, error } = await supabaseClient
      .from('worlds')
      .select('data, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if(error) throw error;

    if(row && row.data){
      // Облачная версия является источником истины после входа.
      data = parseData(row.data);
      clearLocalData();          // локальная копия больше не нужна — освобождаем место в браузере
    }else{
      const localData = readLocalData();
      if(localData && Object.values(localData).some(v=>Array.isArray(v) && v.length)){
        const shouldMigrate = window.confirm('В облаке пока нет данных для этого аккаунта, но в браузере найдены локальные проекты. Перенести их в облако? Нажми «Отмена», если это данные другого аккаунта или ты хочешь начать с пустого архива.');
        data = shouldMigrate ? localData : Object.assign({}, DEFAULT_DATA);
        if(shouldMigrate){
          await saveCloudData(true, true);
          clearLocalData();
        }
      }else{
        data = Object.assign({}, DEFAULT_DATA);
      }
    }
    syncViewModes();
    state.activeProjectId = data.projects.some(p=>p.id===state.activeProjectId) ? state.activeProjectId : (data.projects[0]?.id || null);
    showAppForUser(user);
    render();
  }catch(e){
    console.error('Ошибка загрузки данных Supabase:', e);
    showAuthGate('Не удалось загрузить данные из облака. Проверь подключение, URL/ключ Supabase и политики RLS.\n\n' + (e?.message || 'Неизвестная ошибка'), 'error');
  }finally{
    cloudLoadInProgress = false;
  }
}
let unsavedChanges = false, lastCloudWarn = 0;
function warnCloudFailure(){
  const now = Date.now();
  if(now - lastCloudWarn < 30000) return;
  lastCloudWarn = now;
  showToast('Не удалось сохранить в облако. Проверьте соединение — изменения пока не сохранены. Резервную копию можно скачать в настройках.');
}
async function saveCloudData(silent=false, force=false){
  if(!supabaseClient || !currentUser || (cloudLoadInProgress && !force)) return false;
  const revisionAtStart = saveRevision;
  const payload = JSON.parse(JSON.stringify(data));
  let error = null;
  try{
    ({ error } = await supabaseClient.from('worlds').upsert({
      user_id: currentUser.id,
      data: payload,
      updated_at: new Date().toISOString()
    }, { onConflict:'user_id' }));
  }catch(e){ error = e; }
  if(error){
    console.error('Ошибка облачного сохранения:', error);
    warnCloudFailure();
    return false;
  }
  if(revisionAtStart === saveRevision) unsavedChanges = false;
  lastCloudSaveAt = Date.now();
  if(revisionAtStart !== saveRevision){
    // Если данные изменились во время запроса, следующий таймер отправит новую версию.
    queueSave();
  }else if(!silent){
    showToast('Сохранено в облако');
  }
  return true;
}
function queueSave(){
  saveRevision++;
  unsavedChanges = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    if(!currentUser || !supabaseClient) return;
    await saveCloudData(true);
  }, 1000);
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------------- HELPERS ---------------- */
const TYPE_PALETTE = ['var(--roman-color)','var(--manga-color)','var(--other-color)','var(--thread)','var(--rose)'];
function typeColor(type){
  const t = (type||'').trim().toLowerCase();
  if(!t) return 'var(--gray)';
  let hash = 0; for(let i=0;i<t.length;i++){ hash = (hash*31 + t.charCodeAt(i)) >>> 0; }
  return TYPE_PALETTE[hash % TYPE_PALETTE.length];
}
function projectColor(p){ return (p && p.color) ? p.color : typeColor(p ? p.type : ''); }
function projectDotHtml(p){
  const color = projectColor(p);
  const letter = esc((p.name||'?').trim().charAt(0).toUpperCase() || '?');
  if(p.photo) return `<div class="p-dot" style="background:${color}; padding:0; overflow:hidden;"><img src="${p.photo}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;"></div>`;
  return `<div class="p-dot" style="background:${color}">${letter}</div>`;
}
const REL_TYPES = {
  ally:{label:'Союзники', color:'#5fa8a0'},
  enemy:{label:'Враги', color:'#c1443b'},
  family:{label:'Семья', color:'#c9a24c'},
  romance:{label:'Романтика', color:'#b5698f'},
  mentor:{label:'Наставник', color:'#8c7ec9'},
  friend:{label:'Друзья', color:'#7fb069'},
  acquaintance:{label:'Знакомые', color:'#6a8caf'},
  other:{label:'Другое', color:'#7a7f92'},
};

function proj(id){ return data.projects.find(p=>p.id===id); }
function activeProject(){ return proj(state.activeProjectId); }
function itemsOf(coll, projectId){ return data[coll].filter(x=>x.projectId===projectId); }
function charName(id){ const c = data.characters.find(c=>c.id===id); return c ? c.name : '???'; }
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Small line-icons used on card action buttons (Читать/Копировать/Изменить),
// sized to sit inline to the left of the button label rather than above it.
const BTN_ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
};
function btnIconSvg(name){
  return `<svg class="btn-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BTN_ICONS[name]}</svg>`;
}

/* ---------------- RENDER ROOT ---------------- */
function render(){
  renderSidebarProjects();
  renderMain();
}

let lastScrolledProject = null;
function updateProjectsExpandBtn(){
  const row = document.getElementById('projectsRow'), list = document.getElementById('projectList'), btn = document.getElementById('projectsExpandBtn');
  if(!row || !list || !btn) return;
  row.classList.toggle('expanded', !!state.projectsExpanded);
  const overflow = list.scrollWidth > list.clientWidth + 1;
  btn.hidden = !(state.projectsExpanded || overflow);
  btn.title = state.projectsExpanded ? 'Свернуть проекты в одну строку' : 'Показать все проекты';
  btn.setAttribute('aria-expanded', state.projectsExpanded ? 'true' : 'false');
}
function toggleProjectsExpanded(){
  state.projectsExpanded = !state.projectsExpanded;
  updateProjectsExpandBtn();
  const list = document.getElementById('projectList');
  if(!state.projectsExpanded && list){ const act = list.querySelector('.project-item.active'); if(act) act.scrollIntoView({inline:'nearest', block:'nearest'}); }
}
function renderSidebarProjects(){
  const list = document.getElementById('projectList');
  const prevScroll = list.scrollLeft;
  if(!data.projects.length){
    list.innerHTML = `<div style="font-size:12.5px; color:var(--text-faint); padding:6px 2px;">Пока нет проектов</div>`;
    updateProjectsExpandBtn();
    return;
  }
  list.innerHTML = data.projects.map(p=>{
    const color = projectColor(p);
    return `<div class="project-item ${p.id===state.activeProjectId?'active':''}" data-id="${p.id}" style="--pcolor:${color}" title="${esc(p.name)}" onclick="selectProject('${p.id}')">
      ${projectDotHtml(p)}
      <div class="p-info">
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-type">${esc(p.type || '—')}</div>
      </div>
    </div>`;
  }).join('');
  attachProjectDragEvents();
  renderActiveProjectChip();
  // сохраняем положение прокрутки; к активному проекту прокручиваем только когда он сменился
  list.scrollLeft = prevScroll;
  if(!state.projectsExpanded && state.activeProjectId!==lastScrolledProject){
    const act = list.querySelector('.project-item.active');
    if(act) act.scrollIntoView({inline:'nearest', block:'nearest'});
  }
  lastScrolledProject = state.activeProjectId;
  updateProjectsExpandBtn();
}
function reorderProjects(dragId, targetId){
  const fromIdx = data.projects.findIndex(p=>p.id===dragId);
  const toIdx = data.projects.findIndex(p=>p.id===targetId);
  if(fromIdx===-1 || toIdx===-1 || fromIdx===toIdx) return;
  const [moved] = data.projects.splice(fromIdx,1);
  data.projects.splice(toIdx,0,moved);
  queueSave();
  renderSidebarProjects();
}
function attachProjectDragEvents(){
  const list = document.getElementById('projectList');
  if(!list) return;
  let dragId = null;
  list.querySelectorAll('.project-item').forEach(chip=>{
    chip.draggable = true;
    chip.addEventListener('dragstart', ()=>{
      dragId = chip.dataset.id;
      chip.classList.add('dragging-card');
    });
    chip.addEventListener('dragend', ()=>{
      chip.classList.remove('dragging-card');
      list.querySelectorAll('.project-item').forEach(c=>c.classList.remove('drag-over'));
    });
    chip.addEventListener('dragover', (e)=>{
      e.preventDefault();
      if(chip.dataset.id === dragId) return;
      chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', ()=>{ chip.classList.remove('drag-over'); });
    chip.addEventListener('drop', (e)=>{
      e.preventDefault();
      chip.classList.remove('drag-over');
      const targetId = chip.dataset.id;
      if(!dragId || dragId===targetId) return;
      reorderProjects(dragId, targetId);
    });
  });
}
function renderActiveProjectChip(){
  const chipEl = document.getElementById('activeProjectChip');
  if(!chipEl) return;
  const p = proj(state.activeProjectId);
  if(!p){ chipEl.innerHTML = ''; return; }
  chipEl.innerHTML = `${projectDotHtml(p)}<span class="p-name">${esc(p.name)}</span>`;
}

function selectProject(id){ state.activeProjectId = id; state.activeTab='overview'; state.activeMapId = null; state.activeTreeId = null; exitMapFullscreen(); render(); }
function toggleSidebar(){
  const sidebar = document.getElementById('sidebar');
  const collapsed = sidebar.classList.toggle('collapsed');
  document.getElementById('sidebarToggle').textContent = collapsed ? '▾' : '▴';
  if(!collapsed) updateProjectsExpandBtn();
}

function renderMain(){
  const main = document.getElementById('main');
  if(!data.projects.length){
    main.innerHTML = `<div class="empty-state">
      <div class="mark"><svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.2c0 0 3-1.4 6.3-1.4 2 0 3.2.9 3.2.9v14.6c0 0-1.2-.8-3.2-.8-3.3 0-6.3 1.3-6.3 1.3V5.2Z"/><path d="M21.5 5.2c0 0-3-1.4-6.3-1.4-2 0-3.2.9-3.2.9v14.6c0 0 1.2-.8 3.2-.8 3.3 0 6.3 1.3 6.3 1.3V5.2Z"/><path d="M12 4.7v14.6" stroke-width="1" opacity="0.5"/></svg></div>
      <h2>Пустая мастерская</h2>
      <p>Создайте первый проект — роман, мангу или что угодно ещё. Внутри будут свои персонажи, связи, таймлайн и лор, отдельно от всех остальных проектов.</p>
      <button class="btn btn-primary" onclick="openNewProjectModal()">Создать первый проект</button>
    </div>`;
    return;
  }
  const p = activeProject();
  if(!p){ state.activeProjectId = data.projects[0].id; return renderMain(); }
  const color = projectColor(p);

  main.innerHTML = `
    <div id="projectHeader" style="--pcolor:${color}">
      <div class="ph-top">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          <div class="ph-avatar" style="background:${color};">${p.photo ? `<img src="${p.photo}" alt="">` : esc((p.name||'?').trim().charAt(0).toUpperCase() || '?')}</div>
          <div>
            <h2>${esc(p.name)}</h2>
            ${p.type ? `<span class="ph-type">${esc(p.type)}</span>` : ''}
            ${p.desc ? `<div class="ph-desc">${esc(p.desc)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" onclick="openEditProjectModal('${p.id}')">Изменить</button>
        </div>
      </div>
      <div id="tabs">
        ${tabBtn('overview','Обзор')}
        ${tabBtn('characters','Персонажи')}
        ${tabBtn('structure','Структура')}
        ${tabBtn('relationships','Связи')}
        ${tabBtn('timeline','Таймлайн')}
        ${WORLD_GROUPS.filter(g=>worldGroupSections(g).length).map(g=>tabBtn(g.key,g.title)).join('')}
      </div>
    </div>
    <div id="tabContent"></div>
  `;
  renderTabContent();
}

function tabBtn(key,label){
  return `<button class="tab-btn ${state.activeTab===key?'active':''}" onclick="switchTab('${key}')">${label}</button>`;
}
function switchTab(key){
  if(state.activeTab==='timeline' && key!=='timeline') teardownTimelineNav();
  state.activeTab = key; if(!isWorldTab(key)){ state.activeMapId = null; state.activeTreeId = null; exitMapFullscreen(); } renderMain();
}

function renderTabContent(){
  const el = document.getElementById('tabContent');
  const pid = state.activeProjectId;
  if(state.activeTab==='overview') return el.innerHTML = renderOverview(pid);
  if(state.activeTab==='characters') return renderCharacters(el, pid);
  if(state.activeTab==='structure') return renderStructure(el, pid);
  if(state.activeTab==='relationships') return renderRelationships(el, pid);
  if(state.activeTab==='timeline') return renderTimeline(el, pid);
  if(isWorldTab(state.activeTab)) return renderWorld(el, pid);
}

/* ---------------- OVERVIEW ---------------- */
function renderOverview(pid){
  const chars = itemsOf('characters', pid);
  const events = itemsOf('events', pid);
  const rels = itemsOf('relationships', pid);
  const locs = itemsOf('locations', pid);
  const facs = itemsOf('factions', pid);
  const stats = [
    ['Персонажей', chars.length], ['Связей', rels.length], ['Событий', events.length],
    ['Локаций', locs.length], ['Фракций', facs.length]
  ];
  return `
    <div class="stat-row">${stats.map(([l,n])=>`<div class="stat-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join('')}</div>
    ${chars.length===0 && events.length===0 ? `<div class="empty-tab">Проект пуст. Начните с вкладки «Персонажи» или «Таймлайн» — заполните архив по кусочку, каша сама уляжется в систему.</div>` : `
    ${chars.filter(c=>c.pinned).length ? `
    <div class="side-section-label pinned-label" style="margin-bottom:10px;"><svg class="pin-gold" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M14.7 2.3c-.4-.4-1-.4-1.4 0L11 4.6c-1.7-.5-3.7 0-5 1.3L4.6 7.3c-.4.4-.4 1 0 1.4l3.6 3.6-4.9 4.9a1 1 0 0 0 1.4 1.4l4.9-4.9 3.6 3.6c.4.4 1 .4 1.4 0l1.4-1.4c1.3-1.3 1.8-3.3 1.3-5l2.3-2.3c.4-.4.4-1 0-1.4l-5-5Z"/></svg>Закреплённые</div>
    <div class="grid" style="margin-bottom:30px;">${chars.filter(c=>c.pinned).map(characterCard).join('')}</div>
    ` : ''}
    <div class="side-section-label" style="margin-bottom:10px;">Недавние персонажи</div>
    <div class="grid" style="margin-bottom:30px;">${chars.slice(-4).reverse().map(characterCard).join('') || '<div class="empty-tab">Пока нет персонажей</div>'}</div>
    <div class="side-section-label" style="margin-bottom:10px;">Последние события</div>
    <div id="timelineList" style="max-width:640px;">${events.slice(-3).reverse().map(eventCard).join('') || '<div class="empty-tab">Пока нет событий</div>'}</div>
    `}
  `;
}

/* ---------------- CHARACTERS ---------------- */
function characterCard(c){
  const statusClass = c.status==='alive' ? 'status-alive' : c.status==='dead' ? 'status-dead' : '';
  const avatar = c.photo
    ? `<img class="d-avatar" src="${c.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(c.name))}</div>`;
  const pinBtn = `<button class="pin-btn ${c.pinned?'pinned':''}" onclick="event.stopPropagation(); togglePinCharacter('${c.id}')" title="${c.pinned?'Открепить':'Закрепить'}">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14.7 2.3c-.4-.4-1-.4-1.4 0L11 4.6c-1.7-.5-3.7 0-5 1.3L4.6 7.3c-.4.4-.4 1 0 1.4l3.6 3.6-4.9 4.9a1 1 0 0 0 1.4 1.4l4.9-4.9 3.6 3.6c.4.4 1 .4 1.4 0l1.4-1.4c1.3-1.3 1.8-3.3 1.3-5l2.3-2.3c.4-.4.4-1 0-1.4l-5-5Z"/></svg>
  </button>`;
  return `<div class="dossier ${c.pinned?'is-pinned':''}" id="char-${c.id}" data-id="${c.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3>${esc(c.name)}</h3>
          ${c.aliases ? `<div class="d-alias">${esc(c.aliases)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
        ${pinBtn}
        ${c.status ? `<span class="d-status ${statusClass}">${esc(c.status)}</span>` : ''}
      </div>
    </div>
    ${c.role ? `<div class="d-role">${esc(c.role)}</div>` : ''}
    ${c.desc ? `<div class="d-desc">${esc(c.desc)}</div>` : ''}
    ${c.tags && c.tags.length ? `<div class="d-tags">${c.tags.map(t=>`<span class="d-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('characters','${c.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('characters','${c.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditCharacterModal('${c.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteCharacter('${c.id}')">Удалить</button>
    </div>
  </div>`;
}
function togglePinCharacter(id){
  const c = data.characters.find(x=>x.id===id);
  if(!c) return;
  c.pinned = !c.pinned;
  queueSave();
  renderMain();
}
function sortCharacters(list){
  return [...list].sort((a,b)=>{
    const pinDiff = (b.pinned?1:0)-(a.pinned?1:0);
    if(pinDiff) return pinDiff;
    return (a.order??0) - (b.order??0);
  });
}
function reorderCharacters(dragId, targetId){
  const pid = state.activeProjectId;
  const list = sortCharacters(itemsOf('characters', pid));
  const fromIdx = list.findIndex(c=>c.id===dragId);
  const toIdx = list.findIndex(c=>c.id===targetId);
  if(fromIdx===-1 || toIdx===-1 || fromIdx===toIdx) return;
  const [moved] = list.splice(fromIdx,1);
  list.splice(toIdx,0,moved);
  list.forEach((c,i)=>{ c.order = i; });
  queueSave();
  renderCharacters(document.getElementById('tabContent'), pid);
}
function attachCharacterDragEvents(){
  const grid = document.getElementById('charGrid');
  if(!grid) return;
  let dragId = null;
  grid.querySelectorAll('.dossier').forEach(card=>{
    card.draggable = true;
    card.addEventListener('dragstart', ()=>{
      dragId = card.dataset.id;
      card.classList.add('dragging-card');
    });
    card.addEventListener('dragend', ()=>{
      card.classList.remove('dragging-card');
      grid.querySelectorAll('.dossier').forEach(c=>c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e)=>{
      e.preventDefault();
      if(card.dataset.id === dragId) return;
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', ()=>{ card.classList.remove('drag-over'); });
    card.addEventListener('drop', (e)=>{
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.id;
      if(!dragId || dragId===targetId) return;
      reorderCharacters(dragId, targetId);
    });
  });
}

function renderCharacters(el, pid){
  const chars = sortCharacters(itemsOf('characters', pid));
  el.innerHTML = `
    <div class="toolbar">
      <input type="text" id="charFilter" placeholder="Фильтр по имени, роли, тегу…" oninput="filterCharacters()">
      <button class="btn btn-primary fab-add" onclick="openNewCharacterModal()">+ Новый персонаж</button>
    </div>
    <div class="grid" id="charGrid">${chars.length ? chars.map(characterCard).join('') : '<div class="empty-tab">Пока нет персонажей. Добавьте первого.</div>'}</div>
  `;
  attachCharacterDragEvents();
}
function filterCharacters(){
  const q = document.getElementById('charFilter').value.toLowerCase();
  const chars = sortCharacters(itemsOf('characters', state.activeProjectId).filter(c=>
    (c.name||'').toLowerCase().includes(q) || (c.role||'').toLowerCase().includes(q) ||
    (c.aliases||'').toLowerCase().includes(q) || (c.tags||[]).some(t=>t.toLowerCase().includes(q))
  ));
  document.getElementById('charGrid').innerHTML = chars.length ? chars.map(characterCard).join('') : '<div class="empty-tab">Ничего не найдено.</div>';
  attachCharacterDragEvents();
}

function openNewCharacterModal(pos){
  openFormModal('Новый персонаж', characterFieldsNew(), {}, (vals)=>{
    const maxOrder = Math.max(-1, ...itemsOf('characters', state.activeProjectId).map(c=>c.order??0));
    const nc = Object.assign({id:uid(), projectId: state.activeProjectId, order: maxOrder+1}, vals);
    if(pos && Number.isFinite(pos.hexQ)){ nc.hexQ = pos.hexQ; nc.hexR = pos.hexR; }
    if(pos && Number.isFinite(pos.netX)){ nc.netX = pos.netX; nc.netY = pos.netY; }
    data.characters.push(nc);
    queueSave(); closeModal(); renderMain();
  });
}
function openEditCharacterModal(id){
  const c = data.characters.find(x=>x.id===id);
  openFormModal('Изменить персонажа', characterFields(), c, (vals)=>{
    Object.assign(c, vals); queueSave(); closeModal(); renderMain();
  });
}
function deleteCharacter(id){
  askConfirm('Удалить персонажа? Связанные связи и упоминания в событиях и сценах тоже будут удалены.', 'Удалить', ()=>{
    data.characters = data.characters.filter(c=>c.id!==id);
    data.relationships = data.relationships.filter(r=>r.charA!==id && r.charB!==id);
    data.events.forEach(e=>{ if(e.charIds) e.charIds = e.charIds.filter(cid=>cid!==id); });
    data.scenes.forEach(s=>{ if(s.charIds) s.charIds = s.charIds.filter(cid=>cid!==id); });
    queueSave(); renderMain();
  });
}
function characterFields(){
  return [
    {key:'name', label:'Имя', type:'text', required:true},
    {key:'photo', label:'Фото', type:'image'},
    {key:'aliases', label:'Прозвища / другие имена', type:'text'},
    {key:'role', label:'Роль в истории', type:'text', placeholder:'протагонист, антагонист, наставник…'},
    {key:'status', label:'Статус', type:'select', options:[['','—'],['alive','жив(а)'],['dead','мёртв(а)'],['unknown','неизвестно']]},
    {key:'tags', label:'Теги (через запятую)', type:'tags'},
    {key:'desc', label:'Описание / заметки', type:'textarea'},
  ];
}

/* ---------------- RELATIONSHIPS (network canvas) ---------------- */
let relCanvasView = { pan:{x:220,y:90}, scale:1 };
let relSelected = null;

function relTypes(r){ return (r.types && r.types.length) ? r.types : (r.type ? [r.type] : ['other']); }
function relEvolves(r){ return (r.evolvesTo && r.evolvesTo.length) ? r.evolvesTo : []; }
function relTypeLabel(k){ return (REL_TYPES[k]||REL_TYPES.other).label; }
function relTypeColor(k){ return (REL_TYPES[k]||REL_TYPES.other).color; }

function ensureNetPositions(chars){
  let changed = false;
  const cx=280, cy=230, R=170;
  chars.forEach((c,i)=>{
    if(c.netX===undefined || c.netY===undefined){
      const angle = (i/chars.length)*Math.PI*2 - Math.PI/2;
      c.netX = Math.round(cx + R*Math.cos(angle) - 42);
      c.netY = Math.round(cy + R*Math.sin(angle) - 26);
      changed = true;
    }
  });
  if(changed) queueSave();
}

function renderRelationships(el, pid){
  const chars = itemsOf('characters', pid);
  const rels = itemsOf('relationships', pid);
  if(chars.length < 2){
    el.innerHTML = `<div class="empty-tab">Нужно хотя бы два персонажа, чтобы строить связи. Добавьте их во вкладке «Персонажи».</div>`;
    return;
  }
  const hexMode = state.viewModeNetworks==='hex';
  if(!hexMode) ensureNetPositions(chars);
  el.innerHTML = `
    <div class="canvas-toolbar">
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        <h3 style="margin:0; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Связи персонажей</h3>
      </div>
      <div class="board-actions">
        ${histBtnsHtml('rel')}
        <div class="canvas-zoom-controls">
          <button class="btn btn-sm" onclick="zoomRelCanvas(-0.15)">−</button>
          <span class="mono" id="relZoomLabel" style="font-size:12px; color:var(--text-faint); min-width:42px; text-align:center; display:inline-block;">100%</span>
          <button class="btn btn-sm" onclick="zoomRelCanvas(0.15)">+</button>
        </div>
        ${viewSwitchHtml('networks')}
        <button class="btn btn-sm" onclick="resetRelCanvasView()">Центрировать</button>
        <button class="btn btn-sm hist-btn" onclick="toggleBoardFs('rel')" title="Во весь экран" aria-label="Во весь экран">${BOARD_FS_ICON}</button>
        <button class="btn btn-primary btn-sm" onclick="openNewRelationshipModal()">+ Связь</button>
      </div>
    </div>
    <div class="eyebrow" style="margin-bottom:10px;">${hexMode ? 'Тащите карточки по сотам — при отпускании они прилипают к ближайшей ячейке. Бросьте карточку на другую — создастся связь, а карточка вернётся на место. Клик по карточке — редактировать персонажа.' : 'Тащите персонажей, чтобы расставить как хотите. Бросьте карточку точно в центр другой — создастся связь, а карточка вернётся на место. Или тяните от золотой точки к другому персонажу. Клик по персонажу — подсветить его нити. Клик по линии — открыть связь.'}</div>
    ${hexMode ? hexBoardHtml('rel') : `<div id="relCanvasViewport">
      <div id="relCanvasInner">
        <svg id="relEdgesSvg" width="4000" height="3000"></svg>
        ${chars.map(relNodeHtml).join('')}
      </div>
    </div>`}
    <div id="legend" style="margin-top:14px;">
      ${Object.entries(REL_TYPES).map(([k,v])=>`<div class="legend-item"><span class="legend-swatch" style="background:${v.color}"></span>${v.label}</div>`).join('')}
    </div>
    <div class="side-section-label" style="margin:26px 0 10px;">Список связей</div>
    <div class="grid">${rels.length ? rels.map(relCard).join('') : '<div class="empty-tab">Связей пока нет.</div>'}</div>
  `;
  if(hexMode){ initHexBoard('rel'); setupBoardFs('rel'); return; }
  applyRelCanvasTransform();
  drawRelEdges();
  attachRelCanvasEvents();
  setupBoardFs('rel');
}

function relNodeHtml(c){
  const avatarInner = c.photo ? `<img src="${c.photo}" alt="">` : `<span>${esc(initials(c.name))}</span>`;
  return `<div class="rel-node" data-id="${c.id}" style="left:${c.netX}px; top:${c.netY}px;${cardColorVars(c)}">
    <div class="rel-avatar">${avatarInner}</div>
    <div class="rel-name">${esc(c.name)}</div>
  </div>`;
}

function applyRelCanvasTransform(){
  const inner = document.getElementById('relCanvasInner');
  if(!inner) return;
  inner.style.transform = `translate(${relCanvasView.pan.x}px, ${relCanvasView.pan.y}px) scale(${relCanvasView.scale})`;
  const lbl = document.getElementById('relZoomLabel');
  if(lbl) lbl.textContent = Math.round(relCanvasView.scale*100)+'%';
}
function zoomRelCanvas(delta){ if(state.viewModeNetworks==='hex') return hexZoomBy('rel', delta); relCanvasView.scale = Math.min(2, Math.max(0.35, relCanvasView.scale+delta)); applyRelCanvasTransform(); drawRelEdges(); }
function resetRelCanvasView(){ if(state.viewModeNetworks==='hex') return resetHexView('rel'); relCanvasView.pan = {x:220,y:90}; relCanvasView.scale = 1; applyRelCanvasTransform(); drawRelEdges(); }

function drawRelEdges(){
  const svg = document.getElementById('relEdgesSvg');
  if(!svg) return;
  const chars = itemsOf('characters', state.activeProjectId);
  const rels = itemsOf('relationships', state.activeProjectId);
  const byId = {}; chars.forEach(c=>byId[c.id]=c);
  const NCX=42, NCY=26;
  let defs = '<defs>';
  let paths = '';
  rels.forEach(r=>{
    const a = byId[r.charA], b = byId[r.charB];
    if(!a||!b) return;
    const types = relTypes(r), evolves = relEvolves(r);
    const startColor = relTypeColor(types[0]);
    const endColor = evolves.length ? relTypeColor(evolves[0]) : relTypeColor(types[types.length-1]);
    const x1=a.netX+NCX, y1=a.netY+NCY, x2=b.netX+NCX, y2=b.netY+NCY;
    const gradId = 'grad-'+r.id;
    defs += `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/>
    </linearGradient>`;
    paths += `<path class="rel-edge" data-id="${r.id}" data-a="${r.charA}" data-b="${r.charB}" onclick="event.stopPropagation(); openEditRelationshipModal('${r.id}')" d="M${x1},${y1} L${x2},${y2}" stroke="url(#${gradId})" fill="none"/>`;
  });
  defs += '</defs>';
  svg.innerHTML = defs + paths;
}

function attachRelCanvasEvents(){
  const viewport = document.getElementById('relCanvasViewport');
  if(!viewport) return;
  viewport.addEventListener('mousedown', onRelCanvasMouseDown);
  attachFreeEdgeHover('rel', viewport);
  viewport.addEventListener('contextmenu', onRelCanvasContextMenu);
  viewport.addEventListener('wheel', onRelCanvasWheel, {passive:false});
}

function onRelCanvasWheel(e){
  e.preventDefault();
  const viewport = document.getElementById('relCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const cursorX = e.clientX-rect.left, cursorY = e.clientY-rect.top;
  const oldScale = relCanvasView.scale;
  const newScale = Math.min(2, Math.max(0.35, oldScale + (e.deltaY<0?0.1:-0.1)));
  const localX=(cursorX-relCanvasView.pan.x)/oldScale, localY=(cursorY-relCanvasView.pan.y)/oldScale;
  relCanvasView.pan.x = cursorX-localX*newScale;
  relCanvasView.pan.y = cursorY-localY*newScale;
  relCanvasView.scale = newScale;
  applyRelCanvasTransform(); drawRelEdges();
}

function onRelCanvasContextMenu(e){
  const viewport = document.getElementById('relCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const lx = (e.clientX-rect.left-relCanvasView.pan.x)/relCanvasView.scale;
  const ly = (e.clientY-rect.top-relCanvasView.pan.y)/relCanvasView.scale;
  const here = {netX:Math.max(0,Math.round(lx-42)), netY:Math.max(0,Math.round(ly-26))};
  const nodeEl = e.target.closest('.rel-node');
  if(nodeEl){
    const c = itemsOf('characters', state.activeProjectId).find(x=>x.id===nodeEl.dataset.id);
    if(c) return showCtxMenu(e, [
      {label:'+ Новая связь от «'+(c.name||'персонажа')+'»', onClick:()=>openNewRelationshipModal(c.id)},
      {label:'+ Новая связь', onClick:()=>openNewRelationshipModal()},
      {label:'+ Новый персонаж рядом', onClick:()=>openNewCharacterModal({netX:c.netX+120, netY:c.netY})},
      {sep:true},
      {label:'Изменить персонажа', onClick:()=>openEditCharacterModal(c.id)},
      ...colorMenuRows('rel', c, nodeEl),
      {sep:true},
      {label:'Удалить персонажа', danger:true, onClick:()=>deleteCharacter(c.id)}
    ]);
  }
  showCtxMenu(e, [
    {label:'+ Новый персонаж здесь', onClick:()=>openNewCharacterModal(here)},
    {label:'+ Новая связь', onClick:()=>openNewRelationshipModal()},
  ]);
}

function onRelCanvasMouseDown(e){
  if(e.button!==0) return;
  const viewport = document.getElementById('relCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const portEl = e.target.closest('.rel-port');
  const nodeEl = e.target.closest('.rel-node');

  if(portEl){
    const sourceId = portEl.dataset.id;
    const svg = document.getElementById('relEdgesSvg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg','path');
    tempPath.setAttribute('class','temp-edge');
    svg.appendChild(tempPath);
    const move=(ev)=>{
      const s = itemsOf('characters', state.activeProjectId).find(x=>x.id===sourceId);
      if(!s) return;
      const x1=s.netX+42, y1=s.netY+26;
      const lx=(ev.clientX-rect.left-relCanvasView.pan.x)/relCanvasView.scale, ly=(ev.clientY-rect.top-relCanvasView.pan.y)/relCanvasView.scale;
      tempPath.setAttribute('d', `M${x1},${y1} L${lx},${ly}`);
    };
    const up=(ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      tempPath.remove();
      const targetNode = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.rel-node');
      if(targetNode && targetNode.dataset.id !== sourceId) openNewRelationshipModal(sourceId, targetNode.dataset.id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.stopPropagation(); e.preventDefault();
    return;
  }

  if(nodeEl){
    const id = nodeEl.dataset.id;
    const c = itemsOf('characters', state.activeProjectId).find(x=>x.id===id);
    if(!c) return;
    const startX=e.clientX, startY=e.clientY, ox=c.netX, oy=c.netY;
    let moved = false, dropId = null;
    nodeEl.classList.add('dragging');
    const move=(ev)=>{
      if(Math.abs(ev.clientX-startX)>3 || Math.abs(ev.clientY-startY)>3) moved = true;
      c.netX = ox + (ev.clientX-startX)/relCanvasView.scale;
      c.netY = oy + (ev.clientY-startY)/relCanvasView.scale;
      nodeEl.style.left = c.netX+'px'; nodeEl.style.top = c.netY+'px';
      drawRelEdges();
      if(moved){ const t = freeDropTarget('rel', ev, viewport, relCanvasView, id); if(t!==dropId){ dropId = t; setFreeDropHighlight(viewport, 'rel-node', t); } }
    };
    const up=(ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      nodeEl.classList.remove('dragging');
      setFreeDropHighlight(viewport, 'rel-node', null);
      if(moved && dropId){
        // брошена в центр другой карточки — возвращаем на место и создаём связь
        c.netX = ox; c.netY = oy;
        nodeEl.style.left = ox+'px'; nodeEl.style.top = oy+'px';
        drawRelEdges();
        cardDropRelation('rel', id, dropId, ev);
        return;
      }
      if(moved) queueSave(); else relToggleSelect(id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }

  const startX=e.clientX, startY=e.clientY, ox=relCanvasView.pan.x, oy=relCanvasView.pan.y;
  viewport.classList.add('panning');
  const move=(ev)=>{
    relCanvasView.pan.x = ox+(ev.clientX-startX);
    relCanvasView.pan.y = oy+(ev.clientY-startY);
    applyRelCanvasTransform();
  };
  const up=()=>{
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    viewport.classList.remove('panning');
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function relToggleSelect(id){
  relSelected = relSelected===id ? null : id;
  document.querySelectorAll('.rel-node').forEach(n=>{ n.classList.toggle('dim', relSelected && n.dataset.id !== relSelected); });
  document.querySelectorAll('.rel-edge').forEach(ed=>{
    const connected = !relSelected || ed.dataset.a===relSelected || ed.dataset.b===relSelected;
    ed.classList.toggle('dim', !connected);
  });
}

function initials(name){ return (name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

function relCard(r){
  const types = relTypes(r), evolves = relEvolves(r);
  const typesHtml = types.map(t=>`<span class="d-tag" style="border-color:${relTypeColor(t)}; color:${relTypeColor(t)};">${esc(relTypeLabel(t))}</span>`).join('');
  const evolvesHtml = evolves.length ? `<span style="margin:0 4px; color:var(--text-faint);">→</span>` + evolves.map(t=>`<span class="d-tag" style="border-color:${relTypeColor(t)}; color:${relTypeColor(t)};">${esc(relTypeLabel(t))}</span>`).join('') : '';
  return `<div class="dossier">
    <div class="d-top"><h3 style="font-size:14.5px;">${esc(charName(r.charA))} ↔ ${esc(charName(r.charB))}</h3></div>
    <div class="d-tags" style="margin-top:8px; align-items:center;">${typesHtml}${evolvesHtml}</div>
    ${r.evolveNote ? `<div class="d-alias" style="margin-top:6px;">${esc(r.evolveNote)}</div>` : ''}
    ${r.desc ? `<div class="d-desc">${esc(r.desc)}</div>` : ''}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('relationships','${r.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('relationships','${r.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditRelationshipModal('${r.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteRelationship('${r.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewRelationshipModal(presetA, presetB){
  openFormModal('Новая связь', relationshipFields(), {charA: presetA||'', charB: presetB||''}, (vals)=>{
    if(vals.charA===vals.charB){ showToast('Выберите двух разных персонажей'); return; }
    data.relationships.push(Object.assign({id:uid(), projectId: state.activeProjectId}, vals));
    queueSave(); closeModal(); renderMain();
  });
}
function openEditRelationshipModal(id){
  const r = data.relationships.find(x=>x.id===id);
  const initial = Object.assign({}, r, { types: relTypes(r), evolvesTo: relEvolves(r) });
  openFormModal('Изменить связь', relationshipFields(), initial, (vals)=>{ Object.assign(r, vals); delete r.type; queueSave(); closeModal(); renderMain(); },
    { label:'Удалить связь', onClick: ()=>{ closeModal(); deleteRelationship(id); } });
}
function deleteRelationship(id){ data.relationships = data.relationships.filter(r=>r.id!==id); queueSave(); renderMain(); }
function relationshipFields(){
  const chars = itemsOf('characters', state.activeProjectId).map(c=>[c.id,c.name]);
  const typeOptions = Object.entries(REL_TYPES).map(([k,v])=>[k,v.label]);
  return [
    {key:'charA', label:'Персонаж А', type:'select', options: chars, required:true},
    {key:'charB', label:'Персонаж Б', type:'select', options: chars, required:true},
    {key:'types', label:'Тип связи — можно выбрать сразу несколько', type:'multiselect', options: typeOptions, required:true},
    {key:'evolvesTo', label:'Во что переросла со временем (необязательно)', type:'multiselect', options: typeOptions},
    {key:'evolveNote', label:'Когда и почему изменилась', type:'text', placeholder:'например: после предательства в 3 акте'},
    {key:'desc', label:'Описание связи', type:'textarea'},
  ];
}

/* ---------------- TIMELINE ---------------- */
function eventCard(e){
  return `<div class="tl-event" id="tlevent-${e.id}" data-id="${e.id}"><span class="tl-marker-dot"></span><div class="tl-card">
    <div class="tl-date">${esc(e.date||'дата не указана')}</div>
    <h3>${esc(e.title)}</h3>
    ${e.arc ? `<div class="tl-arc">Арка: ${esc(e.arc)}</div>` : ''}
    ${collapsibleBlock('event-desc-'+e.id, 'Что произошло', e.desc)}
    ${e.charIds && e.charIds.length ? `<div class="d-tags">${e.charIds.map(id=>`<span class="d-tag">${esc(charName(id))}</span>`).join('')}</div>` : ''}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('events','${e.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('events','${e.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditEventModal('${e.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteEvent('${e.id}')">Удалить</button>
    </div>
  </div></div>`;
}
let timelineScrollHandler = null;
function teardownTimelineNav(){
  if(timelineScrollHandler){ window.removeEventListener('scroll', timelineScrollHandler); timelineScrollHandler = null; }
}
function renderTimeline(el, pid){
  teardownTimelineNav();
  const events = itemsOf('events', pid).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  el.innerHTML = `
    <div class="toolbar">
      <div class="eyebrow">Отсортировано по порядковому номеру события</div>
      <button class="btn btn-primary fab-add" onclick="openNewEventModal()">+ Новое событие</button>
    </div>
    <div class="tl-layout">
      <div class="tl-navlist ${events.length ? 'has-events' : ''}" id="tlNavList">
        ${events.map((e,i)=>`<div class="tl-navitem" data-id="${e.id}" onclick="scrollToTimelineEvent('${e.id}')" title="${esc(e.title)}">
          <span class="tl-navitem-num">${i+1}</span><span class="tl-navitem-title">${esc(e.title)}</span>
        </div>`).join('')}
      </div>
      <div id="timelineList" style="max-width:720px; flex:1; min-width:0;">${events.length ? events.map(eventCard).join('') : '<div class="empty-tab">Событий пока нет.</div>'}</div>
    </div>
  `;
  if(events.length){
    updateTimelineNavActive(events[0].id);
    timelineScrollHandler = ()=>{ updateTimelineNavActive(); };
    window.addEventListener('scroll', timelineScrollHandler, {passive:true});
  }
}
function updateTimelineNavActive(forceId){
  const list = document.getElementById('tlNavList');
  if(!list) return;
  const items = Array.from(list.querySelectorAll('.tl-navitem'));
  if(!items.length) return;
  let activeId = forceId;
  if(!activeId){
    const refY = window.innerHeight * 0.3;
    let closestDist = Infinity;
    items.forEach(item=>{
      const card = document.getElementById('tlevent-'+item.dataset.id);
      if(!card) return;
      const marker = card.querySelector('.tl-marker-dot');
      const y = (marker||card).getBoundingClientRect().top;
      const dist = Math.abs(y - refY);
      if(dist < closestDist){ closestDist = dist; activeId = item.dataset.id; }
    });
  }
  items.forEach(item=>{
    const active = item.dataset.id===activeId;
    item.classList.toggle('active', active);
    if(active) item.scrollIntoView({block:'nearest'});
  });
  document.querySelectorAll('#timelineList .tl-marker-dot').forEach(m=>{
    const card = m.closest('.tl-event');
    m.classList.toggle('active', !!(card && card.dataset.id===activeId));
  });
}
function scrollToTimelineEvent(id){
  const card = document.getElementById('tlevent-'+id);
  if(!card) return;
  const sidebar = document.getElementById('sidebar');
  const offset = (sidebar ? sidebar.offsetHeight : 0) + 20;
  const targetY = window.scrollY + card.getBoundingClientRect().top - offset;
  window.scrollTo({top: Math.max(0, targetY), behavior:'smooth'});
  card.classList.add('highlight-flash');
  setTimeout(()=>card.classList.remove('highlight-flash'), 1500);
  updateTimelineNavActive(id);
}
function openNewEventModal(){
  const maxOrder = Math.max(0, ...itemsOf('events', state.activeProjectId).map(e=>e.order||0));
  openFormModal('Новое событие', eventFields(), {order: maxOrder+1}, (vals)=>{
    vals.order = Number(vals.order)||0;
    data.events.push(Object.assign({id:uid(), projectId: state.activeProjectId}, vals));
    queueSave(); closeModal(); renderMain();
  });
}
function openEditEventModal(id){
  const e = data.events.find(x=>x.id===id);
  openFormModal('Изменить событие', eventFields(), e, (vals)=>{ vals.order=Number(vals.order)||0; Object.assign(e, vals); queueSave(); closeModal(); renderMain(); });
}
function deleteEvent(id){ data.events = data.events.filter(e=>e.id!==id); queueSave(); renderMain(); }
function eventFields(){
  return [
    {key:'title', label:'Название события', type:'text', required:true},
    {key:'date', label:'Дата (в мире истории, текстом)', type:'text', placeholder:'год 3 эпохи, глава 12…'},
    {key:'order', label:'Порядковый номер (для сортировки)', type:'text'},
    {key:'arc', label:'Арка / часть', type:'text'},
    {key:'charIds', label:'Участники', type:'multiselect', options: itemsOf('characters', state.activeProjectId).map(c=>[c.id,c.name])},
    {key:'desc', label:'Что произошло', type:'textarea'},
  ];
}

/* ---------------- STRUCTURE (node editor) ---------------- */
function renderStructure(el, pid){
  const scenes = itemsOf('scenes', pid);
  el.innerHTML = `
    <div class="canvas-toolbar">
      <div class="eyebrow">Тащите карточки за шапку. Тяните от точки справа к другой карточке — так соединяются сцены. Клик по стрелке удаляет связь. Двойной клик по карточке — редактировать.</div>
      <div style="display:flex; gap:8px; align-items:center;">
        ${histBtnsHtml('scenes')}
        <div class="canvas-zoom-controls">
          <button class="btn btn-sm" onclick="zoomCanvas(-0.15)">−</button>
          <span class="mono" id="zoomLabel" style="font-size:12px; color:var(--text-faint); min-width:42px; text-align:center; display:inline-block;">100%</span>
          <button class="btn btn-sm" onclick="zoomCanvas(0.15)">+</button>
        </div>
        <button class="btn btn-sm" onclick="resetCanvasView()">Центрировать</button>
        <button class="btn btn-primary btn-sm" onclick="addScene()">+ Сцена</button>
      </div>
    </div>
    ${scenes.length===0 ? `<div class="empty-tab" style="margin-bottom:14px;">Пусто. Добавьте первую сцену — карточку можно будет свободно перетаскивать и соединять с другими.</div>` : ''}
    <div id="storyCanvasViewport">
      <div id="storyCanvasInner">
        <svg id="edgesSvg" width="4000" height="3000"></svg>
        ${scenes.map(sceneNodeHtml).join('')}
      </div>
    </div>
  `;
  applyCanvasTransform();
  drawEdges();
  attachCanvasEvents();
}

function sceneNodeHtml(s){
  const status = s.status || 'idea';
  return `<div class="scene-node status-${status}" id="char-${s.id}" data-id="${s.id}" style="left:${s.x}px; top:${s.y}px;" ondblclick="openEditSceneModal('${s.id}')">
    <div class="sn-head">
      <span class="sn-status"></span>
      <span class="sn-title">${esc(s.title||'Без названия')}</span>
      <button class="sn-remove" title="Удалить сцену" onclick="event.stopPropagation(); deleteScene('${s.id}')">×</button>
    </div>
    <div class="sn-body">${esc(s.summary||'')}</div>
    <div class="port port-in" data-port="in" data-id="${s.id}" title="Сюда приходят связи"></div>
    <div class="port port-out" data-port="out" data-id="${s.id}" title="Отсюда тяните новую связь"></div>
  </div>`;
}

function applyCanvasTransform(){
  const inner = document.getElementById('storyCanvasInner');
  if(!inner) return;
  inner.style.transform = `translate(${canvasView.pan.x}px, ${canvasView.pan.y}px) scale(${canvasView.scale})`;
  const lbl = document.getElementById('zoomLabel');
  if(lbl) lbl.textContent = Math.round(canvasView.scale*100)+'%';
}
function zoomCanvas(delta){
  canvasView.scale = Math.min(2, Math.max(0.35, canvasView.scale+delta));
  applyCanvasTransform(); drawEdges();
}
function resetCanvasView(){
  canvasView.pan = {x:120,y:80}; canvasView.scale = 1;
  applyCanvasTransform(); drawEdges();
}

function getScenePortCenter(nodeId, portClass){
  const el = document.querySelector(`.scene-node[data-id="${nodeId}"] .${portClass}`);
  const viewport = document.getElementById('storyCanvasViewport');
  if(!el || !viewport) return null;
  const portRect = el.getBoundingClientRect();
  const vpRect = viewport.getBoundingClientRect();
  const screenX = portRect.left + portRect.width/2 - vpRect.left;
  const screenY = portRect.top + portRect.height/2 - vpRect.top;
  return {
    x: (screenX - canvasView.pan.x) / canvasView.scale,
    y: (screenY - canvasView.pan.y) / canvasView.scale,
  };
}

function drawEdges(){
  const svg = document.getElementById('edgesSvg');
  if(!svg) return;
  const links = itemsOf('sceneLinks', state.activeProjectId);
  let out = `<defs><marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--gold)"/></marker></defs>`;
  out += links.map(l=>{
    const p1 = getScenePortCenter(l.from, 'port-out');
    const p2 = getScenePortCenter(l.to, 'port-in');
    if(!p1||!p2) return '';
    const mx = (p1.x+p2.x)/2;
    return `<path class="scene-edge" onclick="deleteSceneLink('${l.id}')" d="M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}" marker-end="url(#arrowHead)"/>`;
  }).join('');
  svg.innerHTML = out;
}

function attachCanvasEvents(){
  const viewport = document.getElementById('storyCanvasViewport');
  if(!viewport) return;
  viewport.addEventListener('mousedown', onCanvasMouseDown);
  viewport.addEventListener('contextmenu', onCanvasContextMenu);
  viewport.addEventListener('wheel', onCanvasWheel, {passive:false});
}

function onCanvasWheel(e){
  e.preventDefault();
  const viewport = document.getElementById('storyCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const cursorX = e.clientX-rect.left, cursorY = e.clientY-rect.top;
  const oldScale = canvasView.scale;
  const newScale = Math.min(2, Math.max(0.35, oldScale + (e.deltaY < 0 ? 0.1 : -0.1)));
  const localX = (cursorX - canvasView.pan.x)/oldScale;
  const localY = (cursorY - canvasView.pan.y)/oldScale;
  canvasView.pan.x = cursorX - localX*newScale;
  canvasView.pan.y = cursorY - localY*newScale;
  canvasView.scale = newScale;
  applyCanvasTransform(); drawEdges();
}

function onCanvasMouseDown(e){
  if(e.button!==0) return;
  const viewport = document.getElementById('storyCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const portEl = e.target.closest('.port');
  const nodeEl = e.target.closest('.scene-node');

  if(portEl && portEl.dataset.port==='out'){
    const sourceId = portEl.dataset.id;
    const svg = document.getElementById('edgesSvg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg','path');
    tempPath.setAttribute('class','temp-edge');
    svg.appendChild(tempPath);
    const startPort = getScenePortCenter(sourceId, 'port-out');
    const move = (ev)=>{
      if(!startPort) return;
      const lx=(ev.clientX-rect.left-canvasView.pan.x)/canvasView.scale, ly=(ev.clientY-rect.top-canvasView.pan.y)/canvasView.scale;
      tempPath.setAttribute('d', `M${startPort.x},${startPort.y} L${lx},${ly}`);
    };
    const up = (ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      tempPath.remove();
      const targetNode = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.scene-node');
      if(targetNode && targetNode.dataset.id !== sourceId) createSceneLink(sourceId, targetNode.dataset.id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.stopPropagation(); e.preventDefault();
    return;
  }

  if(nodeEl && !portEl){
    const id = nodeEl.dataset.id;
    const scene = itemsOf('scenes', state.activeProjectId).find(x=>x.id===id);
    if(!scene) return;
    const startX=e.clientX, startY=e.clientY, ox=scene.x, oy=scene.y;
    let moved = false;
    nodeEl.classList.add('dragging');
    const move=(ev)=>{
      moved = true;
      scene.x = ox + (ev.clientX-startX)/canvasView.scale;
      scene.y = oy + (ev.clientY-startY)/canvasView.scale;
      nodeEl.style.left = scene.x+'px'; nodeEl.style.top = scene.y+'px';
      drawEdges();
    };
    const up=()=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      nodeEl.classList.remove('dragging');
      if(moved) queueSave();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }

  if(e.target.id==='storyCanvasViewport' || e.target.id==='storyCanvasInner' || e.target.id==='edgesSvg'){
    const startX=e.clientX, startY=e.clientY, ox=canvasView.pan.x, oy=canvasView.pan.y;
    viewport.classList.add('panning');
    const move=(ev)=>{
      canvasView.pan.x = ox+(ev.clientX-startX);
      canvasView.pan.y = oy+(ev.clientY-startY);
      applyCanvasTransform();
    };
    const up=()=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      viewport.classList.remove('panning');
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}

/* ---------------- HEX MODE (режим «Соты») ---------------- */
const HEX_SIZE = 44;                       // радиус соты (центр → угол), px
const HEX_W = Math.sqrt(3) * HEX_SIZE;     // ширина pointy-top соты
const HEX_H = 2 * HEX_SIZE;                // высота соты
const hexRelView  = { pan:{x:0,y:0}, scale:1, key:null };
const hexTreeView = { pan:{x:0,y:0}, scale:1, key:null };

function ensureSettings(){
  if(!data.settings || typeof data.settings!=='object' || Array.isArray(data.settings)) data.settings = {};
  if(data.settings.viewModeNetworks!=='hex') data.settings.viewModeNetworks = 'free';
  // режима «Свободный» у древа больше нет: прежнее значение «free» автоматически превращается в «Древо»
  if(data.settings.viewModeDynasty!=='hex' && data.settings.viewModeDynasty!=='family') data.settings.viewModeDynasty = 'family';
}
function syncViewModes(){
  ensureSettings();
  state.viewModeNetworks = data.settings.viewModeNetworks;
  state.viewModeDynasty = data.settings.viewModeDynasty;
}

/* --- геометрия --- */
function hexPts(cx, cy, R){
  const pts = [];
  for(let i=0;i<6;i++){
    const a = Math.PI/180 * (60*i - 30);
    pts.push((cx + R*Math.cos(a)).toFixed(2)+','+(cy + R*Math.sin(a)).toFixed(2));
  }
  return pts.join(' ');
}
function axialToPixel(q, r){
  return { x: HEX_SIZE * Math.sqrt(3) * (q + r/2), y: HEX_SIZE * 1.5 * r };
}
function roundHex(q, r){
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const qd = Math.abs(rq-q), rd = Math.abs(rr-r), sd = Math.abs(rs-s);
  if(qd > rd && qd > sd) rq = -rr - rs;
  else if(rd > sd) rr = -rq - rs;
  return { q: rq, r: rr };
}
function pixelToHex(x, y){
  const q = (Math.sqrt(3)/3 * x - 1/3 * y) / HEX_SIZE;
  const r = (2/3 * y) / HEX_SIZE;
  return roundHex(q, r);
}

/* --- переключатель режимов --- */
function viewModeIcon(mode){
  const svgOpen = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  if(mode==='family'){
    return svgOpen + '<circle cx="12" cy="5.5" r="2.6"/><circle cx="6" cy="18.5" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M12 8.1v3.4M6 15.9v-2.4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2.4"/></svg>';
  }
  if(mode==='hex'){
    const r = 4.4, D = Math.sqrt(3)*r + 1.3;
    const cs = [[12, 8.2], [12 - D/2, 15.7], [12 + D/2, 15.7]];
    return svgOpen + cs.map(c=>`<polygon class="hex-ico" points="${hexPts(c[0], c[1], r)}" stroke-width="1.6"/>`).join('') + '</svg>';
  }
  // сплошной круг + пунктирный, на треть выглядывающий справа
  return svgOpen +
    '<path d="M12 6.34 A6 6 0 1 1 12 17.66" stroke-dasharray="2.2 2"/>' +
    '<circle cx="10" cy="12" r="6"/></svg>';
}
function viewSwitchHtml(kind){
  if(kind==='dynasty'){
    const cur = state.viewModeDynasty;
    const defs = [['family','Древо','Режим «Древо» — круги сами встают по родственным связям'], ['hex','Соты','Режим «Соты»']];
    return `<div class="view-mode-seg" role="group" aria-label="Режим отображения">${defs.map(d=>`<button type="button" class="${cur===d[0]?'active':''}" onclick="setViewMode('dynasty','${d[0]}')" title="${d[2]}">${viewModeIcon(d[0])}<span>${d[1]}</span></button>`).join('')}</div>`;
  }
  const cur = (kind==='networks' ? state.viewModeNetworks : state.viewModeDynasty)==='hex' ? 'hex' : 'free';
  const other = cur==='hex' ? 'free' : 'hex';
  const btn = (m, act)=>`<button type="button" class="${act?'active':''}" onclick="toggleViewMode('${kind}')" title="${m==='hex'?'Режим «Соты»':'Режим «Свободный»'}">${viewModeIcon(m)}<span>${m==='hex'?'Соты':'Свободный'}</span></button>`;
  return `<div class="view-mode-seg" role="group" aria-label="Режим отображения">${btn(cur,true)}${btn(other,false)}</div>`;
}
function setViewMode(kind, mode){
  ensureSettings();
  const key = kind==='networks' ? 'viewModeNetworks' : 'viewModeDynasty';
  if(data.settings[key]===mode) return;
  data.settings[key] = mode;
  state[key] = mode;
  queueSave();
  if(kind==='networks') renderMain(); else refreshTreeEditor();
}
function toggleViewMode(kind){
  ensureSettings();
  const key = kind==='networks' ? 'viewModeNetworks' : 'viewModeDynasty';
  const next = data.settings[key]==='hex' ? 'free' : 'hex';
  data.settings[key] = next;
  state[key] = next;
  queueSave();
  if(kind==='networks') renderMain(); else refreshTreeEditor();
}

/* --- конфигурация двух досок --- */
function hexCfg(kind){
  if(kind==='rel') return {
    kind, view:hexRelView, vp:'hexRelViewport', layer:'hexRelLayer', grid:'hexRelGrid', hint:'hexRelHint', cards:'hexRelCards', label:'relZoomLabel', lines:'hexRelLines',
    edges:()=>itemsOf('relationships', state.activeProjectId).map(r=>{
      const types = relTypes(r), ev = relEvolves(r);
      return {id:r.id, from:r.charA, to:r.charB, c1:relTypeColor(types[0]), c2: ev.length ? relTypeColor(ev[0]) : relTypeColor(types[types.length-1]), route:r.route};
    }),
    findEdge:(id)=>data.relationships.find(x=>x.id===id),
    boardKey:()=>'rel:'+state.activeProjectId,
    items:()=>itemsOf('characters', state.activeProjectId),
    open:(id)=>openEditCharacterModal(id)
  };
  return {
    kind, view:hexTreeView, vp:'hexTreeViewport', layer:'hexTreeLayer', grid:'hexTreeGrid', hint:'hexTreeHint', cards:'hexTreeCards', label:'treeZoomLabel', lines:'hexTreeLines',
    edges:()=>data.dynastyMemberLinks.filter(l=>l.dynastyId===state.activeTreeId).map(l=>{
      const col = l.kind==='spouse' ? '#d98aa0' : l.kind==='sibling' ? '#7fb5d6' : '#c9a24c';
      return {id:l.id, from:l.fromId, to:l.toId, c1:col, c2:col, route:l.route};
    }),
    findEdge:(id)=>data.dynastyMemberLinks.find(x=>x.id===id),
    boardKey:()=>'tree:'+state.activeTreeId,
    items:()=>data.dynastyMembers.filter(m=>m.dynastyId===state.activeTreeId),
    open:(id)=>openEditMemberModal(state.activeTreeId, id)
  };
}
function hexBoardHtml(kind){
  const c = hexCfg(kind);
  return `<div id="${c.vp}" class="hex-viewport"><div id="${c.layer}" class="hex-layer"><svg id="${c.grid}" class="hex-grid"></svg><svg id="${c.hint}" class="hex-grid hex-hint"></svg><div id="${c.cards}"></div><svg id="${c.lines}" class="hex-grid hex-lines"></svg></div></div>`;
}

/* --- автораскладка (один раз, для тех, у кого нет hexQ/hexR) --- */
function ensureHexPositions(items){
  const valid = it => Number.isFinite(it.hexQ) && Number.isFinite(it.hexR);
  const seen = new Set(), missing = [];
  items.forEach(it=>{
    if(valid(it)){
      const k = it.hexQ+','+it.hexR;
      if(seen.has(k)) missing.push(it); else seen.add(k);
    } else missing.push(it);
  });
  if(!missing.length) return false;
  const W = Math.max(2, Math.ceil(Math.sqrt(items.length)));
  let idx = 0;
  for(let r=0; idx<missing.length; r++){
    for(let i=0; i<W && idx<missing.length; i++){
      const q = i - Math.floor(r/2);           // ровные ряды без «косой» сетки
      const k = q+','+r;
      if(seen.has(k)) continue;
      seen.add(k);
      missing[idx].hexQ = q; missing[idx].hexR = r; idx++;
    }
  }
  queueSave();
  return true;
}

/* --- отрисовка --- */
function cardColorVars(it){
  return it.hexBorder ? `--hex-ring:${esc(it.hexBorder)};` : '';
}
function colorMenuRows(kind, it, el){
  return [
    {sep:true},
    {colors:true, title:'Цвет обрамления и подсветки', value:it.hexBorder||'', onPick:val=>setHexColor(kind, it.id, 'hexBorder', val, el)},
  ];
}
function hexCardHtml(it, color){
  const cx = HEX_W/2, cy = HEX_H/2;
  const inner = it.photo ? `<img src="${it.photo}" alt="" draggable="false">` : `<span class="hex-ph" style="background:${color};">${esc(initials(it.name))}</span>`;
  const cv = cardColorVars(it);
  return `<div class="hex-card" data-id="${it.id}" style="width:${HEX_W}px; height:${HEX_H}px;${cv}">
    <div class="hex-photo">${inner}</div>
    <svg class="hex-ring" width="${HEX_W}" height="${HEX_H}" viewBox="0 0 ${HEX_W} ${HEX_H}"><polygon points="${hexPts(cx, cy, HEX_SIZE-1.5)}"/></svg>
    <div class="hex-name">${esc(it.name||'')}</div>
  </div>`;
}
function placeHexCard(el, it){
  const p = axialToPixel(it.hexQ, it.hexR);
  el.style.left = (p.x - HEX_W/2) + 'px';
  el.style.top = (p.y - HEX_H/2) + 'px';
}
function buildHexCards(kind){
  const c = hexCfg(kind), host = document.getElementById(c.cards);
  if(!host) return;
  const proj = data.projects.find(p=>p.id===state.activeProjectId);
  const color = projectColor(proj);
  const items = c.items();
  host.innerHTML = items.map(it=>hexCardHtml(it, color)).join('');
  host.querySelectorAll('.hex-card').forEach(el=>{
    const it = items.find(x=>x.id===el.dataset.id);
    if(it) placeHexCard(el, it);
  });
}
function drawHexGrid(kind){
  const c = hexCfg(kind), vp = document.getElementById(c.vp), svg = document.getElementById(c.grid);
  if(!vp || !svg) return;
  const v = c.view, w = vp.clientWidth, h = vp.clientHeight, m = HEX_W*3;
  const x0 = -v.pan.x/v.scale - m, x1 = (w - v.pan.x)/v.scale + m;
  const y0 = -v.pan.y/v.scale - m, y1 = (h - v.pan.y)/v.scale + m;
  const rMin = Math.floor(y0/(1.5*HEX_SIZE)), rMax = Math.ceil(y1/(1.5*HEX_SIZE));
  const key = [rMin, rMax, Math.floor(x0/HEX_W), Math.ceil(x1/HEX_W), svg._rev||0].join('|');
  if(svg._key === key) return;
  svg._key = key;
  const taken = new Set(c.items().map(it=>it.hexQ+','+it.hexR));
  let out = '';
  for(let r=rMin; r<=rMax; r++){
    const qMin = Math.floor(x0/HEX_W - r/2), qMax = Math.ceil(x1/HEX_W - r/2);
    for(let q=qMin; q<=qMax; q++){
      if(taken.has(q+','+r)) continue;
      const p = axialToPixel(q, r);
      out += `<polygon points="${hexPts(p.x, p.y, HEX_SIZE)}"/>`;
    }
  }
  svg.innerHTML = out;
}
function invalidateHexGrid(kind){
  const svg = document.getElementById(hexCfg(kind).grid);
  if(svg){ svg._rev = (svg._rev||0) + 1; }
}
function applyHexTransform(kind){
  const c = hexCfg(kind), layer = document.getElementById(c.layer);
  if(!layer) return;
  layer.style.transform = `translate(${c.view.pan.x}px, ${c.view.pan.y}px) scale(${c.view.scale})`;
  const lbl = document.getElementById(c.label);
  if(lbl) lbl.textContent = Math.round(c.view.scale*100) + '%';
  hideEdgeInfo(document.getElementById(c.vp));
  drawHexGrid(kind);
}
function fitHexView(kind){
  const c = hexCfg(kind), vp = document.getElementById(c.vp);
  if(!vp) return;
  const items = c.items();
  let cx = 0, cy = 0;
  if(items.length){
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
    items.forEach(it=>{ const p = axialToPixel(it.hexQ, it.hexR); x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); });
    cx = (x0+x1)/2; cy = (y0+y1)/2;
  }
  c.view.scale = 1;
  c.view.pan = { x: vp.clientWidth/2 - cx, y: vp.clientHeight/2 - cy };
}
function resetHexView(kind){ fitHexView(kind); applyHexTransform(kind); }
function hexZoomAt(kind, factor, clientX, clientY){
  const c = hexCfg(kind), vp = document.getElementById(c.vp);
  if(!vp) return;
  const v = c.view, rect = vp.getBoundingClientRect();
  const ns = Math.min(2, Math.max(0.35, v.scale*factor));
  const px = clientX - rect.left, py = clientY - rect.top;
  const lx = (px - v.pan.x)/v.scale, ly = (py - v.pan.y)/v.scale;
  v.pan.x = px - lx*ns; v.pan.y = py - ly*ns; v.scale = ns;
  applyHexTransform(kind);
}
function hexZoomBy(kind, delta){
  const c = hexCfg(kind), vp = document.getElementById(c.vp);
  if(!vp) return;
  const rect = vp.getBoundingClientRect();
  const target = Math.min(2, Math.max(0.35, c.view.scale + delta));
  hexZoomAt(kind, target/c.view.scale, rect.left + rect.width/2, rect.top + rect.height/2);
}

/* --- инициализация доски --- */
function initHexBoard(kind){
  const c = hexCfg(kind), vp = document.getElementById(c.vp);
  if(!vp) return;
  hexEdit = null;
  if(c.view.routeEdit){ c.view.routeEdit = null; if(c.view.routeKey){ document.removeEventListener('keydown', c.view.routeKey); c.view.routeKey = null; } }
  ensureHexPositions(c.items());
  buildHexCards(kind);
  drawHexLines(kind);
  const bk = c.boardKey();
  if(c.view.key !== bk){ fitHexView(kind); c.view.key = bk; }
  applyHexTransform(kind);
  vp.addEventListener('mousedown', e=>onHexMouseDown(kind, e));
  vp.addEventListener('contextmenu', e=>onHexContextMenu(kind, e));
  vp.addEventListener('mousemove', e=>onHexHover(kind, e));
  vp.addEventListener('mouseleave', ()=>hideEdgeInfo(vp));
  vp.addEventListener('wheel', e=>{ e.preventDefault(); hexZoomAt(kind, e.deltaY<0 ? 1.1 : 1/1.1, e.clientX, e.clientY); }, {passive:false});
}
window.addEventListener('resize', ()=>{ ['rel','tree'].forEach(k=>{ invalidateHexGrid(k); drawHexGrid(k); }); });



/* --- линии связей по граням сот --- */
const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function hexCorners(q, r){
  const p = axialToPixel(q, r), out = [];
  for(let i=0;i<6;i++){
    const a = Math.PI/180 * (60*i - 30);
    out.push({x:p.x + HEX_SIZE*Math.cos(a), y:p.y + HEX_SIZE*Math.sin(a)});
  }
  return out;
}
function vKey(pt){ return Math.round(pt.x*10)+'_'+Math.round(pt.y*10); }
function hexSharedEdge(a, b){
  const kb = new Set(hexCorners(b.q, b.r).map(vKey));
  const shared = hexCorners(a.q, a.r).filter(pt=>kb.has(vKey(pt)));
  return shared.length===2 ? shared : null;
}
// Кратчайший путь по граням сетки между ячейками a и b → массив точек
function hexPathBetween(a, b){
  const shared = hexSharedEdge(a, b);
  if(shared) return shared;                                   // соседние соты — общая грань
  const margin = 3;
  const q0 = Math.min(a.q,b.q)-margin, q1 = Math.max(a.q,b.q)+margin;
  const r0 = Math.min(a.r,b.r)-margin, r1 = Math.max(a.r,b.r)+margin;
  const adj = new Map(), pts = new Map();
  const link = (p1, p2)=>{
    const k1 = vKey(p1), k2 = vKey(p2);
    pts.set(k1, p1); pts.set(k2, p2);
    if(!adj.has(k1)) adj.set(k1, new Set()); if(!adj.has(k2)) adj.set(k2, new Set());
    adj.get(k1).add(k2); adj.get(k2).add(k1);
  };
  for(let r=r0; r<=r1; r++) for(let q=q0; q<=q1; q++){
    const cs = hexCorners(q, r);
    for(let i=0;i<6;i++) link(cs[i], cs[(i+1)%6]);
  }
  const targets = new Set(hexCorners(b.q, b.r).map(vKey));
  const queue = [], prev = new Map();
  hexCorners(a.q, a.r).forEach(pt=>{ const k = vKey(pt); prev.set(k, null); queue.push(k); });
  while(queue.length){
    const k = queue.shift();
    if(targets.has(k)){
      const path = [];
      for(let cur=k; cur!==null; cur=prev.get(cur)) path.push(pts.get(cur));
      return path.reverse();
    }
    adj.get(k).forEach(n=>{ if(!prev.has(n)){ prev.set(n, k); queue.push(n); } });
  }
  return null;
}
// «Умные» линии: напрямую от угла одной соты к углу другой; если на пути чужая карточка — обходим по сетке,
// но без лишних изгибов (срезаем объезды, пока отрезок не задевает чужие соты)
const HEX_LINE_SHRINK = 2.5;   // у карточек, которые соединяем: линия выходит из угла, поэтому касание допустимо
const HEX_LINE_MARGIN = 5;     // у чужих карточек: линия не должна прижиматься — держим небольшой зазор
function hexSegClear(p1, p2, centers, own){
  const dx = p2.x-p1.x, dy = p2.y-p1.y;
  const apBase = HEX_SIZE*Math.cos(Math.PI/6);
  for(const c of centers){
    if(segDist(c.x, c.y, p1.x, p1.y, p2.x, p2.y) > HEX_SIZE+HEX_LINE_MARGIN+1) continue;
    const isOwn = own && own.some(o=>Math.abs(o.x-c.x)<0.5 && Math.abs(o.y-c.y)<0.5);
    const ap = isOwn ? apBase - HEX_LINE_SHRINK : apBase + HEX_LINE_MARGIN;
    let t0 = 0, t1 = 1, inside = true;
    for(let k=0;k<6;k++){
      const nx = Math.cos(Math.PI/3*k), ny = Math.sin(Math.PI/3*k);
      const denom = nx*dx + ny*dy, num = ap - (nx*(p1.x-c.x) + ny*(p1.y-c.y));
      if(Math.abs(denom) < 1e-9){ if(num < 0){ inside = false; break; } continue; }
      const t = num/denom;
      if(denom > 0) t1 = Math.min(t1, t); else t0 = Math.max(t0, t);
      if(t1 - t0 <= 1e-6){ inside = false; break; }
    }
    if(inside && t1 - t0 > 1e-6) return false;
  }
  return true;
}
function hexSmartPath(a, b, centers){
  const shared = hexSharedEdge(a, b);
  if(shared) return shared;                                   // соседние соты — общая грань
  const ca = hexCorners(a.q, a.r), cb = hexCorners(b.q, b.r), cands = [];
  const own = [axialToPixel(a.q, a.r), axialToPixel(b.q, b.r)];
  ca.forEach(p=>cb.forEach(q=>cands.push({p, q, len:Math.hypot(p.x-q.x, p.y-q.y)})));
  cands.sort((x,y)=>x.len-y.len);
  for(const c of cands) if(hexSegClear(c.p, c.q, centers, own)) return [c.p, c.q];     // прямая линия
  const grid = hexPathBetween(a, b);
  if(!grid) return null;
  const out = [grid[0]];
  let i = 0;
  while(i < grid.length-1){
    let j = grid.length-1;
    while(j > i+1 && !hexSegClear(grid[i], grid[j], centers, own)) j--;
    out.push(grid[j]); i = j;
  }
  return out;
}
/* --- ручной маршрут линии: точки ставятся на углы сот, концы цепляются к ближайшим углам карточек --- */
function nearestCornerOf(item, pt){
  let best = null;
  hexCorners(item.hexQ, item.hexR).forEach(p=>{ const d = Math.hypot(p.x-pt.x, p.y-pt.y); if(!best || d<best.d) best = {d, p}; });
  return best.p;
}
function hexManualPath(a, b, route){
  const pts = route.filter(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if(!pts.length) return null;
  return [nearestCornerOf(a, pts[0]), ...pts, nearestCornerOf(b, pts[pts.length-1])];
}
// ближайший угол сетки к точке (x, y)
function snapToHexVertex(x, y){
  const c0 = pixelToHex(x, y);
  let best = null;
  const cells = [[0,0], ...HEX_DIRS];
  cells.forEach(([dq,dr])=>hexCorners(c0.q+dq, c0.r+dr).forEach(p=>{
    const d = Math.hypot(p.x-x, p.y-y);
    if(!best || d<best.d) best = {d, p};
  }));
  return {x:Math.round(best.p.x*100)/100, y:Math.round(best.p.y*100)/100};
}
function hexRouteOverlay(kind){
  const c = hexCfg(kind), layer = document.getElementById(c.layer);
  let svg = document.getElementById(c.layer+'Route');
  if(!svg){
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = c.layer+'Route'; svg.setAttribute('class', 'hex-grid hex-route');
    layer.appendChild(svg);
  }
  return svg;
}
function drawHexRoutePreview(kind){
  const c = hexCfg(kind), v = c.view, re = v.routeEdit;
  const svg = hexRouteOverlay(kind);
  if(!re){ svg.innerHTML = ''; return; }
  const pts = re.pts.slice();
  if(re.hover) pts.push(re.hover);
  let out = '';
  if(pts.length>=2) out += `<polyline class="hex-route-line" points="${pts.map(p=>p.x+','+p.y).join(' ')}"/>`;
  re.pts.forEach((p,i)=>{ out += `<circle class="hex-route-dot" cx="${p.x}" cy="${p.y}" r="${i===0||i===re.pts.length-1?5:4}"/>`; });
  if(re.hover) out += `<circle class="hex-route-hover" cx="${re.hover.x}" cy="${re.hover.y}" r="6"/>`;
  svg.innerHTML = out;
}
function hexRouteBanner(kind, on){
  const vp = document.getElementById(hexCfg(kind).vp);
  let el = vp.querySelector(':scope > .hex-route-banner');
  if(!on){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div'); el.className = 'hex-route-banner';
    el.addEventListener('mousedown', ev=>ev.stopPropagation());
    vp.appendChild(el);
  }
  el.innerHTML = `<span>Рисуем линию: кликайте по углам сот. Backspace — убрать точку, Enter — готово, Esc — отмена.</span>` +
    `<button type="button" class="btn btn-sm" data-act="undo">Назад</button>` +
    `<button type="button" class="btn btn-sm btn-primary" data-act="done">Готово</button>` +
    `<button type="button" class="btn btn-sm" data-act="cancel">Отмена</button>`;
  el.onclick = ev=>{
    const b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.act==='undo') hexRouteUndo(kind);
    else if(b.dataset.act==='done') finishHexRoute(kind, true);
    else finishHexRoute(kind, false);
  };
}
function startHexRouteEdit(kind, edgeId){
  const c = hexCfg(kind), v = c.view;
  const ed = c.findEdge(edgeId); if(!ed) return;
  if(v.routeEdit) finishHexRoute(kind, false);
  stopHexLineEdit();
  v.routeEdit = {id:edgeId, pts:[], hover:null};
  const vp = document.getElementById(c.vp);
  vp.classList.add('route-editing');
  const line = vp.querySelector('.hex-line'); // линии остаются видимыми, но приглушаются
  document.getElementById(c.lines).style.opacity = '0.35';
  v.routeKey = e=>{
    if(!v.routeEdit) return;
    if(e.key==='Escape'){ e.preventDefault(); finishHexRoute(kind, false); }
    else if(e.key==='Enter'){ e.preventDefault(); finishHexRoute(kind, true); }
    else if(e.key==='Backspace'){ e.preventDefault(); hexRouteUndo(kind); }
  };
  document.addEventListener('keydown', v.routeKey);
  hexRouteBanner(kind, true);
  drawHexRoutePreview(kind);
}
function hexRouteUndo(kind){
  const v = hexCfg(kind).view; if(!v.routeEdit) return;
  v.routeEdit.pts.pop(); drawHexRoutePreview(kind);
}
function finishHexRoute(kind, save){
  const c = hexCfg(kind), v = c.view, re = v.routeEdit;
  if(!re) return;
  v.routeEdit = null;
  document.removeEventListener('keydown', v.routeKey); v.routeKey = null;
  const vp = document.getElementById(c.vp);
  if(vp) vp.classList.remove('route-editing');
  const ls = document.getElementById(c.lines); if(ls) ls.style.opacity = '';
  hexRouteBanner(kind, false);
  drawHexRoutePreview(kind);
  if(save && re.pts.length){
    const ed = c.findEdge(re.id);
    if(ed){ ed.route = re.pts.map(p=>({x:p.x, y:p.y})); queueSave(); showToast('Линия проложена'); }
  } else if(save){ showToast('Поставьте хотя бы одну точку'); }
  drawHexLines(kind);
}
function resetHexRoute(kind, edgeId){
  const ed = hexCfg(kind).findEdge(edgeId); if(!ed) return;
  delete ed.route; queueSave(); drawHexLines(kind); showToast('Маршрут сброшен — линия снова автоматическая');
}
/* --- правка маршрута линии: на линии есть кружки — тяните их, и линия изгибается (точки встают на углы сот) --- */
let hexEdit = null;   // {kind, id} — линия, маршрут которой сейчас правится
function startHexLineEdit(kind, id){
  const v = hexCfg(kind).view;
  if(v.routeEdit) finishHexRoute(kind, false);
  hexEdit = {kind, id};
  drawHexLines(kind);
}
function stopHexLineEdit(){
  if(!hexEdit) return;
  const kind = hexEdit.kind;
  hexEdit = null;
  const old = document.getElementById('hexEditLayer'); if(old) old.remove();
  const vp = document.getElementById(hexCfg(kind).vp);
  const bar = vp && vp.querySelector(':scope > .hex-edit-bar'); if(bar) bar.remove();
}
function renderHexEdit(kind){
  const c = hexCfg(kind), layer = document.getElementById(c.layer), vp = document.getElementById(c.vp);
  const old = document.getElementById('hexEditLayer'); if(old) old.remove();
  const oldBar = vp && vp.querySelector(':scope > .hex-edit-bar');
  const eh = hexEdit && (c.view.edgeHit || []).find(x=>x.id===hexEdit.id);
  const rec = hexEdit && c.findEdge(hexEdit.id);
  if(!layer || !vp || !hexEdit || hexEdit.kind!==kind || !eh || !rec){ if(oldBar) oldBar.remove(); if(hexEdit && hexEdit.kind===kind) hexEdit = null; return; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'hexEditLayer'; svg.setAttribute('class', 'hex-grid hex-edit');
  const p = eh.path, route = Array.isArray(rec.route) ? rec.route : [];
  let html = `<polyline class="hex-edit-hl" points="${p.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ')}"/>`;
  for(let k=0;k<p.length-1;k++){
    const mx = (p[k].x+p[k+1].x)/2, my = (p[k].y+p[k+1].y)/2;
    html += `<circle class="hex-edit-ghost" data-seg="${k}" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6"><title>Потяните, чтобы изогнуть линию</title></circle>`;
  }
  route.forEach((pt, i)=>{ html += `<circle class="hex-edit-pt" data-i="${i}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="8"><title>Тяните, чтобы переместить. Двойной клик — убрать точку</title></circle>`; });
  svg.innerHTML = html;
  layer.appendChild(svg);
  svg.addEventListener('mousedown', e=>{
    const pt = e.target.closest('.hex-edit-pt'), gh = e.target.closest('.hex-edit-ghost');
    if(pt) startRouteDrag(kind, e, +pt.dataset.i, false, 0);
    else if(gh) startRouteDrag(kind, e, 0, true, +gh.dataset.seg);
  });
  svg.addEventListener('dblclick', e=>{
    const pt = e.target.closest('.hex-edit-pt');
    if(!pt) return;
    e.stopPropagation();
    removeRoutePoint(kind, +pt.dataset.i);
  });
  svg.addEventListener('contextmenu', e=>{
    const pt = e.target.closest('.hex-edit-pt');
    if(!pt) return;
    e.preventDefault(); e.stopPropagation();
    removeRoutePoint(kind, +pt.dataset.i);
  });
  if(!oldBar){
    const bar = document.createElement('div');
    bar.className = 'hex-edit-bar';
    bar.innerHTML = '<span>Маршрут линии: потяните кружок на линии, чтобы изогнуть её. Двойной клик по точке — убрать.</span><button type="button" class="btn btn-sm" data-act="reset">Сбросить</button><button type="button" class="btn btn-sm btn-primary" data-act="done">Готово</button>';
    ['mousedown','mouseup','contextmenu','dblclick','wheel'].forEach(t=>bar.addEventListener(t, ev=>ev.stopPropagation()));
    bar.addEventListener('click', ev=>{
      const b = ev.target.closest('button'); if(!b || !hexEdit) return;
      if(b.dataset.act==='reset') resetHexRoute(hexEdit.kind, hexEdit.id); else stopHexLineEdit();
    });
    vp.appendChild(bar);
  }
}
function removeRoutePoint(kind, i){
  const rec = hexEdit && hexCfg(kind).findEdge(hexEdit.id);
  if(!rec || !Array.isArray(rec.route)) return;
  rec.route.splice(i, 1);
  if(!rec.route.length) delete rec.route;
  queueSave();
  drawHexLines(kind);
}
function startRouteDrag(kind, e, idx, isGhost, seg){
  e.stopPropagation(); e.preventDefault();
  const c = hexCfg(kind), vp = document.getElementById(c.vp), v = c.view;
  const rec = hexEdit && c.findEdge(hexEdit.id);
  if(!vp || !rec) return;
  let i = idx, moved = false;
  if(isGhost){
    const eh = (v.edgeHit || []).find(x=>x.id===hexEdit.id);
    const a = eh.path[seg], b = eh.path[seg+1];
    const start = snapToHexVertex((a.x+b.x)/2, (a.y+b.y)/2);
    if(!Array.isArray(rec.route)) rec.route = [];
    i = rec.route.length ? seg : 0;               // первая своя точка заменяет автоматический маршрут
    rec.route.splice(i, 0, start);
  }
  v.busy = true;
  hideEdgeInfo(vp);
  const mv = ev=>{
    moved = true;
    const rect = vp.getBoundingClientRect();
    rec.route[i] = snapToHexVertex((ev.clientX-rect.left-v.pan.x)/v.scale, (ev.clientY-rect.top-v.pan.y)/v.scale);
    drawHexLines(kind);
  };
  const up = ()=>{
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    v.busy = false;
    if(isGhost && !moved){ rec.route.splice(i, 1); if(!rec.route.length) delete rec.route; drawHexLines(kind); return; }   // просто клик — ничего не меняем
    if(Array.isArray(rec.route)) rec.route = rec.route.filter((pt, k, arr)=>k===0 || Math.hypot(pt.x-arr[k-1].x, pt.y-arr[k-1].y) > 0.5);
    queueSave();
    drawHexLines(kind);
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}
window.addEventListener('keydown', e=>{
  if(e.key==='Escape' && hexEdit){ e.stopPropagation(); stopHexLineEdit(); }
}, true);
function hexRouteMenuItems(kind, ids){
  const c = hexCfg(kind), items = [];
  ids.forEach(id=>{
    const ed = c.findEdge(id); if(!ed) return;
    const suffix = ids.length>1 ? ' ('+(kind==='tree' ? memberLinkDesc(ed) : 'связь')+')' : '';
    items.push({label:'Изменить маршрут линии'+suffix, onClick:()=>startHexLineEdit(kind, id)});
    items.push({label:'Нарисовать линию заново…'+suffix, onClick:()=>startHexRouteEdit(kind, id)});
    if(Array.isArray(ed.route) && ed.route.length) items.push({label:'Вернуть автоматический маршрут'+suffix, onClick:()=>resetHexRoute(kind, id)});
  });
  return items;
}
function drawHexLines(kind){
  const c = hexCfg(kind), svg = document.getElementById(c.lines);
  if(!svg) return;
  const byId = {}; c.items().forEach(it=>byId[it.id]=it);
  let defs = '<defs>', out = '';
  c.view.edgeHit = [];
  const centers = c.items().map(it=>axialToPixel(it.hexQ, it.hexR));
  c.edges().forEach((ed, n)=>{
    const a = byId[ed.from], b = byId[ed.to];
    if(!a || !b || a===b) return;
    let path = null;
    if(Array.isArray(ed.route) && ed.route.length) path = hexManualPath(a, b, ed.route);
    if(!path) path = hexSmartPath({q:a.hexQ, r:a.hexR}, {q:b.hexQ, r:b.hexR}, centers);
    if(!path || path.length<2) return;
    c.view.edgeHit.push({a:ed.from, b:ed.to, id:ed.id, path});
    const p0 = path[0], pe = path[path.length-1];
    const gid = `hxg-${kind}-${n}`;
    defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${p0.x}" y1="${p0.y}" x2="${pe.x}" y2="${pe.y}"><stop offset="0" stop-color="${ed.c1}"/><stop offset="1" stop-color="${ed.c2}"/></linearGradient>`;
    out += `<polyline class="hex-line" points="${path.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}" stroke="url(#${gid})"/>`;
  });
  svg.innerHTML = defs + '</defs>' + out;
  if(hexEdit && hexEdit.kind===kind) renderHexEdit(kind);
}

/* --- всплывающая карточка связи при наведении на линию: (фото) Имя  тип ——— во что переросла  Имя (фото) --- */
function edgeInfoPerson(p){
  if(!p) return '<span class="ei-who"><span class="ei-ava">?</span><span class="ei-name">???</span></span>';
  const ava = p.photo ? `<img class="ei-ava" src="${p.photo}" alt="">` : `<span class="ei-ava">${esc(initials(p.name||''))}</span>`;
  return `<span class="ei-who">${ava}<span class="ei-name">${esc(p.name||'Без имени')}</span></span>`;
}
function edgeInfoHtml(kind, aId, bId){
  const pairHit = (x, y)=> (x===aId && y===bId) || (x===bId && y===aId);
  let people, rows = [];
  if(kind==='rel'){
    people = itemsOf('characters', state.activeProjectId);
    itemsOf('relationships', state.activeProjectId).filter(r=>pairHit(r.charA, r.charB)).forEach(r=>{
      const types = relTypes(r), evo = relEvolves(r);
      const c1 = relTypeColor(types[0]), c2 = evo.length ? relTypeColor(evo[0]) : relTypeColor(types[types.length-1]);
      rows.push({from:r.charA, to:r.charB, l1:types.map(relTypeLabel).join(', '), l2:evo.map(relTypeLabel).join(', '), c1, c2, note:(evo.length && r.evolveNote) ? r.evolveNote : ''});
    });
  } else {
    people = data.dynastyMembers.filter(m=>m.dynastyId===state.activeTreeId);
    data.dynastyMemberLinks.filter(l=>l.dynastyId===state.activeTreeId && pairHit(l.fromId, l.toId)).forEach(l=>{
      const sp = l.kind==='spouse', sb = l.kind==='sibling';
      rows.push({from:l.fromId, to:l.toId, l1: sp ? 'супруги' : sb ? 'братья / сёстры' : 'родитель', l2: (sp||sb) ? '' : 'ребёнок', c1: sp ? '#d98aa0' : sb ? '#7fb5d6' : '#c9a24c', c2: sp ? '#d98aa0' : sb ? '#7fb5d6' : '#c9a24c', note:''});
    });
  }
  if(!rows.length) return '';
  const byId = id => people.find(x=>x.id===id);
  return rows.slice(0,4).map(r=>
    `<div class="ei-row"><div class="ei-main">${edgeInfoPerson(byId(r.from))}` +
    `<span class="ei-mid"><span class="ei-lab" style="color:${r.c1}">${esc(r.l1)}</span><span class="ei-line" style="background:linear-gradient(90deg, ${r.c1}, ${r.c2})"></span>${r.l2 ? `<span class="ei-lab" style="color:${r.c2}">${esc(r.l2)}</span>` : ''}</span>` +
    `${edgeInfoPerson(byId(r.to))}</div>${r.note ? `<div class="ei-note">${esc(r.note)}</div>` : ''}</div>`
  ).join('') + (rows.length>4 ? `<div class="ei-note">и ещё ${rows.length-4}…</div>` : '');
}
function edgeInfoEl(vp){
  let el = vp.querySelector(':scope > .hex-edge-info');
  if(!el){ el = document.createElement('div'); el.className = 'hex-edge-info'; vp.appendChild(el); }
  return el;
}
function showEdgeInfo(vp, html, clientX, clientY, key){
  const el = edgeInfoEl(vp);
  if(!html){ el.classList.remove('show'); el.dataset.key = ''; return; }
  const rect = vp.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  if(el.dataset.key !== key || !el.classList.contains('show')){ el.innerHTML = html; el.dataset.key = key; }
  el.classList.add('show');
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = Math.max(6, Math.min(x - w/2, vp.clientWidth - w - 6));
  let top = y - h - 18;
  if(top < 6) top = y + 22;                      // не помещается сверху — показываем под курсором
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function hideEdgeInfo(vp){
  if(!vp) return;
  const el = vp.querySelector(':scope > .hex-edge-info');
  if(el){ el.classList.remove('show'); el.dataset.key = ''; }
}
function segDist(px, py, x1, y1, x2, y2){
  const dx = x2-x1, dy = y2-y1, L2 = dx*dx+dy*dy || 1;
  let t = ((px-x1)*dx + (py-y1)*dy)/L2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
}
// свободный режим: прямые линии между центрами карточек
function onFreeEdgeHover(kind, e){
  const vp = e.currentTarget;
  if(e.buttons || e.target.closest('.rel-node, .tree-node')){ hideEdgeInfo(vp); return; }
  const rect = vp.getBoundingClientRect();
  const view = kind==='rel' ? relCanvasView : treeCanvasView;
  const lx = (e.clientX-rect.left-view.pan.x)/view.scale, ly = (e.clientY-rect.top-view.pan.y)/view.scale;
  const thr = 8/view.scale;
  let nodes, edges, cx, cy;
  if(kind==='rel'){
    nodes = itemsOf('characters', state.activeProjectId);
    edges = itemsOf('relationships', state.activeProjectId).map(r=>({a:r.charA, b:r.charB}));
    cx = 42; cy = 26;
  } else {
    nodes = data.dynastyMembers.filter(m=>m.dynastyId===state.activeTreeId);
    edges = data.dynastyMemberLinks.filter(l=>l.dynastyId===state.activeTreeId).map(l=>({a:l.fromId, b:l.toId}));
    cx = 48; cy = 27;
  }
  const pos = {};
  nodes.forEach(n=>{ pos[n.id] = kind==='rel' ? {x:n.netX+cx, y:n.netY+cy} : {x:n.tx+cx, y:n.ty+cy}; });
  let best = null;
  edges.forEach(ed=>{
    const a = pos[ed.a], b = pos[ed.b];
    if(!a || !b) return;
    const d = segDist(lx, ly, a.x, a.y, b.x, b.y);
    if(d<=thr && (!best || d<best.d)) best = {d, ed};
  });
  if(!best){ hideEdgeInfo(vp); return; }
  const key = [best.ed.a, best.ed.b].sort().join('|');
  showEdgeInfo(vp, edgeInfoHtml(kind, best.ed.a, best.ed.b), e.clientX, e.clientY, key);
}
function attachFreeEdgeHover(kind, vp){
  vp.addEventListener('mousemove', e=>onFreeEdgeHover(kind, e));
  vp.addEventListener('mouseleave', ()=>hideEdgeInfo(vp));
  vp.addEventListener('mousedown', ()=>hideEdgeInfo(vp));
  vp.addEventListener('wheel', ()=>hideEdgeInfo(vp), {passive:true});
}

/* --- наведение на линию в сотах: всплывающая карточка «кто — какая связь — с кем» --- */
function onHexHover(kind, e){
  const c = hexCfg(kind), vp = document.getElementById(c.vp), v = c.view;
  if(!vp) return;
  if(v.routeEdit){
    hideEdgeInfo(vp);
    const r0 = vp.getBoundingClientRect();
    v.routeEdit.hover = snapToHexVertex((e.clientX-r0.left-v.pan.x)/v.scale, (e.clientY-r0.top-v.pan.y)/v.scale);
    drawHexRoutePreview(kind);
    return;
  }
  if(v.busy){ hideEdgeInfo(vp); return; }
  const rect = vp.getBoundingClientRect();
  const lx = (e.clientX-rect.left-v.pan.x)/v.scale, ly = (e.clientY-rect.top-v.pan.y)/v.scale;
  const thr = 9 / v.scale;
  let hit = null;
  (v.edgeHit || []).forEach(eh=>{
    for(let k=0; k<eh.path.length-1; k++){
      const d = segDist(lx, ly, eh.path[k].x, eh.path[k].y, eh.path[k+1].x, eh.path[k+1].y);
      if(d<=thr && (!hit || d<hit.d)) hit = {d, eh};
    }
  });
  if(hit) showEdgeInfo(vp, edgeInfoHtml(kind, hit.eh.a, hit.eh.b), e.clientX, e.clientY, [hit.eh.a, hit.eh.b].sort().join('|'));
  else hideEdgeInfo(vp);
}

/* --- свободная ячейка рядом (по возможности ниже) --- */
function findFreeHexNear(items, q, r){
  const taken = new Set(items.map(it=>it.hexQ+','+it.hexR));
  for(let k=1; k<=30; k++){
    const cand = [];
    for(let dq=-k; dq<=k; dq++){
      for(let dr=Math.max(-k,-dq-k); dr<=Math.min(k,-dq+k); dr++){
        if(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq+dr))===k) cand.push([dq,dr]);
      }
    }
    cand.sort((a,b)=> (b[1]-a[1]) || (Math.abs(a[0])-Math.abs(b[0])));
    for(const [dq,dr] of cand) if(!taken.has((q+dq)+','+(r+dr))) return {hexQ:q+dq, hexR:r+dr};
  }
  return {hexQ:q, hexR:r+1};
}

/* --- правая кнопка в сотах --- */
function setHexColor(kind, id, field, value, el){
  const it = hexCfg(kind).items().find(x=>x.id===id);
  if(!it) return;
  if(value) it[field] = value; else delete it[field];
  const prop = '--hex-ring';
  if(el){ if(value) el.style.setProperty(prop, value); else el.style.removeProperty(prop); }
  queueSave();
}

/* --- правая кнопка по линии: изменить родство / удалить линию --- */
function confirmDeleteMemberLinks(ids, text){
  askConfirm(text, 'Удалить', ()=>{
    const del = new Set(ids);
    data.dynastyMemberLinks = data.dynastyMemberLinks.filter(l=>!del.has(l.id));
    queueSave();
    refreshTreeEditor();
  });
}
function memberLinkLineMenu(e, linkIds, hexKind){
  const ids = [...new Set((linkIds||'').split(',').filter(Boolean))].filter(id=>data.dynastyMemberLinks.some(l=>l.id===id));
  if(!ids.length) return;
  const routeItems = hexKind ? hexRouteMenuItems(hexKind, ids).concat([{sep:true}]) : [];
  const pt = {clientX:e.clientX, clientY:e.clientY, preventDefault(){}, stopPropagation(){}};
  if(ids.length===1){
    const l = data.dynastyMemberLinks.find(x=>x.id===ids[0]);
    return showCtxMenu(e, [
      {heading: memberLinkDesc(l)},
      ...routeItems,
      {label:'Изменить родство…', onClick:()=>memberLinkChangeMenu(pt, ids[0])},
      {sep:true},
      {label:'Удалить линию', danger:true, onClick:()=>confirmDeleteMemberLinks(ids, 'Удалить эту линию родства?')}
    ]);
  }
  // общая линия пары родителей ведёт к ребёнку: две связи
  const items = [{heading:'Эта линия объединяет несколько связей'}, ...routeItems];
  ids.forEach(id=>{
    const l = data.dynastyMemberLinks.find(x=>x.id===id);
    items.push({label:'Удалить: '+memberLinkDesc(l), danger:true, onClick:()=>confirmDeleteMemberLinks([id], 'Удалить эту линию родства?')});
  });
  items.push({sep:true});
  items.push({label:'Удалить линию целиком', danger:true, onClick:()=>confirmDeleteMemberLinks(ids, 'Удалить все связи этой линии ('+ids.length+')?')});
  showCtxMenu(e, items);
}
// «Связи» (соты): удалить линию-связь между персонажами
function relationLineMenu(e, ids, hexKind){
  const rels = ids.map(id=>data.relationships.find(r=>r.id===id)).filter(Boolean);
  if(!rels.length) return;
  const routeItems = hexKind ? hexRouteMenuItems(hexKind, rels.map(r=>r.id)).concat([{sep:true}]) : [];
  const nm = id=>{ const c = data.characters.find(x=>x.id===id); return '«'+familyShort(c && c.name)+'»'; };
  const desc = r=>nm(r.charA)+' — '+nm(r.charB)+': '+(relTypes(r).map(relTypeLabel).join(', ') || 'связь');
  const del = (list, text)=>askConfirm(text, 'Удалить', ()=>{ const s = new Set(list); data.relationships = data.relationships.filter(r=>!s.has(r.id)); queueSave(); renderMain(); });
  if(rels.length===1) return showCtxMenu(e, [
    {heading: desc(rels[0])},
    ...routeItems,
    {label:'Изменить связь…', onClick:()=>openEditRelationshipModal(rels[0].id)},
    {sep:true},
    {label:'Удалить линию', danger:true, onClick:()=>del([rels[0].id], 'Удалить эту связь?')}
  ]);
  const items = [{heading:'Между этими персонажами несколько связей'}, ...routeItems];
  rels.forEach(r=>items.push({label:'Удалить: '+desc(r), danger:true, onClick:()=>del([r.id], 'Удалить эту связь?')}));
  items.push({sep:true});
  items.push({label:'Удалить все линии', danger:true, onClick:()=>del(rels.map(r=>r.id), 'Удалить все связи между этими персонажами ('+rels.length+')?')});
  showCtxMenu(e, items);
}
// соты: ближайшая линия под курсором (все связи этой пары)
function hexEdgesAt(kind, lx, ly){
  const v = hexCfg(kind).view, thr = 9 / v.scale;
  let best = null;
  (v.edgeHit || []).forEach(eh=>{
    for(let k=0;k<eh.path.length-1;k++){
      const d = segDist(lx, ly, eh.path[k].x, eh.path[k].y, eh.path[k+1].x, eh.path[k+1].y);
      if(d<=thr && (!best || d<best.d)) best = {d, eh};
    }
  });
  if(!best) return [];
  const a = best.eh.a, b = best.eh.b;
  return (v.edgeHit || []).filter(x=>(x.a===a && x.b===b) || (x.a===b && x.b===a)).map(x=>x.id).filter(Boolean);
}
function onHexContextMenu(kind, e){
  const c = hexCfg(kind), vp = document.getElementById(c.vp), v = c.view;
  if(!vp) return;
  const rect = vp.getBoundingClientRect();
  const lx = (e.clientX - rect.left - v.pan.x)/v.scale, ly = (e.clientY - rect.top - v.pan.y)/v.scale;
  const cell = pixelToHex(lx, ly);
  const items = c.items();
  const cardEl = e.target.closest('.hex-card');
  const it = cardEl ? items.find(x=>x.id===cardEl.dataset.id) : null;

  if(!it){
    const lineIds = hexEdgesAt(kind, lx, ly);
    if(lineIds.length) return kind==='tree' ? memberLinkLineMenu(e, lineIds.join(','), 'tree') : relationLineMenu(e, lineIds, 'rel');
  }
  const colorRows = it ? colorMenuRows(kind, it, cardEl) : [];

  if(kind==='rel'){
    if(it) return showCtxMenu(e, [
      {label:'+ Новая связь от «'+(it.name||'персонажа')+'»', onClick:()=>openNewRelationshipModal(it.id)},
      {label:'+ Новая связь', onClick:()=>openNewRelationshipModal()},
      {label:'+ Новый персонаж рядом', onClick:()=>openNewCharacterModal(findFreeHexNear(items, it.hexQ, it.hexR))},
      {sep:true},
      {label:'Изменить персонажа', onClick:()=>openEditCharacterModal(it.id)},
      ...colorRows,
      {sep:true},
      {label:'Удалить персонажа', danger:true, onClick:()=>deleteCharacter(it.id)}
    ]);
    return showCtxMenu(e, [
      {label:'+ Новый персонаж здесь', onClick:()=>openNewCharacterModal({hexQ:cell.q, hexR:cell.r})},
      {label:'+ Новая связь', onClick:()=>openNewRelationshipModal()},
    ]);
  }
  const dynastyId = state.activeTreeId;
  if(it) return showCtxMenu(e, [
    {label:'+ Добавить ребёнка (участник и связь)', onClick:()=>openNewMemberModal(dynastyId, findFreeHexNear(items, it.hexQ, it.hexR), it.id)},
    {label:'+ Добавить ребёнка', onClick:()=>openNewRelativeModal(dynastyId, it.id, 'child')},
    {label:'+ Добавить супруга / супругу', onClick:()=>openNewRelativeModal(dynastyId, it.id, 'spouse')},
    {label:'+ Добавить родителя', onClick:()=>openNewRelativeModal(dynastyId, it.id, 'parent')},
    {label:'+ Добавить брата / сестру', onClick:()=>openNewRelativeModal(dynastyId, it.id, 'sibling')},
    {label:'+ Новая связь от «'+(it.name||'участника')+'»', onClick:()=>openNewMemberLinkModal(dynastyId, it.id)},
    {label:'+ Новая связь', onClick:()=>openNewMemberLinkModal(dynastyId)},
    {label:'+ Новый участник рядом', onClick:()=>openNewMemberModal(dynastyId, findFreeHexNear(items, it.hexQ, it.hexR))},
    {sep:true},
    {label:'Изменить участника', onClick:()=>openEditMemberModal(dynastyId, it.id)},
    ...colorRows,
    {sep:true},
    {label:'Удалить персонажа', danger:true, onClick:()=>deleteMember(dynastyId, it.id)}
  ]);
  showCtxMenu(e, [
    {label:'+ Новый участник здесь', onClick:()=>openNewMemberModal(dynastyId, {hexQ:cell.q, hexR:cell.r})},
    {label:'+ Новая связь', onClick:()=>openNewMemberLinkModal(dynastyId)},
  ]);
}

/* --- мышь: панорама, перетаскивание, клик --- */
function onHexMouseDown(kind, e){
  if(e.button!==0) return;
  const c = hexCfg(kind), vp = document.getElementById(c.vp), v = c.view;
  if(!vp) return;
  if(v.routeEdit){
    // режим рисования линии: клик — точка, перетаскивание — сдвиг поля
    const sx = e.clientX, sy = e.clientY, ox = v.pan.x, oy = v.pan.y; let moved = false;
    const mv = ev=>{
      if(!moved && Math.hypot(ev.clientX-sx, ev.clientY-sy) < 4) return;
      moved = true; v.pan.x = ox + ev.clientX - sx; v.pan.y = oy + ev.clientY - sy; applyHexTransform(kind);
    };
    const up = ev=>{
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      if(moved || !v.routeEdit) return;
      const rect = vp.getBoundingClientRect();
      const pt = snapToHexVertex((ev.clientX-rect.left-v.pan.x)/v.scale, (ev.clientY-rect.top-v.pan.y)/v.scale);
      const last = v.routeEdit.pts[v.routeEdit.pts.length-1];
      if(!last || last.x!==pt.x || last.y!==pt.y) v.routeEdit.pts.push(pt);
      drawHexRoutePreview(kind);
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }
  const cardEl = e.target.closest('.hex-card');
  if(!cardEl){
    const sx = e.clientX, sy = e.clientY, ox = v.pan.x, oy = v.pan.y;
    vp.classList.add('panning'); v.busy = true;
    const mv = ev=>{ v.pan.x = ox + ev.clientX - sx; v.pan.y = oy + ev.clientY - sy; applyHexTransform(kind); };
    const up = ()=>{ document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); vp.classList.remove('panning'); v.busy = false; };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }
  e.preventDefault();
  const id = cardEl.dataset.id;
  const items = c.items();
  const item = items.find(x=>x.id===id);
  if(!item) return;
  const toLayer = (px, py)=>{ const rect = vp.getBoundingClientRect(); return { x:(px-rect.left-v.pan.x)/v.scale, y:(py-rect.top-v.pan.y)/v.scale }; };
  const c0 = axialToPixel(item.hexQ, item.hexR);
  const p0 = toLayer(e.clientX, e.clientY);
  const grab = { x: p0.x - c0.x, y: p0.y - c0.y };
  const hintSvg = document.getElementById(c.hint);
  const last = { x: e.clientX, y: e.clientY };
  const sx = e.clientX, sy = e.clientY;
  let moved = false, raf = null, hlId = null;
  v.busy = true;
  const linesSvg = document.getElementById(c.lines);

  const place = ()=>{
    const p = toLayer(last.x, last.y);
    const cx = p.x - grab.x, cy = p.y - grab.y;
    cardEl.style.left = (cx - HEX_W/2) + 'px';
    cardEl.style.top = (cy - HEX_H/2) + 'px';
    const t = pixelToHex(cx, cy), tp = axialToPixel(t.q, t.r);
    if(hintSvg) hintSvg.innerHTML = `<polygon points="${hexPts(tp.x, tp.y, HEX_SIZE)}"/>`;
    // подсвечиваем карточку, на которую «бросаем»
    const occ = items.find(o=>o!==item && o.hexQ===t.q && o.hexR===t.r);
    const occId = occ ? occ.id : null;
    if(occId!==hlId){
      const host = document.getElementById(c.cards);
      if(host){
        host.querySelectorAll('.hex-card.drop-target').forEach(el=>el.classList.remove('drop-target'));
        if(occId){ const el = host.querySelector(`.hex-card[data-id="${occId}"]`); if(el) el.classList.add('drop-target'); }
      }
      hlId = occId;
    }
  };
  const loop = ()=>{
    if(!moved){ raf = null; return; }
    const rect = vp.getBoundingClientRect();
    const px = last.x - rect.left, py = last.y - rect.top, EDGE = 80, SPEED = 10;
    let scrolled = false;
    if(px > rect.width - EDGE){ v.pan.x -= SPEED; scrolled = true; }
    else if(px < EDGE){ v.pan.x += SPEED; scrolled = true; }
    if(py > rect.height - EDGE){ v.pan.y -= SPEED; scrolled = true; }
    else if(py < EDGE){ v.pan.y += SPEED; scrolled = true; }
    if(scrolled) applyHexTransform(kind);
    place();
    raf = requestAnimationFrame(loop);
  };
  const mv = ev=>{
    last.x = ev.clientX; last.y = ev.clientY;
    if(!moved){
      if(Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      cardEl.classList.add('dragging');
      if(linesSvg) linesSvg.style.opacity = '0.15';
      raf = requestAnimationFrame(loop);
    }
    place();
  };
  const up = (ev)=>{
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    if(raf) cancelAnimationFrame(raf);
    if(hintSvg) hintSvg.innerHTML = '';
    { const h = document.getElementById(c.cards); if(h) h.querySelectorAll('.hex-card.drop-target').forEach(el=>el.classList.remove('drop-target')); }
    v.busy = false;
    if(linesSvg) linesSvg.style.opacity = '';
    if(!moved){ c.open(id); return; }
    moved = false;
    const p = toLayer(last.x, last.y);
    const t = pixelToHex(p.x - grab.x, p.y - grab.y);
    const fromQ = item.hexQ, fromR = item.hexR;
    let dropOn = null;
    if(t.q !== fromQ || t.r !== fromR){
      const other = items.find(o=>o!==item && o.hexQ===t.q && o.hexR===t.r);
      if(other){
        dropOn = other;                      // ячейка занята — создаём связь, карточка вернётся на место
      } else {
        item.hexQ = t.q; item.hexR = t.r;
        queueSave();
      }
    }
    const host = document.getElementById(c.cards);
    if(host){
      host.classList.add('snapping');
      host.querySelectorAll('.hex-card').forEach(el=>{ const it = items.find(x=>x.id===el.dataset.id); if(it) placeHexCard(el, it); });
      setTimeout(()=>host.classList.remove('snapping'), 220);
    }
    cardEl.classList.remove('dragging');
    invalidateHexGrid(kind); drawHexGrid(kind); drawHexLines(kind);
    if(dropOn) cardDropRelation(kind, item.id, dropOn.id, ev);
  };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}

/* ---------------- CONTEXT MENU (правая кнопка мыши) ---------------- */
const CTX_COLORS = [
  {v:'', n:'По умолчанию (золотой)'}, {v:'#e8e8ee', n:'Белый'}, {v:'#8a8d99', n:'Серый'}, {v:'#0c0c0f', n:'Чёрный'},
  {v:'#d9534f', n:'Красный'}, {v:'#e08a3c', n:'Оранжевый'}, {v:'#5fae6a', n:'Зелёный'}, {v:'#4bb3b3', n:'Бирюзовый'},
  {v:'#5a8fd8', n:'Синий'}, {v:'#9a6fd1', n:'Фиолетовый'}, {v:'#d86fa8', n:'Розовый'}
];
const CTX_PLUS_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>';
// выбор своего цвета через системную палитру
function pickCustomColor(current, rect, onPick){
  const inp = document.createElement('input');
  inp.type = 'color';
  inp.value = /^#[0-9a-f]{6}$/i.test(current||'') ? current : '#c9a24c';
  inp.style.cssText = `position:fixed; left:${Math.round(rect.left)}px; top:${Math.round(rect.bottom)}px; width:1px; height:1px; opacity:0; pointer-events:none;`;
  document.body.appendChild(inp);
  inp.addEventListener('change', ()=>{ onPick(inp.value); setTimeout(()=>inp.remove(), 300); });
  inp.addEventListener('cancel', ()=>setTimeout(()=>inp.remove(), 300));
  if(typeof inp.showPicker==='function'){ try{ inp.showPicker(); return; }catch(e){} }
  inp.click();
}
function closeCtxMenu(){ const m=document.getElementById('ctxMenu'); if(m) m.remove(); }
function showCtxMenu(e, items){
  e.preventDefault(); e.stopPropagation();
  closeCtxMenu();
  const menu = document.createElement('div');
  menu.id = 'ctxMenu';
  menu.innerHTML = items.map((it,i)=>{
    if(it.sep) return '<div class="ctx-sep"></div>';
    if(it.heading) return `<div class="ctx-heading">${esc(it.heading)}</div>`;
    if(it.colors) return `<div class="ctx-colors"><div class="ctx-colors-title">${esc(it.title)}</div><div class="ctx-swatches">${CTX_COLORS.map(c=>`<button type="button" class="ctx-sw${(it.value||'')===(c.v||'')?' on':''}" data-i="${i}" data-c="${c.v}" title="${esc(c.n)}" style="background:${c.v||'var(--gold)'}"></button>`).join('')}${(it.value && !CTX_COLORS.some(c=>c.v===it.value)) ? `<button type="button" class="ctx-sw on" data-i="${i}" data-c="${esc(it.value)}" title="Свой цвет" style="background:${esc(it.value)}"></button>` : ''}<button type="button" class="ctx-sw ctx-sw-add" data-i="${i}" title="Выбрать свой цвет" aria-label="Выбрать свой цвет">${CTX_PLUS_ICON}</button></div></div>`;
    return `<button type="button" class="ctx-item${it.danger?' ctx-danger':''}" data-i="${i}">${esc(it.label)}</button>`;
  }).join('');
  document.body.appendChild(menu);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - w - 4)) + 'px';
  menu.style.top  = Math.max(4, Math.min(e.clientY, window.innerHeight - h - 4)) + 'px';
  menu.addEventListener('mousedown', ev=>ev.stopPropagation());
  menu.addEventListener('contextmenu', ev=>{ ev.preventDefault(); ev.stopPropagation(); });
  menu.addEventListener('click', ev=>{
    const add = ev.target.closest('.ctx-sw-add');
    if(add){ const it = items[+add.dataset.i]; const rect = add.getBoundingClientRect(); closeCtxMenu(); if(it && it.onPick) pickCustomColor(it.value, rect, it.onPick); return; }
    const sw = ev.target.closest('.ctx-sw');
    if(sw){ const it = items[+sw.dataset.i]; closeCtxMenu(); if(it && it.onPick) it.onPick(sw.dataset.c || ''); return; }
    const b = ev.target.closest('.ctx-item'); if(!b) return;
    const it = items[+b.dataset.i]; closeCtxMenu();
    if(it && it.onClick) it.onClick();
  });
}
document.addEventListener('mousedown', e=>{ if(!e.target.closest('#ctxMenu')) closeCtxMenu(); }, true);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCtxMenu(); });
window.addEventListener('blur', closeCtxMenu);
window.addEventListener('resize', closeCtxMenu);

function createSceneLink(from, to){
  if(from===to) return;
  const exists = data.sceneLinks.find(l=>l.from===from && l.to===to && l.projectId===state.activeProjectId);
  if(exists) return;
  data.sceneLinks.push({id:uid(), projectId: state.activeProjectId, from, to});
  queueSave(); drawEdges();
}
function deleteSceneLink(id){ data.sceneLinks = data.sceneLinks.filter(l=>l.id!==id); queueSave(); drawEdges(); }

function onCanvasContextMenu(e){
  const viewport = document.getElementById('storyCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const lx = (e.clientX-rect.left-canvasView.pan.x)/canvasView.scale;
  const ly = (e.clientY-rect.top-canvasView.pan.y)/canvasView.scale;
  const nodeEl = e.target.closest('.scene-node');
  if(nodeEl){
    const id = nodeEl.dataset.id;
    const sc = data.scenes.find(x=>x.id===id);
    if(!sc) return;
    return showCtxMenu(e, [
      {label:'+ Новая сцена после этой', onClick:()=>addScene(sc.x+260, sc.y, id)},
      {label:'+ Новая сцена здесь', onClick:()=>addScene(lx-100, ly-40)},
      {sep:true},
      {label:'Изменить сцену', onClick:()=>openEditSceneModal(id)},
    ]);
  }
  showCtxMenu(e, [{label:'+ Новая сцена здесь', onClick:()=>addScene(lx-100, ly-40)}]);
}
function addScene(atX, atY, linkFromId){
  const viewport = document.getElementById('storyCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const hasPos = typeof atX==='number' && typeof atY==='number';
  const localX = hasPos ? atX : (rect.width/2 - canvasView.pan.x)/canvasView.scale - 100;
  const localY = hasPos ? atY : (rect.height/2 - canvasView.pan.y)/canvasView.scale - 40;
  const newScene = {id:uid(), projectId: state.activeProjectId, title:'Новая сцена', summary:'', status:'idea', x: Math.max(0,Math.round(localX)), y: Math.max(0,Math.round(localY)), charIds:[]};
  data.scenes.push(newScene);
  if(typeof linkFromId==='string') data.sceneLinks.push({id:uid(), projectId: state.activeProjectId, from: linkFromId, to: newScene.id});
  queueSave();
  renderStructure(document.getElementById('tabContent'), state.activeProjectId);
}
function deleteScene(id){
  data.scenes = data.scenes.filter(s=>s.id!==id);
  data.sceneLinks = data.sceneLinks.filter(l=>l.from!==id && l.to!==id);
  queueSave();
  renderStructure(document.getElementById('tabContent'), state.activeProjectId);
}
function openEditSceneModal(id){
  const s = data.scenes.find(x=>x.id===id);
  const fields = [
    {key:'title', label:'Название сцены', type:'text', required:true},
    {key:'status', label:'Статус', type:'select', options:[['idea','Идея'],['draft','Черновик'],['final','Готово']]},
    {key:'charIds', label:'Участники', type:'multiselect', options: itemsOf('characters', state.activeProjectId).map(c=>[c.id,c.name])},
    {key:'summary', label:'Краткое содержание сцены', type:'textarea'},
  ];
  openFormModal('Сцена', fields, s, (vals)=>{
    Object.assign(s, vals);
    queueSave(); closeModal();
    renderStructure(document.getElementById('tabContent'), state.activeProjectId);
  });
}

/* ---------------- WORLD ---------------- */
function locCard(l){
  const avatar = l.photo
    ? `<img class="d-avatar" src="${l.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(l.name))}</div>`;
  return `<div class="dossier" data-id="${l.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3 style="font-size:15.5px;">${esc(l.name)}</h3>
          ${l.faction ? `<div class="d-role">${esc(l.faction)}</div>` : ''}
        </div>
      </div>
    </div>
    ${collapsibleBlock('loc-desc-'+l.id, 'Описание', l.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('locations','${l.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('locations','${l.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditLocationModal('${l.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteLocation('${l.id}')">Удалить</button>
    </div>
  </div>`;
}
function facCard(f){
  const avatar = f.photo
    ? `<img class="d-avatar" src="${f.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(f.name))}</div>`;
  return `<div class="dossier" data-id="${f.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;"><h3 style="font-size:15.5px;">${esc(f.name)}</h3></div>
      </div>
    </div>
    ${collapsibleBlock('fac-desc-'+f.id, 'Описание', f.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('factions','${f.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('factions','${f.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditFactionModal('${f.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteFaction('${f.id}')">Удалить</button>
    </div>
  </div>`;
}
function creatureCard(c){
  const avatar = c.photo
    ? `<img class="d-avatar" src="${c.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(c.name))}</div>`;
  return `<div class="dossier" data-id="${c.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;"><h3 style="font-size:15.5px;">${esc(c.name)}</h3></div>
      </div>
    </div>
    ${collapsibleBlock('creature-desc-'+c.id, 'Описание, повадки, слабости', c.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('creatures','${c.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('creatures','${c.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditCreatureModal('${c.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteCreature('${c.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewCreatureModal(){
  openFormModal('Новое существо', creatureFields(), {}, (vals)=>{ data.creatures.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('creatures', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditCreatureModal(id){
  const c = data.creatures.find(x=>x.id===id);
  openFormModal('Изменить существо', creatureFields(), c, (vals)=>{ Object.assign(c, vals); queueSave(); closeModal(); renderMain(); });
}
function deleteCreature(id){ data.creatures = data.creatures.filter(c=>c.id!==id); queueSave(); renderMain(); }
function creatureFields(){
  return [
    {key:'name', label:'Название монстра / существа', type:'text', required:true},
    {key:'photo', label:'Изображение', type:'image'},
    {key:'desc', label:'Описание, повадки, слабости', type:'textarea'},
  ];
}
function collapsibleBlock(id, label, text){
  if(!text) return '';
  return `<div class="tl-collapsible" id="${id}">
    <div class="tl-collapsible-label">${esc(label)}</div>
    <div class="tl-collapsible-text">${esc(text)}</div>
    <button class="tl-collapsible-toggle" onclick="event.stopPropagation(); toggleCollapsible('${id}')">Показать полностью</button>
  </div>`;
}
function toggleCollapsible(id){
  const el = document.getElementById(id);
  if(!el) return;
  const expanded = el.classList.toggle('expanded');
  const btn = el.querySelector('.tl-collapsible-toggle');
  if(btn) btn.textContent = expanded ? 'Свернуть' : 'Показать полностью';
}
function mythCard(m){
  return `<div class="dossier" data-id="${m.id}">
    <h3 style="font-size:15.5px;">${esc(m.name)}</h3>
    ${m.origin ? `<div class="d-role">${esc(m.origin)}</div>` : ''}
    ${collapsibleBlock('myth-desc-'+m.id, 'Пересказ легенды', m.desc)}
    ${collapsibleBlock('myth-truth-'+m.id, 'Правда за легендой', m.truth)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('myths','${m.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('myths','${m.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditMythModal('${m.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMyth('${m.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewMythModal(){
  openFormModal('Новый миф или легенда', mythFields(), {}, (vals)=>{ data.myths.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('myths', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditMythModal(id){
  const m = data.myths.find(x=>x.id===id);
  openFormModal('Изменить миф или легенду', mythFields(), m, (vals)=>{ Object.assign(m, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить', onClick: ()=>{ closeModal(); deleteMyth(id); } });
}
function deleteMyth(id){ data.myths = data.myths.filter(m=>m.id!==id); queueSave(); renderMain(); }
function mythFields(){
  return [
    {key:'name', label:'Название мифа / легенды', type:'text', required:true},
    {key:'origin', label:'Кто рассказывает / откуда пошла', type:'text', placeholder:'народное предание, культ, придворные летописи…'},
    {key:'desc', label:'Пересказ легенды', type:'textarea'},
    {key:'truth', label:'Что из этого правда на самом деле (необязательно)', type:'textarea'},
  ];
}
function magicCard(m){
  return `<div class="dossier" data-id="${m.id}">
    <h3 style="font-size:15.5px;">${esc(m.name)}</h3>
    ${m.source ? `<div class="d-role">${esc(m.source)}</div>` : ''}
    ${collapsibleBlock('magic-desc-'+m.id, 'Как это работает', m.desc)}
    ${collapsibleBlock('magic-limits-'+m.id, 'Цена / ограничения', m.limits)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('magicSystems','${m.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('magicSystems','${m.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditMagicModal('${m.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMagic('${m.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewMagicModal(){
  openFormModal('Новая магическая система / правило', magicFields(), {}, (vals)=>{ data.magicSystems.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('magicSystems', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditMagicModal(id){
  const m = data.magicSystems.find(x=>x.id===id);
  openFormModal('Изменить магическую систему / правило', magicFields(), m, (vals)=>{ Object.assign(m, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить', onClick: ()=>{ closeModal(); deleteMagic(id); } });
}
function deleteMagic(id){ data.magicSystems = data.magicSystems.filter(m=>m.id!==id); queueSave(); renderMain(); }
function magicFields(){
  return [
    {key:'name', label:'Название системы / правила', type:'text', required:true},
    {key:'source', label:'Источник силы', type:'text', placeholder:'кровь, звёзды, духи, технологии…'},
    {key:'desc', label:'Как это работает', type:'textarea'},
    {key:'limits', label:'Цена, ограничения, правила и исключения', type:'textarea'},
  ];
}
function artifactCard(a){
  const avatar = a.photo
    ? `<img class="d-avatar" src="${a.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(a.name))}</div>`;
  return `<div class="dossier" data-id="${a.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3 style="font-size:15.5px;">${esc(a.name)}</h3>
          ${a.owner ? `<div class="d-role">Владелец: ${esc(a.owner)}</div>` : ''}
        </div>
      </div>
    </div>
    ${collapsibleBlock('artifact-powers-'+a.id, 'Свойства и способности', a.powers)}
    ${collapsibleBlock('artifact-origin-'+a.id, 'Происхождение и история', a.origin)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('artifacts','${a.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('artifacts','${a.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditArtifactModal('${a.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteArtifact('${a.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewArtifactModal(){
  openFormModal('Новый артефакт / реликвия', artifactFields(), {}, (vals)=>{ data.artifacts.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('artifacts', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditArtifactModal(id){
  const a = data.artifacts.find(x=>x.id===id);
  openFormModal('Изменить артефакт / реликвию', artifactFields(), a, (vals)=>{ Object.assign(a, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить', onClick: ()=>{ closeModal(); deleteArtifact(id); } });
}
function deleteArtifact(id){ data.artifacts = data.artifacts.filter(a=>a.id!==id); queueSave(); renderMain(); }
function artifactFields(){
  return [
    {key:'name', label:'Название артефакта / реликвии', type:'text', required:true},
    {key:'photo', label:'Изображение', type:'image'},
    {key:'owner', label:'Текущий владелец / местонахождение', type:'text', placeholder:'кто владеет, где хранится, или "утерян"…'},
    {key:'powers', label:'Свойства и способности', type:'textarea'},
    {key:'origin', label:'Происхождение и история', type:'textarea'},
  ];
}
function deityCard(d){
  const avatar = d.photo
    ? `<img class="d-avatar" src="${d.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(d.name))}</div>`;
  return `<div class="dossier" data-id="${d.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3 style="font-size:15.5px;">${esc(d.name)}</h3>
          ${d.domain ? `<div class="d-role">${esc(d.domain)}</div>` : ''}
        </div>
      </div>
    </div>
    ${collapsibleBlock('deity-desc-'+d.id, 'Описание, история, обряды', d.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('deities','${d.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('deities','${d.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditDeityModal('${d.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteDeity('${d.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewDeityModal(){
  openFormModal('Новое божество / культ', deityFields(), {}, (vals)=>{ data.deities.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('deities', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditDeityModal(id){
  const d = data.deities.find(x=>x.id===id);
  openFormModal('Изменить божество / культ', deityFields(), d, (vals)=>{ Object.assign(d, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить', onClick: ()=>{ closeModal(); deleteDeity(id); } });
}
function deleteDeity(id){ data.deities = data.deities.filter(d=>d.id!==id); queueSave(); renderMain(); }
function deityFields(){
  return [
    {key:'name', label:'Имя божества / название культа', type:'text', required:true},
    {key:'photo', label:'Изображение', type:'image'},
    {key:'domain', label:'Сфера покровительства', type:'text', placeholder:'война, урожай, смерть, ремёсла…'},
    {key:'desc', label:'Описание, история, обряды, последователи', type:'textarea'},
  ];
}
function countryCard(c){
  const avatar = c.photo
    ? `<img class="d-avatar" src="${c.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(c.name))}</div>`;
  return `<div class="dossier" data-id="${c.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3 style="font-size:15.5px;">${esc(c.name)}</h3>
          ${c.capital ? `<div class="d-role">Столица: ${esc(c.capital)}</div>` : ''}
        </div>
      </div>
    </div>
    ${c.ruler ? `<div class="d-alias">Правитель: ${esc(c.ruler)}</div>` : ''}
    ${collapsibleBlock('country-desc-'+c.id, 'Описание, территория, устройство', c.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('countries','${c.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('countries','${c.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditCountryModal('${c.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteCountry('${c.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewCountryModal(){
  openFormModal('Новая страна', countryFields(), {}, (vals)=>{ data.countries.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('countries', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditCountryModal(id){
  const c = data.countries.find(x=>x.id===id);
  openFormModal('Изменить страну', countryFields(), c, (vals)=>{ Object.assign(c, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить страну', onClick: ()=>{ closeModal(); deleteCountry(id); } });
}
function deleteCountry(id){ data.countries = data.countries.filter(c=>c.id!==id); queueSave(); renderMain(); }
function countryFields(){
  return [
    {key:'name', label:'Название страны', type:'text', required:true},
    {key:'photo', label:'Флаг / герб', type:'image'},
    {key:'capital', label:'Столица', type:'text'},
    {key:'ruler', label:'Правитель / форма правления', type:'text', placeholder:'король Эдрик III, республика, совет старейшин…'},
    {key:'desc', label:'Территория, устройство, история', type:'textarea'},
  ];
}
function dynastyCard(d){
  const avatar = d.photo
    ? `<img class="d-avatar" src="${d.photo}" alt="">`
    : `<div class="d-avatar d-avatar-placeholder">${esc(initials(d.name))}</div>`;
  const memberCount = data.dynastyMembers.filter(m=>m.dynastyId===d.id).length;
  const treeBtnLabel = memberCount ? 'Открыть древо' : 'Добавить древо';
  return `<div class="dossier" data-id="${d.id}">
    <div class="d-top">
      <div style="display:flex; gap:10px; align-items:flex-start; min-width:0;">
        ${avatar}
        <div style="min-width:0;">
          <h3 style="font-size:15.5px;">${esc(d.name)}</h3>
          ${d.country ? `<div class="d-role">${esc(d.country)}</div>` : ''}
        </div>
      </div>
      <button class="tree-add-btn" onclick="event.stopPropagation(); openTreeEditor('${d.id}')" title="${esc(treeBtnLabel)}">
        <span class="tree-add-icon"><svg viewBox="0 0 60 60" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="30" cy="10" r="9"/><circle cx="30" cy="7.4" r="2.7" fill="currentColor" stroke="none"/><path d="M24.4 16.2a5.6 5.2 0 0 1 11.2 0Z" fill="currentColor" stroke="none"/><circle cx="10" cy="50" r="9"/><circle cx="10" cy="47.4" r="2.7" fill="currentColor" stroke="none"/><path d="M4.4 56.2a5.6 5.2 0 0 1 11.2 0Z" fill="currentColor" stroke="none"/><circle cx="50" cy="50" r="9"/><circle cx="50" cy="47.4" r="2.7" fill="currentColor" stroke="none"/><path d="M44.4 56.2a5.6 5.2 0 0 1 11.2 0Z" fill="currentColor" stroke="none"/><path d="M30 19v11M10 41V30h40v11"/></svg></span>
        <span class="tree-add-label">${esc(treeBtnLabel)}</span>
      </button>
    </div>
    ${d.founder ? `<div class="d-alias">Основатель: ${esc(d.founder)}</div>` : ''}
    ${collapsibleBlock('dynasty-desc-'+d.id, 'История рода', d.desc)}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openReadModal('dynasties','${d.id}')">${btnIconSvg('book')}Читать</button>
      <button class="btn btn-ghost btn-sm" onclick="copyEntityToClipboard('dynasties','${d.id}')">${btnIconSvg('copy')}Копировать</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditDynastyModal('${d.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteDynasty('${d.id}')">Удалить</button>
    </div>
  </div>`;
}
function openNewDynastyModal(){
  openFormModal('Новая династия', dynastyFields(), {}, (vals)=>{ data.dynasties.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('dynasties', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditDynastyModal(id){
  const d = data.dynasties.find(x=>x.id===id);
  openFormModal('Изменить династию', dynastyFields(), d, (vals)=>{ Object.assign(d, vals); queueSave(); closeModal(); renderMain(); },
    { label:'Удалить династию', onClick: ()=>{ closeModal(); deleteDynasty(id); } });
}
function deleteDynasty(id){
  data.dynasties = data.dynasties.filter(d=>d.id!==id);
  data.dynastyMembers = data.dynastyMembers.filter(m=>m.dynastyId!==id);
  data.dynastyMemberLinks = data.dynastyMemberLinks.filter(l=>l.dynastyId!==id);
  if(state.activeTreeId===id) state.activeTreeId = null;
  queueSave(); renderMain();
}
function dynastyFields(){
  return [
    {key:'name', label:'Название династии / рода', type:'text', required:true},
    {key:'photo', label:'Герб рода', type:'image'},
    {key:'country', label:'Страна / престол', type:'text', placeholder:'к какой стране относится'},
    {key:'founder', label:'Основатель рода', type:'text'},
    {key:'desc', label:'История, наследование, известные представители', type:'textarea'},
  ];
}

/* ---------------- DYNASTY GENEALOGY TREE ---------------- */
let treeCanvasView = { pan:{x:220,y:90}, scale:1 };
let treeSelected = null;

function openTreeEditor(id){
  state.activeTreeId = id;
  renderMain();
}
function closeTreeEditor(){
  state.activeTreeId = null;
  renderMain();
}
function refreshTreeEditor(){
  const el = document.getElementById('tabContent');
  if(!el) return;
  const d = data.dynasties.find(x=>x.id===state.activeTreeId);
  if(d) renderTreeEditor(el, d); else renderMain();
}

function ensureTreePositions(members){
  let changed = false;
  const cx=260, cy=200, R=150;
  members.forEach((m,i)=>{
    if(m.tx===undefined || m.ty===undefined){
      const angle = (i/Math.max(1,members.length))*Math.PI*2 - Math.PI/2;
      m.tx = Math.round(cx + R*Math.cos(angle) - 48);
      m.ty = Math.round(cy + R*Math.sin(angle) - 27);
      changed = true;
    }
  });
  if(changed) queueSave();
}

function renderTreeEditor(el, dynasty){
  const members = data.dynastyMembers.filter(m=>m.dynastyId===dynasty.id);
  const links = data.dynastyMemberLinks.filter(l=>l.dynastyId===dynasty.id);
  const hexMode = state.viewModeDynasty==='hex';
  const famMode = state.viewModeDynasty==='family';
  if(!hexMode && !famMode) ensureTreePositions(members);
  el.innerHTML = `
    <div class="canvas-toolbar">
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        <button class="btn btn-sm" onclick="closeTreeEditor()">← Назад к династиям</button>
        <h3 style="margin:0; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Древо: ${esc(dynasty.name)}</h3>
      </div>
      <div class="board-actions">
        ${histBtnsHtml('tree')}
        <div class="canvas-zoom-controls">
          <button class="btn btn-sm" onclick="zoomTreeCanvas(-0.15)">−</button>
          <span class="mono" id="treeZoomLabel" style="font-size:12px; color:var(--text-faint); min-width:42px; text-align:center; display:inline-block;">100%</span>
          <button class="btn btn-sm" onclick="zoomTreeCanvas(0.15)">+</button>
        </div>
        ${viewSwitchHtml('dynasty')}
        <button class="btn btn-sm" onclick="resetTreeCanvasView()">Центрировать</button>
        <button class="btn btn-sm hist-btn" onclick="toggleBoardFs('tree')" title="Во весь экран" aria-label="Во весь экран">${BOARD_FS_ICON}</button>
        <button class="btn btn-sm" onclick="openNewMemberLinkModal('${dynasty.id}')">+ Связь</button>
        <button class="btn btn-primary btn-sm" onclick="openNewMemberModal('${dynasty.id}')">+ Участник</button>
      </div>
    </div>
    <div class="eyebrow" style="margin-bottom:10px;">${famMode ? 'Перетащите один круг на другой — и выберите, кем они приходятся друг другу: круги сами встанут на место. Клик по кругу — подсветить родню, клик по линии — изменить родство, двойной клик по кругу — редактировать, правая кнопка — меню.' : hexMode ? 'Тащите карточки по сотам — при отпускании они прилипают к ближайшей ячейке. Бросьте карточку на другую — выберите, кем они приходятся друг другу, и карточка вернётся на место. Клик по карточке — редактировать.' : 'Тащите карточки, чтобы расставить как хотите. Бросьте карточку точно в центр другой — выберите, кем они приходятся друг другу. Или тяните от золотой точки родителя к ребёнку — так рождается связь. Двойной клик по карточке — редактировать.'}</div>
    ${members.length===0 ? `<div class="empty-tab" style="margin-bottom:14px;">Пусто. Добавьте первого члена рода.</div>` : ''}
    ${famMode ? familyBoardHtml(members, links) : hexMode ? hexBoardHtml('tree') : `<div id="treeCanvasViewport">
      <div id="treeCanvasInner">
        <svg id="treeEdgesSvg" width="4000" height="3000"></svg>
        ${members.map(treeNodeHtml).join('')}
      </div>
    </div>`}
    <div class="side-section-label" style="margin:26px 0 10px;">Родственные связи</div>
    <div class="grid">${links.length ? links.map(l=>treeLinkCard(l, members)).join('') : '<div class="empty-tab">Связей пока нет.</div>'}</div>
  `;
  if(famMode){ initFamilyBoard(); setupBoardFs('tree'); return; }
  if(hexMode){ initHexBoard('tree'); setupBoardFs('tree'); return; }
  applyTreeCanvasTransform();
  drawTreeEdges();
  attachTreeCanvasEvents();
  setupBoardFs('tree');
}

/* ---------------- РЕЖИМ «ДРЕВО»: круги сами встают по родственным связям ---------------- */
const FAM = { SLOT:150, ROW:200, R:32, PAD:70, LBL:44 };   // LBL — высота подписи под кругом
const familyView = { pan:{x:0,y:0}, scale:1, fitFor:null, n:0, needFit:true, W:800, H:400 };
let familySel = null;

function familyYear(m){ const x = /-?\d{1,5}/.exec((m && m.birth) || ''); return x ? parseInt(x[0], 10) : null; }

// Раскладка: супруги образуют «блок», блок ставится по центру над своими детьми,
// родители — на ряд ниже детей (древо растёт снизу вверх). Позиции не хранятся — считаются заново при каждой отрисовке.
function familyLayout(members, links){
  const { SLOT, ROW, R } = FAM;
  const byId = {}, ord = {};
  members.forEach((m,i)=>{ byId[m.id] = m; ord[m.id] = i; });
  const ok = l => ord[l.fromId]!==undefined && ord[l.toId]!==undefined && l.fromId!==l.toId;
  const spouseLinks = links.filter(l=>ok(l) && l.kind==='spouse');
  const parentLinks = links.filter(l=>ok(l) && l.kind!=='spouse' && l.kind!=='sibling');
  const sibLinks = links.filter(l=>ok(l) && l.kind==='sibling');

  // 1. блоки супругов (union-find по связям «супруги»)
  const uf = {}; members.forEach(m=>{ uf[m.id] = m.id; });
  const find = x=>{ while(uf[x]!==x){ uf[x] = uf[uf[x]]; x = uf[x]; } return x; };
  spouseLinks.forEach(l=>{ uf[find(l.fromId)] = find(l.toId); });
  const groups = {};
  members.forEach(m=>{ const r = find(m.id); (groups[r] = groups[r] || []).push(m.id); });
  const adj = {}; members.forEach(m=>{ adj[m.id] = []; });
  spouseLinks.forEach(l=>{
    if(!adj[l.fromId].includes(l.toId)) adj[l.fromId].push(l.toId);
    if(!adj[l.toId].includes(l.fromId)) adj[l.toId].push(l.fromId);
  });
  const hasParent = new Set(parentLinks.map(l=>l.toId));

  const units = [], unitOf = {};
  Object.values(groups).sort((a,b)=>Math.min(...a.map(i=>ord[i])) - Math.min(...b.map(i=>ord[i]))).forEach(ids=>{
    ids.sort((a,b)=>ord[a]-ord[b]);
    // порядок внутри блока: «кровный» родственник (у кого есть родители) — в центре, супруги по сторонам
    const start = ids.find(i=>hasParent.has(i)) || ids[0];
    const arr = [start], seen = new Set([start]), sideOf = {}, queue = [start];
    while(queue.length){
      const n = queue.shift(); let k = 0;
      adj[n].slice().sort((a,b)=>ord[a]-ord[b]).forEach(nb=>{
        if(seen.has(nb)) return;
        seen.add(nb);
        const side = n===start ? (k%2===0 ? 'R' : 'L') : sideOf[n];
        k++; sideOf[nb] = side;
        if(side==='L') arr.unshift(nb); else arr.push(nb);
        queue.push(nb);
      });
    }
    const u = { idx:units.length, ids:arr, start, parent:null, kids:[], ord:ord[ids[0]], depth:0 };
    units.push(u); arr.forEach(i=>{ unitOf[i] = u; });
  });

  // 2. родитель блока — блок первого найденного родителя; остальные связи рисуются линиями
  parentLinks.forEach(l=>{
    const u = unitOf[l.toId], p = unitOf[l.fromId];
    if(!u.parent && p!==u) u.parent = p;
  });
  // братья и сёстры без родителей в древе: ставим в один ряд под «невидимым» общим родителем
  {
    const real = units.slice(), up = {};
    real.forEach(u=>{ up[u.idx] = u.idx; });
    const f2 = x=>{ while(up[x]!==x){ up[x] = up[up[x]]; x = up[x]; } return x; };
    sibLinks.forEach(l=>{
      const a = unitOf[l.fromId], b = unitOf[l.toId];
      if(a!==b && !a.parent && !b.parent) up[f2(a.idx)] = f2(b.idx);
    });
    const comps = {};
    real.forEach(u=>{ if(!u.parent){ (comps[f2(u.idx)] = comps[f2(u.idx)] || []).push(u); } });
    Object.values(comps).forEach(list=>{
      if(list.length<2) return;
      const v = { idx:units.length, ids:[], parent:null, kids:[], ord:Math.min(...list.map(u=>u.ord)), depth:0, virtual:true };
      units.push(v);
      list.forEach(u=>{ u.parent = v; });
    });
  }
  units.forEach(u=>{ if(u.parent) u.parent.kids.push(u); });
  const unitYear = u=>{
    const ys = u.ids.filter(i=>hasParent.has(i)).map(i=>familyYear(byId[i])).filter(y=>y!==null);
    return ys.length ? Math.min(...ys) : null;
  };
  units.forEach(u=>{
    if(u.kids.length<2) return;
    // дети слева направо — по году рождения, если он указан у всех, иначе в порядке добавления
    if(u.kids.every(k=>unitYear(k)!==null)) u.kids.sort((a,b)=>unitYear(a)-unitYear(b));
    else u.kids.sort((a,b)=>a.ord-b.ord);
  });
  // в блоке из нескольких супругов дети встают рядом с тем родителем (или парой), от которого они
  units.forEach(u=>{
    if(u.kids.length<2 || u.ids.length<2) return;
    const idx = {}; u.ids.forEach((id,i)=>{ idx[id] = i; });
    const gpos = k=>{
      const ps = [];
      k.ids.forEach(cid=>parentLinks.forEach(l=>{ if(l.toId===cid && idx[l.fromId]!==undefined) ps.push(idx[l.fromId]); }));
      return ps.length ? ps.reduce((a,b)=>a+b,0)/ps.length : 1e9;
    };
    u.kids.sort((a,b)=>gpos(a)-gpos(b));      // сортировка устойчивая: внутри группы остаётся порядок по годам
  });

  // 3. корни и защита от циклов
  const visited = new Set(), roots = [];
  const visit = (u, d)=>{ u.depth = d; visited.add(u); u.kids.forEach(k=>visit(k, d + (u.ids.length ? 1 : 0))); };
  units.filter(u=>!u.parent).forEach(u=>{ roots.push(u); visit(u, 0); });
  units.forEach(u=>{
    if(visited.has(u)) return;
    if(u.parent){ u.parent.kids = u.parent.kids.filter(k=>k!==u); u.parent = null; }
    roots.push(u); visit(u, 0);
  });

  // 4. позиции. «Ствол»: ребёнок, у которого есть продолжение рода (наследник), ставится строго над
  // тем из родителей, через кого идёт линия, — от отца к сыну вертикально. Остальные дети
  // (дяди, тёти) смещаются в стороны: старшие левее, младшие правее.
  // Если ни у кого из детей нет потомков — дети просто центрируются под родителями.
  const height = u=> u._h!==undefined ? u._h : (u._h = u.kids.reduce((a,k)=>Math.max(a, 1+height(k)), 0));
  const offOf = u=> u.ids.length ? (Math.max(0, u.ids.indexOf(u.start)) - (u.ids.length-1)/2)*SLOT : 0;   // смещение «ствола» от центра блока
  const ext = u=>{            // сколько места занимает ветка слева (l) и справа (r) от «ствола» блока
    if(u._e) return u._e;
    const n = u.ids.length, off = offOf(u);
    const bl = n ? off + n*SLOT/2 : 0, br = n ? -off + n*SLOT/2 : 0;
    const kids = u.kids; u._rel = new Map();
    let hi = -1, best = 0;
    kids.forEach((k,i)=>{ const h = height(k); if(h>best){ best = h; hi = i; } });
    if(hi<0 && kids.length===1) hi = 0;                 // единственный ребёнок продолжает «ствол»
    let lo, hiX;
    if(hi>=0){
      const H = ext(kids[hi]); u._rel.set(kids[hi], 0);
      let lb = -H.l, rb = H.r;
      for(let i=hi-1; i>=0; i--){ const e = ext(kids[i]), r = lb - e.r; u._rel.set(kids[i], r); lb = r - e.l; }
      for(let i=hi+1; i<kids.length; i++){ const e = ext(kids[i]), r = rb + e.l; u._rel.set(kids[i], r); rb = r + e.r; }
      lo = lb; hiX = rb;
    } else {
      const tot = kids.reduce((a,k)=>{ const e = ext(k); return a + e.l + e.r; }, 0);
      let cur = -off - tot/2; lo = cur; hiX = cur + tot;
      kids.forEach(k=>{ const e = ext(k); u._rel.set(k, cur + e.l); cur += e.l + e.r; });
    }
    return u._e = { l:Math.max(bl, kids.length ? -lo : 0), r:Math.max(br, kids.length ? hiX : 0) };
  };
  const level = {}, pos = {}; let maxDepth = 0;
  const place = (u, ax)=>{
    const n = u.ids.length, cx = ax - offOf(u);
    maxDepth = Math.max(maxDepth, u.depth);
    u.ids.forEach((id,i)=>{ pos[id] = { x: cx - (n-1)*SLOT/2 + i*SLOT, y: u.depth }; });
    // у каждого из супругов своя «шина» к детям; крайние — ближе к кругам, средние — выше
    u.ids.map((id,i)=>i).sort((a,b)=>Math.abs(b-(n-1)/2)-Math.abs(a-(n-1)/2) || a-b).forEach((i,rank)=>{ level[u.ids[i]] = rank; });
    ext(u); u.kids.forEach(k=>place(k, ax + u._rel.get(k)));
  };
  let x = 0;
  roots.forEach(r=>{ const e = ext(r); place(r, x + e.l); x += e.l + e.r; });
  // снизу вверх: самые старшие — в нижнем ряду, потомки выше
  Object.values(pos).forEach(p=>{ p.y = R + (maxDepth - p.y)*ROW; });
  return { pos, level, W:x, H:R*2 + maxDepth*ROW + FAM.LBL + 12 };
}

// цвет линии = цвет обрамления родителя; слишком тёмные (например, чёрный у умерших) заменяем на светло-серый,
// иначе линия сливается с тёмным фоном
function familyLineColor(c){
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
  if(!m) return c;
  let h = m[1]; if(h.length===3) h = h.split('').map(x=>x+x).join('');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (0.299*r + 0.587*g + 0.114*b) < 70 ? '#9aa0b4' : c;
}

function familyEdgesSvg(L, members, links){
  const { R, PAD:P, SLOT } = FAM;
  const pos = {};
  members.forEach(m=>{ const p = L.pos[m.id]; if(p) pos[m.id] = { x:p.x+P, y:p.y+P }; });
  const valid = l => pos[l.fromId] && pos[l.toId] && l.fromId!==l.toId;
  const near = new Set();      // супруги, стоящие рядом в одном ряду
  let out = '';
  const hit = (d, ids)=> ids.filter(Boolean).length ? `<path class="fam-hit" data-links="${ids.filter(Boolean).join(',')}" d="${d}"/>` : '';
  const plainLinkId = (f, t)=>{ const l = links.find(x=>x.fromId===f && x.toId===t && x.kind!=='spouse' && x.kind!=='sibling'); return l ? l.id : ''; };
  links.filter(l=>valid(l) && l.kind==='spouse').forEach(l=>{
    const a = pos[l.fromId], b = pos[l.toId];
    const [p1, p2] = a.x<=b.x ? [a, b] : [b, a];
    const ids = l.fromId+','+l.toId;
    if(Math.abs(a.y-b.y)<1 && p2.x-p1.x < SLOT*1.01){
      near.add(l.fromId+'|'+l.toId); near.add(l.toId+'|'+l.fromId);
      out += `<path class="fam-edge fam-spouse" data-ids="${ids}" d="M${p1.x+R},${p1.y} H${p2.x-R}"/>` + hit(`M${p1.x+R},${p1.y} H${p2.x-R}`, [l.id]);
      out += `<circle class="fam-edge fam-knot" data-ids="${ids}" cx="${(p1.x+p2.x)/2}" cy="${p1.y}" r="4.5"/>`;
    } else {
      const y1 = a.y+R, y2 = b.y+R;
      const dd = `M${a.x},${y1} C${a.x},${y1+70} ${b.x},${y2+70} ${b.x},${y2}`;
      out += `<path class="fam-edge fam-spouse fam-far" data-ids="${ids}" d="${dd}"/>` + hit(dd, [l.id]);
    }
  });
  // у каждого родителя — своя линия к ребёнку (от отца отдельно, от матери отдельно);
  // цвет линии = цвет обрамления родителя. Линии идут снизу вверх: из верха круга родителя
  // к низу подписи ребёнка.
  const memberById = {}; members.forEach(m=>{ memberById[m.id] = m; });
  const byChild = {};
  links.filter(l=>valid(l) && l.kind!=='spouse' && l.kind!=='sibling').forEach(l=>{ (byChild[l.toId] = byChild[l.toId] || []).push(l.fromId); });
  Object.keys(byChild).forEach(cid=>{
    const c = pos[cid], cm = memberById[cid];
    const ps = [...new Set(byChild[cid])].sort((p,q)=>pos[p].x-pos[q].x);
    const ty = c.y + R + (cm && (cm.birth || cm.death) ? FAM.LBL : FAM.LBL - 16) + 4;
    ps.forEach((a, i)=>{
      const pa = pos[a], pm = memberById[a];
      const ptop = pa.y - R;
      const cx = c.x + (i - (ps.length-1)/2)*9;          // две линии входят в ребёнка рядом, не сливаясь
      const busY = ptop - 16 - (L.level[a] || 0)*9;
      const lc = pm && pm.hexBorder ? familyLineColor(pm.hexBorder) : '';
      const col = lc ? ` style=\"stroke:${esc(lc)}\"` : '';
      const ids = a+','+cid;
      let d, far = false;
      if(ty + 10 < busY){
        d = Math.abs(cx-pa.x)<1 ? `M${pa.x},${ptop} V${ty}` : `M${pa.x},${ptop} V${busY} H${cx} V${ty}`;
      } else {
        far = true;
        d = ty < ptop-20 ? `M${pa.x},${ptop} C${pa.x},${ptop-70} ${cx},${ty+70} ${cx},${ty}` : `M${pa.x},${ptop} L${cx},${ty}`;
      }
      out += `<path class=\"fam-edge fam-parent${far?' fam-far':''}\" data-ids=\"${ids}\"${col} d=\"${d}\"/>` + hit(d, [plainLinkId(a, cid)]);
    });
  });
  // братья и сёстры без общих родителей в древе — скобка над их кругами
  const sibLinks = links.filter(l=>valid(l) && l.kind==='sibling');
  if(sibLinks.length){
    const adj = {};
    sibLinks.forEach(l=>{ (adj[l.fromId] = adj[l.fromId] || []).push(l.toId); (adj[l.toId] = adj[l.toId] || []).push(l.fromId); });
    const seen = new Set();
    Object.keys(adj).forEach(start=>{
      if(seen.has(start)) return;
      const comp = [], q = [start]; seen.add(start);
      while(q.length){ const n = q.shift(); comp.push(n); adj[n].forEach(x=>{ if(!seen.has(x)){ seen.add(x); q.push(x); } }); }
      const ids = comp.join(',');
      const ys = new Set(comp.map(i=>Math.round(pos[i].y)));
      if(ys.size===1){
        const xs = comp.map(i=>pos[i].x), y = pos[comp[0]].y + R + FAM.LBL + 4;
        const bus = y + 22;
        const sl = sibLinks.filter(l=>comp.includes(l.fromId)).map(l=>l.id);
        const dBus = `M${Math.min(...xs)},${bus} H${Math.max(...xs)}`;
        out += `<path class="fam-edge fam-sibling" data-ids="${ids}" d="${dBus}"/>` + hit(dBus, sl);
        comp.forEach(i=>{ const dt = `M${pos[i].x},${bus} V${y}`; out += `<path class="fam-edge fam-sibling" data-ids="${ids}" d="${dt}"/>` + hit(dt, sl); });
      } else {
        sibLinks.filter(l=>comp.includes(l.fromId)).forEach(l=>{
          const a = pos[l.fromId], b = pos[l.toId];
          const dd = `M${a.x},${a.y+R} C${a.x},${a.y+R+70} ${b.x},${b.y+R+70} ${b.x},${b.y+R}`;
          out += `<path class="fam-edge fam-sibling fam-far" data-ids="${l.fromId},${l.toId}" d="${dd}"/>` + hit(dd, [l.id]);
        });
      }
    });
  }
  return out;
}

function familyBoardHtml(members, links){
  const L = familyLayout(members, links);
  const P = FAM.PAD;
  const dynId = state.activeTreeId;
  familyView.W = Math.max(L.W, FAM.SLOT) + P*2;
  familyView.H = L.H + P*2;
  familyView.needFit = familyView.fitFor!==dynId || (familyView.n===0 && members.length>0);
  familyView.n = members.length;
  const nodes = members.map(m=>{
    const p = L.pos[m.id];
    const avatar = m.photo ? `<img src="${m.photo}" alt="">` : `<span>${esc(initials(m.name))}</span>`;
    const dates = [m.birth, m.death].filter(Boolean).join(' — ');
    return `<div class="fam-node" data-id="${m.id}" style="left:${p.x+P-FAM.SLOT/2}px; top:${p.y+P-FAM.R}px;${cardColorVars(m)}">
      <div class="tree-avatar fam-avatar">${avatar}</div>
      <div class="fam-name" title="${esc(m.name)}">${esc(m.name)}</div>
      ${dates ? `<div class="fam-dates">${esc(dates)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div id="familyViewport"><div id="familyInner" style="width:${familyView.W}px; height:${familyView.H}px;">
    <svg id="familyEdges" width="${familyView.W}" height="${familyView.H}">${familyEdgesSvg(L, members, links)}</svg>${nodes}
  </div></div>`;
}

function familyApply(){
  const inner = document.getElementById('familyInner');
  if(!inner) return;
  inner.style.transform = `translate(${familyView.pan.x}px, ${familyView.pan.y}px) scale(${familyView.scale})`;
  const lbl = document.getElementById('treeZoomLabel');
  if(lbl) lbl.textContent = Math.round(familyView.scale*100)+'%';
}
function familyFit(){
  const vp = document.getElementById('familyViewport');
  if(!vp) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const sc = Math.max(0.25, Math.min(1, vw/familyView.W, vh/familyView.H));
  familyView.scale = sc;
  familyView.pan = { x:(vw - familyView.W*sc)/2, y:Math.max(0, (vh - familyView.H*sc)/2) };
  familyView.fitFor = state.activeTreeId;
  familyApply();
}
function familyZoomAt(cx, cy, newScale){
  const old = familyView.scale;
  newScale = Math.min(2.2, Math.max(0.2, newScale));
  const lx = (cx - familyView.pan.x)/old, ly = (cy - familyView.pan.y)/old;
  familyView.pan = { x:cx - lx*newScale, y:cy - ly*newScale };
  familyView.scale = newScale;
  familyApply();
}
function zoomFamily(delta){
  const vp = document.getElementById('familyViewport');
  if(!vp) return;
  familyZoomAt(vp.clientWidth/2, vp.clientHeight/2, familyView.scale + delta);
}

function familyRelatives(id){
  const links = data.dynastyMemberLinks.filter(l=>l.dynastyId===state.activeTreeId);
  const rel = new Set([id]);
  const parents = new Set();
  links.forEach(l=>{
    if(l.kind==='spouse' || l.kind==='sibling'){ if(l.fromId===id) rel.add(l.toId); if(l.toId===id) rel.add(l.fromId); }
    else { if(l.fromId===id) rel.add(l.toId); if(l.toId===id){ rel.add(l.fromId); parents.add(l.fromId); } }
  });
  links.forEach(l=>{ if(l.kind!=='spouse' && l.kind!=='sibling' && parents.has(l.fromId)) rel.add(l.toId); });   // братья и сёстры
  return rel;
}
function familyApplySel(){
  const vp = document.getElementById('familyViewport');
  if(!vp) return;
  if(familySel && !data.dynastyMembers.some(m=>m.id===familySel)) familySel = null;
  const rel = familySel ? familyRelatives(familySel) : null;
  vp.querySelectorAll('.fam-node').forEach(n=>{
    n.classList.toggle('dim', !!rel && !rel.has(n.dataset.id));
    n.classList.toggle('sel', n.dataset.id===familySel);
  });
  vp.querySelectorAll('.fam-edge').forEach(e=>{
    e.classList.toggle('dim', !!rel && !e.dataset.ids.split(',').every(i=>rel.has(i)));
  });
}

function onFamilyContextMenu(e){
  const dynastyId = state.activeTreeId;
  if(!dynastyId) return;
  const lineEl = e.target.closest('.fam-hit');
  if(lineEl) return memberLinkLineMenu(e, lineEl.dataset.links);
  const nodeEl = e.target.closest('.fam-node');
  const m = nodeEl ? data.dynastyMembers.find(x=>x.id===nodeEl.dataset.id) : null;
  if(m) return showCtxMenu(e, [
    {label:'+ Добавить ребёнка', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'child')},
    {label:'+ Добавить супруга / супругу', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'spouse')},
    {label:'+ Добавить родителя', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'parent')},
    {label:'+ Добавить брата / сестру', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'sibling')},
    {label:'+ Новая связь от «'+(m.name||'участника')+'»', onClick:()=>openNewMemberLinkModal(dynastyId, m.id)},
    {sep:true},
    {label:'Изменить участника', onClick:()=>openEditMemberModal(dynastyId, m.id)},
    ...colorMenuRows('tree', m, nodeEl),
    {sep:true},
    {label:'Удалить персонажа', danger:true, onClick:()=>deleteMember(dynastyId, m.id)}
  ]);
  showCtxMenu(e, [
    {label:'+ Новый участник', onClick:()=>openNewMemberModal(dynastyId)},
    {label:'+ Новая связь', onClick:()=>openNewMemberLinkModal(dynastyId)},
  ]);
}


/* --- перетаскивание круга на круг: быстро задать родство --- */
let familyJustDragged = false;
function familyShort(name){ const n = (name||'Без имени').trim(); return n.length>20 ? n.slice(0,19)+'…' : n; }
function familyIsAncestor(anc, id, links, seen){
  // true, если anc — предок id (по связям «родитель → ребёнок»)
  seen = seen || new Set();
  if(seen.has(id)) return false; seen.add(id);
  return links.some(l=>l.kind!=='spouse' && l.kind!=='sibling' && l.toId===id && (l.fromId===anc || familyIsAncestor(anc, l.fromId, links, seen)));
}
// relation: 'parent' — A родитель B; 'child' — A ребёнок B; 'spouse'; 'sibling'
function familyAddRelation(aId, bId, relation){
  const dynastyId = state.activeTreeId;
  const links = data.dynastyMemberLinks.filter(l=>l.dynastyId===dynastyId);
  if(aId===bId) return;
  if(links.some(l=>(l.fromId===aId && l.toId===bId) || (l.fromId===bId && l.toId===aId))){ showToast('Эти участники уже связаны — измените связь в списке ниже'); return; }
  const mk = (fromId, toId, kind)=>{ const l = {id:uid(), projectId:state.activeProjectId, dynastyId, fromId, toId}; if(kind) l.kind = kind; data.dynastyMemberLinks.push(l); links.push(l); };
  const parentsOf = id => [...new Set(links.filter(l=>l.kind!=='spouse' && l.kind!=='sibling' && l.toId===id).map(l=>l.fromId))];
  const spousesOf = id => [...new Set(links.filter(l=>l.kind==='spouse' && (l.fromId===id || l.toId===id)).map(l=>l.fromId===id ? l.toId : l.fromId))];
  if(relation==='parent' || relation==='child'){
    const [p, c] = relation==='parent' ? [aId, bId] : [bId, aId];
    if(familyIsAncestor(c, p, links)){ showToast('Так получится замкнутый круг: один и тот же человек был бы и предком, и потомком'); return; }
    const hadParents = parentsOf(c).length>0;
    mk(p, c);
    const sp = spousesOf(p);
    if(!hadParents && sp.length===1) mk(sp[0], c);          // ребёнок общий с супругом(ой)
  } else if(relation==='spouse'){
    mk(aId, bId, 'spouse');
  } else if(relation==='sibling'){
    const pa = parentsOf(aId), pb = parentsOf(bId);
    if(pa.length && !pb.length) pa.forEach(p=>mk(p, bId));
    else if(pb.length && !pa.length) pb.forEach(p=>mk(p, aId));
    else mk(aId, bId, 'sibling');
  }
  queueSave();
  familySel = aId;
  refreshTreeEditor();
}

/* --- изменить уже заданное родство --- */
function memberLinkDesc(l){
  const a = data.dynastyMembers.find(m=>m.id===l.fromId), b = data.dynastyMembers.find(m=>m.id===l.toId);
  const A = '«'+familyShort(a && a.name)+'»', B = '«'+familyShort(b && b.name)+'»';
  if(l.kind==='spouse') return A+' и '+B+' — супруги';
  if(l.kind==='sibling') return A+' и '+B+' — братья / сёстры';
  return A+' — родитель, '+B+' — ребёнок';
}
function setMemberLinkRelation(linkId, kind, fromId, toId){
  const l = data.dynastyMemberLinks.find(x=>x.id===linkId);
  if(!l) return;
  if(kind==='parent'){
    const others = data.dynastyMemberLinks.filter(x=>x.dynastyId===l.dynastyId && x.id!==l.id);
    if(familyIsAncestor(toId, fromId, others)){ showToast('Так получится замкнутый круг: один и тот же человек был бы и предком, и потомком'); return; }
  }
  l.fromId = fromId; l.toId = toId;
  if(kind==='parent') delete l.kind; else l.kind = kind;
  queueSave();
  refreshTreeEditor();
}
function memberLinkChangeMenu(e, linkId){
  const l = data.dynastyMemberLinks.find(x=>x.id===linkId);
  if(!l) return;
  const a = data.dynastyMembers.find(m=>m.id===l.fromId), b = data.dynastyMembers.find(m=>m.id===l.toId);
  if(!a || !b) return;
  const A = '«'+familyShort(a.name)+'»', B = '«'+familyShort(b.name)+'»';
  const kind = l.kind || 'parent';
  const items = [{heading:'Сейчас: '+memberLinkDesc(l)+'. Изменить на:'}];
  if(kind==='parent'){
    items.push({label:'Наоборот: '+B+' — родитель, '+A+' — ребёнок', onClick:()=>setMemberLinkRelation(linkId, 'parent', l.toId, l.fromId)});
  } else {
    items.push({label:A+' — родитель, '+B+' — ребёнок', onClick:()=>setMemberLinkRelation(linkId, 'parent', l.fromId, l.toId)});
    items.push({label:B+' — родитель, '+A+' — ребёнок', onClick:()=>setMemberLinkRelation(linkId, 'parent', l.toId, l.fromId)});
  }
  if(kind!=='spouse') items.push({label:A+' и '+B+' — супруги', onClick:()=>setMemberLinkRelation(linkId, 'spouse', l.fromId, l.toId)});
  if(kind!=='sibling') items.push({label:A+' и '+B+' — братья / сёстры', onClick:()=>setMemberLinkRelation(linkId, 'sibling', l.fromId, l.toId)});
  items.push({sep:true});
  items.push({label:'Изменить в форме…', onClick:()=>openEditMemberLinkModal(linkId)});
  items.push({label:'Удалить связь', danger:true, onClick:()=>deleteMemberLinkConfirm(linkId)});
  showCtxMenu(e, items);
}
// клик по линии в режиме «Древо»; у общей линии пары родителей может быть две связи — тогда сначала спрашиваем, какую
function familyEdgeMenu(e, linkIds){
  const ids = [...new Set((linkIds||'').split(',').filter(Boolean))];
  if(!ids.length) return;
  if(ids.length===1) return memberLinkChangeMenu(e, ids[0]);
  const pt = {clientX:e.clientX, clientY:e.clientY, preventDefault(){}, stopPropagation(){}};
  const items = [{heading:'Какую связь изменить?'}];
  ids.forEach(id=>{
    const l = data.dynastyMemberLinks.find(x=>x.id===id);
    if(l) items.push({label:memberLinkDesc(l), onClick:()=>memberLinkChangeMenu(pt, id)});
  });
  showCtxMenu(e, items);
}
function familyDropMenu(e, aId, bId){
  const a = data.dynastyMembers.find(m=>m.id===aId), b = data.dynastyMembers.find(m=>m.id===bId);
  if(!a || !b) return;
  // уже связаны — предлагаем изменить существующее родство, а не создавать новое
  const existing = data.dynastyMemberLinks.find(l=>l.dynastyId===state.activeTreeId && ((l.fromId===aId && l.toId===bId) || (l.fromId===bId && l.toId===aId)));
  if(existing) return memberLinkChangeMenu({clientX:e.clientX, clientY:e.clientY, preventDefault(){}, stopPropagation(){}}, existing.id);
  const A = '«'+familyShort(a.name)+'»', B = '«'+familyShort(b.name)+'»';
  showCtxMenu({clientX:e.clientX, clientY:e.clientY, preventDefault(){}, stopPropagation(){}}, [
    {heading: A+' → '+B+': кто они друг другу?'},
    {label: A+' — родитель для '+B, onClick:()=>familyAddRelation(aId, bId, 'parent')},
    {label: A+' — ребёнок '+B, onClick:()=>familyAddRelation(aId, bId, 'child')},
    {label: A+' и '+B+' — супруги', onClick:()=>familyAddRelation(aId, bId, 'spouse')},
    {label: A+' и '+B+' — братья / сёстры', onClick:()=>familyAddRelation(aId, bId, 'sibling')},
  ]);
}
// карточка брошена на карточку (режимы «Соты» и «Свободный»): задаём связь
function cardDropRelation(kind, aId, bId, ev){
  if(kind==='rel') return openNewRelationshipModal(aId, bId);
  familyDropMenu(ev, aId, bId);
}
// свободный режим: «невидимый круг» в центре карточки; возвращает id карточки под курсором или null
const DROP_CORE_R = 24;
function freeDropTarget(kind, ev, viewport, view, selfId){
  const rect = viewport.getBoundingClientRect();
  const lx = (ev.clientX-rect.left-view.pan.x)/view.scale, ly = (ev.clientY-rect.top-view.pan.y)/view.scale;
  const list = kind==='rel'
    ? itemsOf('characters', state.activeProjectId).map(c=>({id:c.id, x:c.netX+42, y:c.netY+26}))
    : data.dynastyMembers.filter(m=>m.dynastyId===state.activeTreeId).map(m=>({id:m.id, x:m.tx+48, y:m.ty+27}));
  let best = null;
  list.forEach(n=>{
    if(n.id===selfId) return;
    const d = Math.hypot(lx-n.x, ly-n.y);
    if(d<=DROP_CORE_R && (!best || d<best.d)) best = {d, id:n.id};
  });
  return best ? best.id : null;
}
function setFreeDropHighlight(viewport, cls, id){
  viewport.querySelectorAll('.'+cls+'.drop-target').forEach(el=>el.classList.remove('drop-target'));
  if(id){ const el = viewport.querySelector(`.${cls}[data-id="${id}"]`); if(el) el.classList.add('drop-target'); }
}

function familyStartDrag(e, vp){
  const src = e.target.closest('.fam-node');
  if(!src || e.button!==0) return;
  const sx = e.clientX, sy = e.clientY;
  let ghost = null, target = null;
  const setTarget = t=>{
    if(target===t) return;
    if(target) target.classList.remove('drop-target');
    target = t;
    if(target) target.classList.add('drop-target');
  };
  const mv = ev=>{
    if(!ghost){
      if(Math.hypot(ev.clientX-sx, ev.clientY-sy) < 6) return;
      ghost = src.cloneNode(true);
      ghost.classList.add('fam-ghost');
      ghost.classList.remove('dim','sel');
      ghost.style.cssText += `;position:fixed; left:0; top:0; width:${FAM.SLOT}px; z-index:500; pointer-events:none; transform-origin:50% 32px;`;
      document.body.appendChild(ghost);
      src.classList.add('dragging');
      closeCtxMenu();
    }
    ghost.style.transform = `translate(${ev.clientX - FAM.SLOT/2}px, ${ev.clientY - FAM.R*familyView.scale}px) scale(${familyView.scale})`;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const n = el && el.closest ? el.closest('.fam-node') : null;
    setTarget(n && n!==src && vp.contains(n) ? n : null);
  };
  const up = ev=>{
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    if(!ghost) return;                         // это был обычный клик
    ghost.remove();
    src.classList.remove('dragging');
    const t = target; setTarget(null);
    familyJustDragged = true; setTimeout(()=>{ familyJustDragged = false; }, 0);
    if(t) familyDropMenu(ev, src.dataset.id, t.dataset.id);
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
}

function initFamilyBoard(){
  const vp = document.getElementById('familyViewport');
  if(!vp) return;
  if(familyView.needFit){ familySel = null; familyFit(); } else familyApply();
  familyApplySel();
  vp.addEventListener('mousedown', e=>{
    if(e.button!==0 || e.target.closest('.fam-node') || e.target.closest('.board-fs-bar')) return;
    const sx = e.clientX, sy = e.clientY, ox = familyView.pan.x, oy = familyView.pan.y;
    let moved = false;
    vp.classList.add('panning');
    const mv = ev=>{
      if(Math.hypot(ev.clientX-sx, ev.clientY-sy) > 3) moved = true;
      familyView.pan = { x:ox + ev.clientX - sx, y:oy + ev.clientY - sy };
      familyApply();
    };
    const up = ()=>{
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      vp.classList.remove('panning');
      if(!moved && familySel){ familySel = null; familyApplySel(); }
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  vp.addEventListener('wheel', e=>{
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    familyZoomAt(e.clientX-rect.left, e.clientY-rect.top, familyView.scale + (e.deltaY<0 ? 0.1 : -0.1));
  }, {passive:false});
  vp.addEventListener('mousedown', e=>familyStartDrag(e, vp));
  vp.addEventListener('click', e=>{
    const h = e.target.closest('.fam-hit');
    if(h) familyEdgeMenu(e, h.dataset.links);
  });
  vp.addEventListener('click', e=>{
    if(familyJustDragged) return;
    const n = e.target.closest('.fam-node');
    if(!n) return;
    familySel = familySel===n.dataset.id ? null : n.dataset.id;
    familyApplySel();
  });
  vp.addEventListener('dblclick', e=>{
    const n = e.target.closest('.fam-node');
    if(n) openEditMemberModal(state.activeTreeId, n.dataset.id);
  });
  vp.addEventListener('contextmenu', onFamilyContextMenu);
}

/* Управление полем древа с клавиатуры: стрелки — двигать поле (можно удерживать), + / − — масштаб, 0 — по центру */
const familyKeys = new Set();
let familyKeyRaf = 0, familyKeyLast = 0;
function familyKeysBlocked(){
  if(!document.getElementById('familyViewport')) return true;
  if(document.getElementById('modalOverlay').classList.contains('show')) return true;
  const a = document.activeElement;
  return !!(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
}
function familyKeyTick(t){
  if(!familyKeys.size || !document.getElementById('familyViewport')){ familyKeyRaf = 0; return; }
  const dt = Math.min(50, t - (familyKeyLast || t)); familyKeyLast = t;
  const v = 0.7 * dt;                                   // пикселей экрана за кадр (~700 px/с)
  let dx = 0, dy = 0;
  if(familyKeys.has('ArrowLeft'))  dx += v;             // стрелка влево — смотрим левее, поле едет вправо
  if(familyKeys.has('ArrowRight')) dx -= v;
  if(familyKeys.has('ArrowUp'))    dy += v;
  if(familyKeys.has('ArrowDown'))  dy -= v;
  familyView.pan = { x:familyView.pan.x + dx, y:familyView.pan.y + dy };
  familyApply();
  familyKeyRaf = requestAnimationFrame(familyKeyTick);
}
document.addEventListener('keydown', e=>{
  if(e.ctrlKey || e.metaKey || e.altKey || familyKeysBlocked()) return;
  if(e.key.startsWith('Arrow')){
    e.preventDefault();
    familyKeys.add(e.key);
    if(!familyKeyRaf){ familyKeyLast = 0; familyKeyRaf = requestAnimationFrame(familyKeyTick); }
  } else if(e.key==='+' || e.key==='=' ){ e.preventDefault(); zoomFamily(0.15); }
  else if(e.key==='-' || e.key==='_'){ e.preventDefault(); zoomFamily(-0.15); }
  else if(e.key==='0'){ e.preventDefault(); familyFit(); }
});
document.addEventListener('keyup', e=>{ familyKeys.delete(e.key); });
window.addEventListener('blur', ()=>familyKeys.clear());

function treeNodeHtml(m){
  const avatarInner = m.photo ? `<img src="${m.photo}" alt="">` : `<span>${esc(initials(m.name))}</span>`;
  const dates = [m.birth, m.death].filter(Boolean).join(' — ');
  return `<div class="tree-node" data-id="${m.id}" style="left:${m.tx}px; top:${m.ty}px;${cardColorVars(m)}" ondblclick="openEditMemberModal('${m.dynastyId}','${m.id}')">
    <div class="tree-avatar">${avatarInner}</div>
    <div class="tree-name">${esc(m.name)}</div>
    ${dates ? `<div class="tree-dates">${esc(dates)}</div>` : ''}
    <div class="tree-port" data-id="${m.id}" title="Тяните к ребёнку, чтобы создать связь"></div>
  </div>`;
}

function applyTreeCanvasTransform(){
  const inner = document.getElementById('treeCanvasInner');
  if(!inner) return;
  inner.style.transform = `translate(${treeCanvasView.pan.x}px, ${treeCanvasView.pan.y}px) scale(${treeCanvasView.scale})`;
  const lbl = document.getElementById('treeZoomLabel');
  if(lbl) lbl.textContent = Math.round(treeCanvasView.scale*100)+'%';
}
function zoomTreeCanvas(delta){ if(state.viewModeDynasty==='family') return zoomFamily(delta); if(state.viewModeDynasty==='hex') return hexZoomBy('tree', delta); treeCanvasView.scale = Math.min(2, Math.max(0.35, treeCanvasView.scale+delta)); applyTreeCanvasTransform(); drawTreeEdges(); }
function resetTreeCanvasView(){ if(state.viewModeDynasty==='family') return familyFit(); if(state.viewModeDynasty==='hex') return resetHexView('tree'); treeCanvasView.pan = {x:220,y:90}; treeCanvasView.scale = 1; applyTreeCanvasTransform(); drawTreeEdges(); }

function drawTreeEdges(){
  const svg = document.getElementById('treeEdgesSvg');
  if(!svg) return;
  const dynastyId = state.activeTreeId;
  const members = data.dynastyMembers.filter(m=>m.dynastyId===dynastyId);
  const links = data.dynastyMemberLinks.filter(l=>l.dynastyId===dynastyId);
  const byId = {}; members.forEach(m=>byId[m.id]=m);
  const NCX=48, NCY=27;
  let out = '';
  links.forEach(l=>{
    const a = byId[l.fromId], b = byId[l.toId];
    if(!a||!b) return;
    const x1=a.tx+NCX, y1=a.ty+NCY, x2=b.tx+NCX, y2=b.ty+NCY;
    out += `<path class="tree-edge" data-id="${l.id}" data-a="${l.fromId}" data-b="${l.toId}" onclick="event.stopPropagation(); deleteMemberLinkConfirm('${l.id}')" d="M${x1},${y1} L${x2},${y2}" stroke="var(--gold)" fill="none"/>`;
  });
  svg.innerHTML = out;
}

function attachTreeCanvasEvents(){
  const viewport = document.getElementById('treeCanvasViewport');
  if(!viewport) return;
  viewport.addEventListener('mousedown', onTreeCanvasMouseDown);
  attachFreeEdgeHover('tree', viewport);
  viewport.addEventListener('contextmenu', onTreeCanvasContextMenu);
  viewport.addEventListener('wheel', onTreeCanvasWheel, {passive:false});
}

function onTreeCanvasWheel(e){
  e.preventDefault();
  const viewport = document.getElementById('treeCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const cursorX = e.clientX-rect.left, cursorY = e.clientY-rect.top;
  const oldScale = treeCanvasView.scale;
  const newScale = Math.min(2, Math.max(0.35, oldScale + (e.deltaY<0?0.1:-0.1)));
  const localX=(cursorX-treeCanvasView.pan.x)/oldScale, localY=(cursorY-treeCanvasView.pan.y)/oldScale;
  treeCanvasView.pan.x = cursorX-localX*newScale;
  treeCanvasView.pan.y = cursorY-localY*newScale;
  treeCanvasView.scale = newScale;
  applyTreeCanvasTransform(); drawTreeEdges();
}

function onTreeCanvasContextMenu(e){
  const dynastyId = state.activeTreeId;
  if(!dynastyId) return;
  const viewport = document.getElementById('treeCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const lx = Math.round((e.clientX-rect.left-treeCanvasView.pan.x)/treeCanvasView.scale);
  const ly = Math.round((e.clientY-rect.top-treeCanvasView.pan.y)/treeCanvasView.scale);
  const here = {tx:Math.max(0,lx-48), ty:Math.max(0,ly-27)};
  const nodeEl = e.target.closest('.tree-node');
  if(nodeEl){
    const m = data.dynastyMembers.find(x=>x.id===nodeEl.dataset.id);
    if(m) return showCtxMenu(e, [
      {label:'+ Добавить ребёнка (участник и связь)', onClick:()=>openNewMemberModal(dynastyId, {tx:m.tx, ty:m.ty+150}, m.id)},
      {label:'+ Добавить супруга / супругу', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'spouse')},
      {label:'+ Добавить родителя', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'parent')},
      {label:'+ Добавить брата / сестру', onClick:()=>openNewRelativeModal(dynastyId, m.id, 'sibling')},
      {label:'+ Новая связь от «'+(m.name||'участника')+'»', onClick:()=>openNewMemberLinkModal(dynastyId, m.id)},
      {label:'+ Новая связь', onClick:()=>openNewMemberLinkModal(dynastyId)},
      {label:'+ Новый участник здесь', onClick:()=>openNewMemberModal(dynastyId, here)},
      {sep:true},
      {label:'Изменить участника', onClick:()=>openEditMemberModal(dynastyId, m.id)},
      ...colorMenuRows('tree', m, nodeEl),
      {sep:true},
      {label:'Удалить персонажа', danger:true, onClick:()=>deleteMember(dynastyId, m.id)}
    ]);
  }
  showCtxMenu(e, [
    {label:'+ Новый участник здесь', onClick:()=>openNewMemberModal(dynastyId, here)},
    {label:'+ Новая связь', onClick:()=>openNewMemberLinkModal(dynastyId)},
  ]);
}

function onTreeCanvasMouseDown(e){
  if(e.button!==0) return;
  const viewport = document.getElementById('treeCanvasViewport');
  const rect = viewport.getBoundingClientRect();
  const portEl = e.target.closest('.tree-port');
  const nodeEl = e.target.closest('.tree-node');
  const dynastyId = state.activeTreeId;

  if(portEl){
    const sourceId = portEl.dataset.id;
    const svg = document.getElementById('treeEdgesSvg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg','path');
    tempPath.setAttribute('class','temp-edge');
    svg.appendChild(tempPath);
    const move=(ev)=>{
      const s = data.dynastyMembers.find(x=>x.id===sourceId);
      if(!s) return;
      const x1=s.tx+48, y1=s.ty+27;
      const lx=(ev.clientX-rect.left-treeCanvasView.pan.x)/treeCanvasView.scale, ly=(ev.clientY-rect.top-treeCanvasView.pan.y)/treeCanvasView.scale;
      tempPath.setAttribute('d', `M${x1},${y1} L${lx},${ly}`);
    };
    const up=(ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      tempPath.remove();
      const targetNode = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tree-node');
      if(targetNode && targetNode.dataset.id !== sourceId) createMemberLink(dynastyId, sourceId, targetNode.dataset.id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.stopPropagation(); e.preventDefault();
    return;
  }

  if(nodeEl){
    const id = nodeEl.dataset.id;
    const m = data.dynastyMembers.find(x=>x.id===id);
    if(!m) return;
    const startX=e.clientX, startY=e.clientY, ox=m.tx, oy=m.ty;
    let moved = false, dropId = null;
    nodeEl.classList.add('dragging');
    const move=(ev)=>{
      if(Math.abs(ev.clientX-startX)>3 || Math.abs(ev.clientY-startY)>3) moved = true;
      m.tx = ox + (ev.clientX-startX)/treeCanvasView.scale;
      m.ty = oy + (ev.clientY-startY)/treeCanvasView.scale;
      nodeEl.style.left = m.tx+'px'; nodeEl.style.top = m.ty+'px';
      drawTreeEdges();
      if(moved){ const t = freeDropTarget('tree', ev, viewport, treeCanvasView, id); if(t!==dropId){ dropId = t; setFreeDropHighlight(viewport, 'tree-node', t); } }
    };
    const up=(ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      nodeEl.classList.remove('dragging');
      setFreeDropHighlight(viewport, 'tree-node', null);
      if(moved && dropId){
        // брошена в центр другой карточки — возвращаем на место и задаём родство
        m.tx = ox; m.ty = oy;
        nodeEl.style.left = ox+'px'; nodeEl.style.top = oy+'px';
        drawTreeEdges();
        cardDropRelation('tree', id, dropId, ev);
        return;
      }
      if(moved) queueSave(); else treeToggleSelect(id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }

  const startX=e.clientX, startY=e.clientY, ox=treeCanvasView.pan.x, oy=treeCanvasView.pan.y;
  viewport.classList.add('panning');
  const move=(ev)=>{
    treeCanvasView.pan.x = ox+(ev.clientX-startX);
    treeCanvasView.pan.y = oy+(ev.clientY-startY);
    applyTreeCanvasTransform();
  };
  const up=()=>{
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    viewport.classList.remove('panning');
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function treeToggleSelect(id){
  treeSelected = treeSelected===id ? null : id;
  document.querySelectorAll('.tree-node').forEach(n=>{ n.classList.toggle('dim', treeSelected && n.dataset.id !== treeSelected); });
  document.querySelectorAll('.tree-edge').forEach(ed=>{
    const connected = !treeSelected || ed.dataset.a===treeSelected || ed.dataset.b===treeSelected;
    ed.classList.toggle('dim', !connected);
  });
}

function createMemberLink(dynastyId, fromId, toId){
  if(fromId===toId) return;
  const exists = data.dynastyMemberLinks.find(l=>l.dynastyId===dynastyId && l.fromId===fromId && l.toId===toId);
  if(exists) return;
  data.dynastyMemberLinks.push({id:uid(), projectId: state.activeProjectId, dynastyId, fromId, toId});
  queueSave();
  refreshTreeEditor();
}
function memberLinkFields(dynastyId){
  const members = data.dynastyMembers.filter(m=>m.dynastyId===dynastyId).map(m=>[m.id, m.name]);
  return [
    {key:'kind', label:'Тип связи', type:'select', options:[['parent','Первый — родитель, второй — ребёнок'],['spouse','Супруги / партнёры'],['sibling','Братья / сёстры']], required:true},
    {key:'fromId', label:'Первый участник', type:'select', options: members, required:true},
    {key:'toId', label:'Второй участник', type:'select', options: members, required:true},
  ];
}
function openNewMemberLinkModal(dynastyId, presetFrom, presetTo){
  dynastyId = dynastyId || state.activeTreeId;
  if(data.dynastyMembers.filter(m=>m.dynastyId===dynastyId).length<2){ showToast('Для связи нужно минимум два участника'); return; }
  openFormModal('Новая связь', memberLinkFields(dynastyId), {kind:'parent', fromId: presetFrom||'', toId: presetTo||''}, (vals)=>{
    if(vals.fromId===vals.toId){ showToast('Выберите двух разных участников'); return; }
    if(data.dynastyMemberLinks.some(l=>l.dynastyId===dynastyId && ((l.fromId===vals.fromId && l.toId===vals.toId) || (l.fromId===vals.toId && l.toId===vals.fromId)))){ showToast('Эти участники уже связаны'); return; }
    const nl = {id:uid(), projectId: state.activeProjectId, dynastyId, fromId: vals.fromId, toId: vals.toId};
    if(vals.kind && vals.kind!=='parent') nl.kind = vals.kind;
    data.dynastyMemberLinks.push(nl);
    queueSave(); closeModal(); refreshTreeEditor();
  });
}
function openEditMemberLinkModal(id){
  const l = data.dynastyMemberLinks.find(x=>x.id===id);
  if(!l) return;
  openFormModal('Изменить связь', memberLinkFields(l.dynastyId), {kind:l.kind||'parent', fromId:l.fromId, toId:l.toId}, (vals)=>{
    if(vals.fromId===vals.toId){ showToast('Выберите двух разных участников'); return; }
    if(data.dynastyMemberLinks.some(x=>x.id!==l.id && x.dynastyId===l.dynastyId && ((x.fromId===vals.fromId && x.toId===vals.toId) || (x.fromId===vals.toId && x.toId===vals.fromId)))){ showToast('Эти участники уже связаны'); return; }
    l.fromId = vals.fromId; l.toId = vals.toId;
    if(vals.kind && vals.kind!=='parent') l.kind = vals.kind; else delete l.kind;
    queueSave(); closeModal(); refreshTreeEditor();
  }, { label:'Удалить связь', onClick: ()=>{ closeModal(); deleteMemberLinkConfirm(id); } });
}
function deleteMemberLinkConfirm(id){
  askConfirm('Удалить эту связь между членами рода?', 'Удалить', ()=>{
    data.dynastyMemberLinks = data.dynastyMemberLinks.filter(l=>l.id!==id);
    queueSave();
    refreshTreeEditor();
  });
}
function treeMemberName(id, members){
  const m = (members || data.dynastyMembers).find(x=>x.id===id);
  return m ? m.name : '???';
}
function treeLinkCard(l, members){
  return `<div class="dossier">
    <div class="d-top"><h3 style="font-size:14.5px;">${esc(treeMemberName(l.fromId, members))} ${l.kind==='spouse' ? '⚭' : l.kind==='sibling' ? '↔' : '→'} ${esc(treeMemberName(l.toId, members))}</h3></div>
    <div style="font-size:11.5px; color:var(--text-faint); margin:2px 0 6px;">${l.kind==='spouse' ? 'Супруги / партнёры' : l.kind==='sibling' ? 'Братья / сёстры' : 'Родитель → ребёнок'}</div>
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openEditMemberLinkModal('${l.id}')">${btnIconSvg('edit')}Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMemberLinkConfirm('${l.id}')">Удалить</button>
    </div>
  </div>`;
}

function openNewMemberModal(dynastyId, pos, parentId){
  openFormModal('Новый член рода', memberFieldsNew(), {}, (vals)=>{
    const nm = Object.assign({id:uid(), projectId: state.activeProjectId, dynastyId}, vals);
    if(pos && typeof pos.tx==='number'){ nm.tx = pos.tx; nm.ty = pos.ty; }
    if(pos && Number.isFinite(pos.hexQ)){ nm.hexQ = pos.hexQ; nm.hexR = pos.hexR; }
    data.dynastyMembers.push(nm);
    if(parentId) data.dynastyMemberLinks.push({id:uid(), projectId: state.activeProjectId, dynastyId, fromId: parentId, toId: nm.id});
    queueSave(); closeModal(); refreshTreeEditor();
  });
}
function openNewRelativeModal(dynastyId, anchorId, relation){
  const titles = {child:'Новый ребёнок', parent:'Новый родитель', spouse:'Новый супруг / партнёр', sibling:'Новый брат / сестра'};
  openFormModal(titles[relation] || 'Новый член рода', memberFieldsNew(), {}, (vals)=>{
    const nm = Object.assign({id:uid(), projectId: state.activeProjectId, dynastyId}, vals);
    data.dynastyMembers.push(nm);
    const mk = (fromId, toId, kind)=>{ const l = {id:uid(), projectId: state.activeProjectId, dynastyId, fromId, toId}; if(kind) l.kind = kind; data.dynastyMemberLinks.push(l); };
    if(relation==='child'){
      mk(anchorId, nm.id);
      // если у родителя ровно один супруг(а) — ребёнок общий
      const sp = data.dynastyMemberLinks.filter(l=>l.dynastyId===dynastyId && l.kind==='spouse' && (l.fromId===anchorId || l.toId===anchorId)).map(l=>l.fromId===anchorId ? l.toId : l.fromId);
      if(new Set(sp).size===1) mk(sp[0], nm.id);
    } else if(relation==='parent'){
      mk(nm.id, anchorId);
    } else if(relation==='sibling'){
      // у брата/сестры те же родители, что у выбранного человека — связи прописываются сами
      const parents = [...new Set(data.dynastyMemberLinks.filter(l=>l.dynastyId===dynastyId && l.kind!=='spouse' && l.kind!=='sibling' && l.toId===anchorId).map(l=>l.fromId))];
      if(parents.length) parents.forEach(p=>mk(p, nm.id));
      else mk(anchorId, nm.id, 'sibling');   // родителей в древе нет — связываем напрямую
    } else {
      mk(anchorId, nm.id, 'spouse');
    }
    queueSave(); closeModal(); refreshTreeEditor();
  });
}
function openEditMemberModal(dynastyId, id){
  const m = data.dynastyMembers.find(x=>x.id===id);
  if(!m) return;
  openFormModal('Изменить члена рода', memberFields(), m, (vals)=>{ Object.assign(m, vals); queueSave(); closeModal(); refreshTreeEditor(); },
    { label:'Удалить из древа', onClick: ()=>{ closeModal(); deleteMember(dynastyId, id); } });
}
function deleteMember(dynastyId, id){
  askConfirm('Удалить этого члена рода из древа? Связанные связи тоже будут удалены.', 'Удалить', ()=>{
    data.dynastyMembers = data.dynastyMembers.filter(m=>m.id!==id);
    data.dynastyMemberLinks = data.dynastyMemberLinks.filter(l=>l.fromId!==id && l.toId!==id);
    queueSave(); refreshTreeEditor();
  });
}
function memberFields(){
  return [
    {key:'name', label:'Имя', type:'text', required:true},
    {key:'photo', label:'Фото', type:'image'},
    {key:'birth', label:'Дата рождения', type:'text', placeholder:'год, дата в мире истории'},
    {key:'death', label:'Дата смерти (если применимо)', type:'text'},
    {key:'note', label:'Заметки', type:'textarea'},
  ];
}

const WORLD_SECTIONS = [
  {key:'maps', title:'Карта', addLabel:'+ Добавить', addFn:'openNewMapModal', card:mapCardRef, emptyLabel:'Карт пока нет.'},
  {key:'magicSystems', title:'Магическая система / правила мира', addLabel:'+ Добавить', addFn:'openNewMagicModal', card:magicCardRef, emptyLabel:'Правил пока нет.'},
  {key:'artifacts', title:'Артефакты и реликвии', addLabel:'+ Добавить', addFn:'openNewArtifactModal', card:artifactCardRef, emptyLabel:'Артефактов пока нет.'},
  {key:'deities', title:'Религии / пантеон богов', addLabel:'+ Добавить', addFn:'openNewDeityModal', card:deityCardRef, emptyLabel:'Божеств пока нет.'},
  {key:'countries', title:'Страны', addLabel:'+ Добавить', addFn:'openNewCountryModal', card:countryCardRef, emptyLabel:'Стран пока нет.'},
  {key:'dynasties', title:'Династии', addLabel:'+ Добавить', addFn:'openNewDynastyModal', card:dynastyCardRef, emptyLabel:'Династий пока нет.'},
  {key:'locations', title:'Локации', addLabel:'+ Добавить', addFn:'openNewLocationModal', card:locCardRef, emptyLabel:'Локаций пока нет.'},
  {key:'factions', title:'Фракции', addLabel:'+ Добавить', addFn:'openNewFactionModal', card:facCardRef, emptyLabel:'Фракций пока нет.'},
  {key:'creatures', title:'Бестиарий', addLabel:'+ Добавить', addFn:'openNewCreatureModal', card:creatureCardRef, emptyLabel:'Существ пока нет.'},
  {key:'myths', title:'Мифы и легенды', addLabel:'+ Добавить', addFn:'openNewMythModal', card:mythCardRef, emptyLabel:'Мифов и легенд пока нет.'},
];
// Группы разделов (бывший единый раздел «Мир и лор»). Каждая группа — отдельная вкладка.
// Всё, что не вошло ни в одну именованную группу, автоматически попадает в «Разное».
const WORLD_GROUPS = [
  {key:'geography', title:'География',      keys:['maps','countries','locations']},
  {key:'society',   title:'Общество',       keys:['factions','dynasties','deities']},
  {key:'magic',     title:'Магия и тайны',  keys:['magicSystems','artifacts','myths']},
  {key:'creatures', title:'Существа',       keys:['creatures']},
  {key:'misc',      title:'Разное',         keys:null},
];
function worldGroupSections(g){
  if(g.keys) return g.keys.map(k=>WORLD_SECTIONS.find(s=>s.key===k)).filter(Boolean);
  const used = new Set(WORLD_GROUPS.filter(x=>x.keys).flatMap(x=>x.keys));
  return WORLD_SECTIONS.filter(s=>!used.has(s.key));
}
function isWorldTab(key){ return WORLD_GROUPS.some(g=>g.key===key); }
function worldTabOf(coll){
  const g = WORLD_GROUPS.find(g=>g.keys && g.keys.includes(coll));
  if(g) return g.key;
  return WORLD_SECTIONS.some(s=>s.key===coll) ? 'misc' : null;
}
function locCardRef(x){ return locCard(x); }
function facCardRef(x){ return facCard(x); }
function creatureCardRef(x){ return creatureCard(x); }
function mythCardRef(x){ return mythCard(x); }
function magicCardRef(x){ return magicCard(x); }
function deityCardRef(x){ return deityCard(x); }
function mapCardRef(x){ return mapCard(x); }
function countryCardRef(x){ return countryCard(x); }
function dynastyCardRef(x){ return dynastyCard(x); }
function artifactCardRef(x){ return artifactCard(x); }

function toggleWorldSection(key){
  if(!state.worldOpen) state.worldOpen = {};
  state.worldOpen[key] = !state.worldOpen[key];
  const sec = document.getElementById('world-sec-'+key);
  if(sec) sec.classList.toggle('open', !!state.worldOpen[key]);
}

function sortByOrder(list){
  return [...list].sort((a,b)=>(a.order??0)-(b.order??0));
}
function nextOrder(coll, pid){
  return Math.max(-1, ...itemsOf(coll, pid).map(x=>x.order??0)) + 1;
}
function reorderWorldItem(coll, dragId, targetId, pid){
  const list = sortByOrder(itemsOf(coll, pid));
  const fromIdx = list.findIndex(x=>x.id===dragId);
  const toIdx = list.findIndex(x=>x.id===targetId);
  if(fromIdx===-1 || toIdx===-1 || fromIdx===toIdx) return;
  const [moved] = list.splice(fromIdx,1);
  list.splice(toIdx,0,moved);
  list.forEach((x,i)=>{ x.order = i; });
  queueSave();
  renderWorld(document.getElementById('tabContent'), pid);
}
function attachWorldGridDrag(gridEl, coll, pid){
  if(!gridEl) return;
  let dragId = null;
  gridEl.querySelectorAll('.dossier[data-id]').forEach(card=>{
    card.draggable = true;
    card.addEventListener('dragstart', ()=>{ dragId = card.dataset.id; card.classList.add('dragging-card'); });
    card.addEventListener('dragend', ()=>{
      card.classList.remove('dragging-card');
      gridEl.querySelectorAll('.dossier').forEach(c=>c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e)=>{ e.preventDefault(); if(card.dataset.id===dragId) return; card.classList.add('drag-over'); });
    card.addEventListener('dragleave', ()=>{ card.classList.remove('drag-over'); });
    card.addEventListener('drop', (e)=>{
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.id;
      if(!dragId || dragId===targetId) return;
      reorderWorldItem(coll, dragId, targetId, pid);
    });
  });
}
function renderWorld(el, pid){
  if(!state.worldOpen) state.worldOpen = {};
  if(state.activeTreeId){
    const activeDynasty = data.dynasties.find(x=>x.id===state.activeTreeId && x.projectId===pid);
    if(activeDynasty) return renderTreeEditor(el, activeDynasty);
    state.activeTreeId = null;
  }
  if(state.activeMapId){
    const activeMap = data.maps.find(x=>x.id===state.activeMapId && x.projectId===pid);
    if(activeMap) return renderMapEditor(el, activeMap);
    state.activeMapId = null;
  }
  const dataByKey = {
    maps: itemsOf('maps', pid),
    magicSystems: sortByOrder(itemsOf('magicSystems', pid)),
    deities: sortByOrder(itemsOf('deities', pid)),
    countries: sortByOrder(itemsOf('countries', pid)),
    dynasties: sortByOrder(itemsOf('dynasties', pid)),
    artifacts: sortByOrder(itemsOf('artifacts', pid)),
    locations: sortByOrder(itemsOf('locations', pid)),
    factions: sortByOrder(itemsOf('factions', pid)),
    creatures: sortByOrder(itemsOf('creatures', pid)),
    myths: sortByOrder(itemsOf('myths', pid)),
  };
  const group = WORLD_GROUPS.find(g=>g.key===state.activeTab) || WORLD_GROUPS[0];
  const groupSections = worldGroupSections(group);
  el.innerHTML = groupSections.map(sec=>{
    const items = dataByKey[sec.key];
    const open = !!state.worldOpen[sec.key];
    return `<div class="world-section ${open?'open':''}" id="world-sec-${sec.key}">
      <div class="world-section-head" onclick="toggleWorldSection('${sec.key}')">
        <div class="world-section-head-left">
          <span class="world-section-chevron"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
          <span class="world-section-title">${esc(sec.title)}</span>
          <span class="world-section-count">${items.length}</span>
        </div>
        <button class="btn btn-sm btn-primary world-section-addbtn" onclick="event.stopPropagation(); ${sec.addFn}()">${esc(sec.addLabel)}</button>
      </div>
      <div class="world-section-body">
        <div class="grid" id="world-grid-${sec.key}">${items.length ? items.map(sec.card).join('') : `<div class="empty-tab">${esc(sec.emptyLabel)}</div>`}</div>
      </div>
    </div>`;
  }).join('');
  groupSections.forEach(sec=>{
    if(sec.key==='maps') return;
    attachWorldGridDrag(document.getElementById('world-grid-'+sec.key), sec.key, pid);
  });
}

/* ---------------- MAP (lore) ---------------- */
function mapCard(m){
  const thumbStyle = m.image ? `background-image:url('${m.image}');` : '';
  return `<div class="dossier map-dossier" onclick="openMapEditor('${m.id}')">
    <div class="map-thumb" style="${thumbStyle}"></div>
    <h3 style="font-size:15.5px; margin-top:10px;">${esc(m.name)}</h3>
    <div class="d-alias">${(m.markers||[]).length} меток · ${(m.paths||[]).length} путей</div>
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openMapEditor('${m.id}')">Открыть</button>
      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openEditMapModal('${m.id}')">Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="event.stopPropagation(); deleteMap('${m.id}')">Удалить</button>
    </div>
  </div>`;
}

function getImageDimensions(dataUrl){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function openMapFormModal(existingMap){
  const isEdit = !!existingMap;
  let pendingImage = isEdit ? { dataUrl: existingMap.image, w: null, h: null } : null;
  const box = document.getElementById('modalBox');
  box.innerHTML = `<h2>${isEdit ? 'Изменить карту' : 'Новая карта'}</h2>
    <div class="field"><label>Название карты</label><input type="text" id="mapNameInput" value="${isEdit ? esc(existingMap.name) : ''}" placeholder="Карта мира, Континент…"></div>
    <div class="field"><label>Изображение карты</label>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <input type="file" id="mapImageInput" accept="image/*" style="display:none;">
        <button class="btn btn-ghost btn-sm" id="mapImagePickBtn" style="align-self:flex-start;">${isEdit ? 'Заменить изображение' : 'Выбрать изображение'}</button>
        <div id="mapImagePreviewWrap" style="display:${isEdit ? 'block' : 'none'};"><img id="mapImagePreview" src="${isEdit ? existingMap.image : ''}" style="max-width:100%; max-height:220px; border-radius:4px; border:1px solid var(--border); display:block;"></div>
      </div>
    </div>
    <div id="modalActions">
      <div id="modalLeftActions">${isEdit ? `<button class="btn btn-danger btn-sm" id="mapDangerBtn">Удалить карту</button>` : ''}</div>
      <div id="modalRightActions" style="display:flex; gap:10px;">
        <button class="btn btn-primary" id="mapSaveBtn">${isEdit ? 'Сохранить' : 'Создать'}</button>
      </div>
    </div>`;
  document.getElementById('mapImagePickBtn').onclick = ()=> document.getElementById('mapImageInput').click();
  document.getElementById('mapImageInput').onchange = ()=>{
    const file = document.getElementById('mapImageInput').files[0];
    if(!file) return;
    resizeImageFile(file, 1600, 1600, 0.85).then(dataUrl=>{
      return getImageDimensions(dataUrl).then(dim=>{
        pendingImage = { dataUrl, w: dim.w, h: dim.h };
        document.getElementById('mapImagePreviewWrap').style.display = 'block';
        document.getElementById('mapImagePreview').src = dataUrl;
      });
    }).catch(()=>showToast('Не удалось загрузить изображение'));
  };
  document.getElementById('mapSaveBtn').onclick = ()=>{
    const name = document.getElementById('mapNameInput').value.trim();
    if(!name){ showToast('Введите название карты'); return; }
    if(!pendingImage){ showToast('Загрузите изображение карты'); return; }
    if(isEdit){
      existingMap.name = name;
      if(pendingImage.dataUrl !== existingMap.image){
        existingMap.image = pendingImage.dataUrl;
        if(pendingImage.w && pendingImage.h) existingMap.aspect = pendingImage.w / pendingImage.h;
      }
      queueSave(); closeModal(); renderMain();
    } else {
      const m = { id: uid(), projectId: state.activeProjectId, name, image: pendingImage.dataUrl, aspect: (pendingImage.w && pendingImage.h) ? pendingImage.w/pendingImage.h : 1.6, markers: [], paths: [] };
      data.maps.push(m);
      queueSave(); closeModal();
      openMapEditor(m.id);
    }
  };
  if(isEdit){ document.getElementById('mapDangerBtn').onclick = ()=>{ closeModal(); deleteMap(existingMap.id); }; }
  document.getElementById('modalOverlay').classList.add('show');
}
function openNewMapModal(){ openMapFormModal(null); }
function openEditMapModal(id){ const m = data.maps.find(x=>x.id===id); if(m) openMapFormModal(m); }
function deleteMap(id){
  askConfirm('Удалить карту вместе со всеми метками и путями? Это необратимо.', 'Удалить карту', ()=>{
    data.maps = data.maps.filter(m=>m.id!==id);
    if(state.activeMapId===id){ state.activeMapId = null; exitMapFullscreen(); }
    queueSave(); renderMain();
  });
}

function openMapEditor(id){
  state.activeMapId = id;
  if(!state.mapMode) state.mapMode = 'marker';
  if(!state.mapListTab) state.mapListTab = state.mapMode;
  state.mapLayersPanelOpen = false;
  state.mapDrawingPath = null;
  mapCanvasView = { pan:{x:0,y:0}, scale:1 };
  exitMapFullscreen();
  renderMain();
}
function closeMapEditor(){
  state.activeMapId = null;
  state.mapDrawingPath = null;
  exitMapFullscreen();
  renderMain();
}
function exitMapFullscreen(){
  if(state.mapFullscreen){
    state.mapFullscreen = false;
    window.removeEventListener('keydown', mapFullscreenEscHandler);
    window.removeEventListener('resize', mapFullscreenResizeHandler);
    mapCanvasView = { pan:{x:0,y:0}, scale:1 };
  }
}
function mapFullscreenEscHandler(e){
  if(e.key==='Escape'){ exitMapFullscreen(); refreshMapEditor(); }
}
function mapFullscreenResizeHandler(){
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  layoutMapStage(m);
  centerMapCanvasView(m);
  applyMapCanvasTransform();
}
function toggleMapFullscreen(){
  if(state.mapFullscreen){
    exitMapFullscreen();
  } else {
    state.mapFullscreen = true;
    window.addEventListener('keydown', mapFullscreenEscHandler);
    window.addEventListener('resize', mapFullscreenResizeHandler);
    mapFullscreenNeedsCenter = true;
  }
  refreshMapEditor();
}
function refreshMapEditor(){
  const el = document.getElementById('tabContent');
  if(!el) return;
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(m) renderMapEditor(el, m); else renderMain();
}
function setMapMode(mode){
  state.mapMode = mode;
  state.mapListTab = mode;
  if(mode!=='path') state.mapDrawingPath = null;
  // Editing a layer implies wanting to see it — auto-reveal it if it was hidden.
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(m){
    ensureMapLayers(m);
    if(mode==='marker' && !m.layers.markers){ m.layers.markers = true; queueSave(); }
    if(mode==='label' && !m.layers.labels){ m.layers.labels = true; queueSave(); }
    if(mode==='path' && !m.layers.paths){ m.layers.paths = true; queueSave(); }
  }
  refreshMapEditor();
}
function setMapListTab(tab){
  state.mapListTab = tab;
  refreshMapEditor();
}
function toggleMapLayersPanel(e){
  if(e) e.stopPropagation();
  state.mapLayersPanelOpen = !state.mapLayersPanelOpen;
  refreshMapEditor();
}
function closeMapLayersPanel(){
  if(state.mapLayersPanelOpen){
    state.mapLayersPanelOpen = false;
    refreshMapEditor();
  }
}
function ensureMapLayers(m){
  if(!m.layers) m.layers = { markers:true, labels:true, paths:true };
  if(!m.layers.labelTypes){
    m.layers.labelTypes = {};
    MAP_LABEL_TYPE_ORDER.forEach(t=>{ m.layers.labelTypes[t] = true; });
  } else {
    MAP_LABEL_TYPE_ORDER.forEach(t=>{ if(m.layers.labelTypes[t]===undefined) m.layers.labelTypes[t] = true; });
  }
}
function toggleMapLayer(key){
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  ensureMapLayers(m);
  m.layers[key] = !m.layers[key];
  queueSave();
  refreshMapEditor();
}
function toggleMapLabelType(type){
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  ensureMapLayers(m);
  m.layers.labelTypes[type] = !m.layers.labelTypes[type];
  queueSave();
  refreshMapEditor();
}
function setAllMapLabelTypes(on){
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  ensureMapLayers(m);
  MAP_LABEL_TYPE_ORDER.forEach(t=>{ m.layers.labelTypes[t] = on; });
  queueSave();
  refreshMapEditor();
}
function startMapPath(){ state.mapDrawingPath = { points: [] }; refreshMapEditor(); }
function cancelMapPath(){ state.mapDrawingPath = null; refreshMapEditor(); }
function finishMapPath(){
  if(!state.mapDrawingPath || state.mapDrawingPath.points.length < 2){ showToast('Добавьте хотя бы 2 точки маршрута'); return; }
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  const points = state.mapDrawingPath.points;
  state.mapDrawingPath = null;
  openPathPanel(m, null, points);
}
function openPathPanel(m, existingPath, points){
  const isNew = !existingPath;
  const defaultColors = ['#c1443b','#c9a24c','#5fa8a0','#b5698f','#8c7ec9','#7fb069'];
  const p = existingPath || { id:uid(), name:'', color: defaultColors[Math.floor(Math.random()*defaultColors.length)], width:0.35, dashed:false, desc:'', points: points||[] };
  if(isNew){
    if(!m.paths) m.paths = [];
    m.paths.push(p);
  }
  state.mapPanel = { type:'path', mapId:m.id, id:p.id };
  drawMapPaths(m);
  renderPathPanel(m, p, isNew);
}
function openEditPathModal(mapId, pathId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  const p = (m.paths||[]).find(x=>x.id===pathId);
  if(!p) return;
  openPathPanel(m, p, null);
}
function renderPathPanel(m, p, isNew){
  const panel = document.getElementById('mapSidePanel');
  if(!panel) return;
  const w0 = Number(p.width)||0.35;
  panel.innerHTML = `<div class="panel-inner">
    <h3 style="margin:0 0 14px; font-size:15px;">${isNew ? 'Новый путь' : 'Путь на карте'}</h3>
    <div class="field"><label>Название пути</label><input type="text" id="ppName" value="${esc(p.name||'')}" placeholder="Путь героя от деревни до крепости…"></div>
    <div class="field"><label>Цвет линии</label><input type="color" id="ppColor" value="${p.color||'#c9a24c'}" style="width:44px; height:32px; padding:2px; border-radius:6px; cursor:pointer;"></div>
    <div class="field"><label>Толщина линии (<span id="ppWidthVal">${w0.toFixed(2)}</span>)</label>
      <input type="range" id="ppWidth" min="0.1" max="1.5" step="0.05" value="${w0}">
      <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-faint); font-family:'IBM Plex Mono',monospace;"><span>тонкая тропа</span><span>широкий тракт</span></div>
    </div>
    <div class="field"><label>Стиль линии</label>
      <div id="ppStyleToggle" style="display:flex; gap:8px;">
        <button type="button" class="btn btn-sm ${!p.dashed?'btn-primary':''}" data-style="solid">— Сплошная</button>
        <button type="button" class="btn btn-sm ${p.dashed?'btn-primary':''}" data-style="dashed">┄ Пунктир</button>
      </div>
    </div>
    <div class="field"><label>Заметка (необязательно)</label><textarea id="ppDesc" rows="3" placeholder="что происходит в пути…">${esc(p.desc||'')}</textarea></div>
    <div style="display:flex; gap:8px;">
      ${isNew ? `<button class="btn btn-sm" id="ppCancel">Отменить</button>` : `<button class="btn btn-sm btn-danger" id="ppDelete">Удалить</button>`}
      <button class="btn btn-sm btn-primary" id="ppDone" style="margin-left:auto;">Готово</button>
    </div>
  </div>`;
  panel.classList.add('open');
  const upd = ()=> drawMapPaths(m);
  document.getElementById('ppColor').addEventListener('input', (e)=>{ p.color = e.target.value; upd(); });
  const widthI = document.getElementById('ppWidth');
  widthI.addEventListener('input', ()=>{ p.width = Number(widthI.value); document.getElementById('ppWidthVal').textContent = Number(widthI.value).toFixed(2); upd(); });
  document.querySelectorAll('#ppStyleToggle button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      p.dashed = btn.dataset.style === 'dashed';
      document.querySelectorAll('#ppStyleToggle button').forEach(b=>b.classList.toggle('btn-primary', b===btn));
      upd();
    });
  });
  document.getElementById('ppName').addEventListener('input', (e)=>{ p.name = e.target.value; });
  document.getElementById('ppDesc').addEventListener('input', (e)=>{ p.desc = e.target.value; });
  const finish = ()=>{
    const name = (p.name||'').trim();
    if(!name){ showToast('Введите название пути'); return; }
    p.name = name;
    queueSave(); hideMapSidePanel(); refreshMapEditor();
  };
  document.getElementById('ppDone').addEventListener('click', finish);
  if(isNew){
    document.getElementById('ppCancel').addEventListener('click', ()=>{
      m.paths = (m.paths||[]).filter(x=>x.id!==p.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  } else {
    document.getElementById('ppDelete').addEventListener('click', ()=>{
      m.paths = (m.paths||[]).filter(x=>x.id!==p.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  }
}
function deleteMapPath(mapId, pathId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  m.paths = (m.paths||[]).filter(p=>p.id!==pathId);
  queueSave(); refreshMapEditor();
}

// Small inline line-icon set for the map editor toolbar (same shapes as Tabler Icons,
// vendored as inline SVG so nothing depends on an external icon-font CDN — works
// offline, on GitHub Pages, or anywhere else this file is opened).
const MAP_UI_ICONS = {
  'map-pin': '<path d="M12 21c-4-4.5-6-7.5-6-11a6 6 0 0 1 12 0c0 3.5-2 6.5-6 11z"/><circle cx="12" cy="10" r="2.3"/>',
  'typography': '<path d="M4 20l3 0"/><path d="M14 20l7 0"/><path d="M6.9 15l6.9 0"/><path d="M10.2 6.3l5.8 13.7"/><path d="M5 20l6 -16l2 0l7 16"/>',
  'route': '<path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4"/><path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5"/>',
  'minus': '<path d="M5 12l14 0"/>',
  'plus': '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  'refresh': '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  'maximize': '<polyline points="16 4 20 4 20 8"/><line x1="14" y1="10" x2="20" y2="4"/><polyline points="8 20 4 20 4 16"/><line x1="4" y1="20" x2="10" y2="14"/><polyline points="16 20 20 20 20 16"/><line x1="14" y1="14" x2="20" y2="20"/><polyline points="8 4 4 4 4 8"/><line x1="4" y1="4" x2="10" y2="10"/>',
  'x': '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  'stack-2': '<polyline points="12 4 4 8 12 12 20 8 12 4"/><polyline points="4 12 12 16 20 12"/><polyline points="4 16 12 20 20 16"/>',
  'chevron-down': '<path d="M6 9l6 6l6 -6"/>',
  'eye': '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>',
};
function uiIcon(name, size){
  size = size || 16;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-3px;">${MAP_UI_ICONS[name]||''}</svg>`;
}

const MARKER_ICONS = [
  ['city','Город (средневековый)'],
  ['city_modern','Город (современный)'],
  ['capital','Столица'],
  ['town','Городок'],
  ['hamlet','Хутор'],
  ['colony','Колония'],
  ['border_town','Пограничный город'],
  ['village','Деревня / поселение'],
  ['abandoned_settlement','Заброшенное поселение'],
  ['castle','Замок / крепость'],
  ['fortress','Крепость (укрепление)'],
  ['fort','Форт'],
  ['palace','Дворец'],
  ['royal_palace','Королевский дворец'],
  ['residence','Резиденция'],
  ['town_hall','Ратуша'],
  ['administrative_center','Административный центр'],
  ['council','Совет'],
  ['embassy','Посольство'],
  ['court','Двор / суд'],
  ['tower','Башня'],
  ['city_wall','Городская стена'],
  ['gate','Городские ворота'],
  ['barracks','Казармы'],
  ['prison','Тюрьма'],
  ['lighthouse','Маяк'],
  ['shipyard','Верфь'],
  ['warehouse','Склад'],
  ['market','Рынок'],
  ['library','Библиотека / академия'],
  ['temple','Храм / святилище'],
  ['monastery','Монастырь'],
  ['shrine','Святилище (малое)'],
  ['cathedral','Собор'],
  ['chapel','Часовня'],
  ['holy_place','Святое место'],
  ['pilgrimage_site','Место паломничества'],
  ['catacombs','Катакомбы'],
  ['cemetery','Кладбище'],
  ['forest','Лес / чаща'],
  ['ancient_forest','Древний лес'],
  ['grove','Роща'],
  ['mountain','Горы / вершина'],
  ['volcano','Вулкан'],
  ['cave','Пещера'],
  ['pass','Перевал'],
  ['mine','Шахта / рудник'],
  ['swamp','Болото'],
  ['desert','Пустыня'],
  ['oasis','Оазис'],
  ['waterfall','Водопад'],
  ['spring','Источник'],
  ['river','Река / поток'],
  ['lake','Озеро / водоём'],
  ['bay','Залив'],
  ['bridge','Мост'],
  ['island','Остров'],
  ['road','Дорога'],
  ['crossroads','Перекрёсток'],
  ['ford','Брод'],
  ['signpost','Указатель'],
  ['caravan_route','Караванный путь'],
  ['campsite','Стоянка'],
  ['resting_spot','Место отдыха'],
  ['resting_place','Место привала'],
  ['inn','Постоялый двор'],
  ['caravanserai','Караван-сарай'],
  ['meeting_place','Место встречи'],
  ['port','Порт / гавань'],
  ['fishing_port','Рыбацкий порт'],
  ['military_port','Военный порт'],
  ['ship','Корабль / судно'],
  ['trade_center','Торговый центр'],
  ['trade_post','Торговый пост'],
  ['guild','Гильдия'],
  ['shop','Лавка'],
  ['customs','Таможня'],
  ['bank','Банк'],
  ['mint','Монетный двор'],
  ['fair','Ярмарка'],
  ['camp','Лагерь'],
  ['military_camp','Военный лагерь'],
  ['outpost','Аванпост'],
  ['checkpoint','Блокпост'],
  ['arsenal','Арсенал'],
  ['battlefield','Поле боя'],
  ['siege_site','Место осады'],
  ['ruins','Руины / древнее место'],
  ['battle','Битва / конфликт'],
  ['grave','Могила / кладбище'],
  ['assassination','Покушение'],
  ['birth','Рождение'],
  ['coronation','Коронация'],
  ['rebellion','Восстание'],
  ['treaty','Договор'],
  ['disaster','Катастрофа'],
  ['crime_scene','Место преступления'],
  ['danger','Опасность'],
  ['magic','Магия / аномалия'],
  ['magic_place','Магическое место'],
  ['anomaly','Аномалия'],
  ['cursed_place','Проклятое место'],
  ['artifact_site','Место артефакта'],
  ['secret','Тайна / секрет'],
  ['secret_place','Тайное место'],
  ['treasure','Сокровище'],
  ['lair','Логово'],
  ['bandit_camp','Лагерь бандитов'],
  ['monster_lair','Логово монстра'],
  ['person','Персонаж / встреча'],
  ['creature','Существо (жуткое)'],
  ['beast','Животное / зверь'],
  ['portal','Портал / проход'],
  ['landmark','Ориентир'],
  ['other','Другое']
];
const MARKER_ICON_LABELS = Object.fromEntries(MARKER_ICONS);

// Icons grouped by category so the picker never dumps all 32+ icons into one
// giant list — the person picks a category first, then only sees icons that
// belong to it.
const MARKER_ICON_CATEGORIES = [
  { key:'settlements', label:'Поселения',            icons:['city','city_modern','town','hamlet','colony','border_town','village','island','abandoned_settlement'] },
  { key:'buildings',   label:'Сооружения',            icons:['castle','fortress','fort','library','ruins','tower','city_wall','gate','barracks','prison','lighthouse','shipyard','warehouse','market'] },
  { key:'nature',      label:'Природа',               icons:['forest','ancient_forest','grove','mountain','volcano','cave','pass','mine','swamp','desert','oasis','waterfall','spring','river','lake','bay'] },
  { key:'travel',      label:'Пути и путешествия',    icons:['signpost','road','crossroads','ford','bridge','caravan_route','campsite','resting_spot','resting_place','inn','caravanserai','meeting_place','port','fishing_port','ship','camp'] },
  { key:'trade',       label:'Торговля и ремесло',    icons:['treasure','trade_center','trade_post','guild','shop','customs','bank','mint','fair'] },
  { key:'military',    label:'Военное',               icons:['battle','danger','military_camp','outpost','checkpoint','arsenal','battlefield','siege_site','military_port'] },
  { key:'religion',    label:'Религия',                icons:['temple','magic','monastery','shrine','cathedral','chapel','holy_place','pilgrimage_site','catacombs','cemetery'] },
  { key:'power',       label:'Власть',                icons:['capital','palace','royal_palace','residence','town_hall','administrative_center','council','embassy','court'] },
  { key:'events',      label:'События',                icons:['grave','secret','assassination','birth','coronation','rebellion','treaty','disaster','crime_scene'] },
  { key:'special',     label:'Особые',                icons:['person','creature','beast','portal','landmark','magic_place','anomaly','cursed_place','artifact_site','secret_place','lair','bandit_camp','monster_lair','other'] },
];
const MARKER_ICON_TO_CATEGORY = {};
MARKER_ICON_CATEGORIES.forEach(cat=>{ cat.icons.forEach(key=>{ MARKER_ICON_TO_CATEGORY[key] = cat.key; }); });
function iconCategoryOf(iconKey){ return MARKER_ICON_TO_CATEGORY[iconKey] || 'other'; }

const MARKER_COLORS = {
  city:'var(--gold)', capital:'var(--gold)', village:'var(--teal)', castle:'var(--gold)', temple:'var(--violet)',
  forest:'var(--teal)', mountain:'var(--gray)', river:'#6a8caf', lake:'#6a8caf', port:'#6a8caf', city_modern:'var(--gray)',
  volcano:'#d17a3d', library:'var(--violet)',
  cave:'var(--gray)', bridge:'#7f92a8', island:'var(--teal)', desert:'#d9b25f', signpost:'#8f97a6', ship:'#6a8caf',
  camp:'var(--rose)', ruins:'var(--gray)', battle:'var(--gray)', grave:'var(--gray)',
  danger:'var(--thread)', magic:'var(--violet)', secret:'var(--rose)', treasure:'var(--gold)',
  person:'var(--teal)', creature:'var(--thread)', beast:'#e8c93b', portal:'var(--violet)', landmark:'var(--gold)',
  other:'var(--gray)',
  town:'var(--teal)', hamlet:'var(--teal)', colony:'var(--teal)', border_town:'var(--gray)', abandoned_settlement:'var(--gray)',
  fortress:'var(--gold)', fort:'var(--thread)', palace:'var(--gold)', royal_palace:'var(--gold)', residence:'var(--gold)',
  town_hall:'var(--gold)', administrative_center:'var(--gold)', council:'var(--gold)', embassy:'var(--gold)', court:'var(--gold)',
  tower:'var(--gray)', city_wall:'var(--gray)', gate:'var(--gray)', barracks:'var(--thread)', prison:'var(--gray)',
  lighthouse:'#6a8caf', shipyard:'#6a8caf', warehouse:'var(--gray)', market:'var(--gold)',
  monastery:'var(--violet)', shrine:'var(--violet)', cathedral:'var(--violet)', chapel:'var(--violet)',
  holy_place:'var(--violet)', pilgrimage_site:'var(--violet)', catacombs:'var(--gray)', cemetery:'var(--gray)',
  ancient_forest:'var(--teal)', grove:'var(--teal)', pass:'var(--gray)', mine:'var(--gray)', swamp:'var(--teal)',
  oasis:'#d9b25f', waterfall:'#6a8caf', spring:'#6a8caf', bay:'#6a8caf',
  road:'var(--gray)', crossroads:'var(--gray)', ford:'#6a8caf', caravan_route:'var(--gray)',
  campsite:'var(--rose)', resting_spot:'var(--rose)', resting_place:'var(--rose)', inn:'var(--rose)',
  caravanserai:'var(--rose)', meeting_place:'var(--teal)',
  fishing_port:'#6a8caf', military_port:'var(--thread)',
  trade_center:'var(--gold)', trade_post:'var(--gold)', guild:'var(--gold)', shop:'var(--gold)',
  customs:'var(--gray)', bank:'var(--gold)', mint:'var(--gold)', fair:'var(--gold)',
  military_camp:'var(--thread)', outpost:'var(--thread)', checkpoint:'var(--thread)', arsenal:'var(--thread)',
  battlefield:'var(--thread)', siege_site:'var(--thread)',
  assassination:'var(--thread)', birth:'var(--rose)', coronation:'var(--gold)', rebellion:'var(--thread)',
  treaty:'var(--gold)', disaster:'var(--thread)', crime_scene:'var(--thread)',
  magic_place:'var(--violet)', anomaly:'var(--violet)', cursed_place:'var(--violet)', artifact_site:'var(--gold)',
  secret_place:'var(--rose)', lair:'var(--thread)', bandit_camp:'var(--thread)', monster_lair:'var(--thread)',
};

const MARKER_SVG = {
  // === СУЩЕСТВУЮЩИЕ ИКОНКИ ===
  city: `<svg viewBox="-2 -2 28 28"><path d="M2 21V13L5.5 9L9 13V21Z" fill="currentColor" stroke="none"/><path d="M9 21V7L12 3L15 7V21Z" fill="currentColor" stroke="none"/><path d="M15 21V12L18.5 8L22 12V21Z" fill="currentColor" stroke="none"/><rect x="11" y="10" width="2" height="2" fill="var(--marker-color)" stroke="none"/><rect x="2" y="21" width="20" height="1.4" fill="currentColor" stroke="none"/></svg>`,
  city_modern: `<svg viewBox="-2 -2 28 28"><rect x="2" y="13" width="5" height="8" fill="currentColor" stroke="none"/><rect x="9" y="5" width="6" height="16" fill="currentColor" stroke="none"/><rect x="16" y="10" width="5" height="11" fill="currentColor" stroke="none"/><rect x="11" y="8" width="2" height="2" fill="var(--marker-color)" stroke="none"/><rect x="11" y="12" width="2" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  village: `<svg viewBox="-2 -2 28 28"><rect x="15.3" y="6.3" width="2" height="4.2" fill="currentColor" stroke="none"/><path d="M16.3 6c-0.6-0.8-0.6-1.6 0-2.4s0.6-1.6 0-2.4" fill="none" stroke-width="1.4"/><path d="M3 12 12 4 21 12Z" fill="currentColor" stroke="none"/><rect x="5" y="12" width="14" height="9" fill="currentColor" stroke="none"/><rect x="7" y="14.7" width="2.6" height="2.6" fill="var(--marker-color)" stroke="none"/><rect x="10.2" y="15.3" width="3.6" height="5.7" fill="var(--marker-color)" stroke="none"/></svg>`,
  castle: `<svg viewBox="-2 -2 28 28"><rect x="2" y="7" width="6" height="14" fill="currentColor" stroke="none"/><rect x="16" y="7" width="6" height="14" fill="currentColor" stroke="none"/><rect x="8" y="11" width="8" height="10" fill="currentColor" stroke="none"/><rect x="2" y="4" width="2.6" height="3" fill="currentColor" stroke="none"/><rect x="5.4" y="4" width="2.6" height="3" fill="currentColor" stroke="none"/><rect x="16" y="4" width="2.6" height="3" fill="currentColor" stroke="none"/><rect x="19.4" y="4" width="2.6" height="3" fill="currentColor" stroke="none"/><rect x="8.4" y="9" width="2.6" height="2" fill="currentColor" stroke="none"/><rect x="13" y="9" width="2.6" height="2" fill="currentColor" stroke="none"/><path d="M9.5 21V16A2.5 2.5 0 0 1 14.5 16V21Z" fill="var(--marker-color)" stroke="none"/></svg>`,
  temple: `<svg viewBox="-2 -2 28 28"><path d="M2 10L12 2L22 10Z" fill="currentColor" stroke="none"/><rect x="2" y="10" width="20" height="2" fill="currentColor" stroke="none"/><rect x="4" y="12" width="2.5" height="8" fill="currentColor" stroke="none"/><rect x="8.5" y="12" width="2.5" height="8" fill="currentColor" stroke="none"/><rect x="13" y="12" width="2.5" height="8" fill="currentColor" stroke="none"/><rect x="17.5" y="12" width="2.5" height="8" fill="currentColor" stroke="none"/><rect x="2" y="20" width="20" height="2" fill="currentColor" stroke="none"/></svg>`,
  forest: `<svg viewBox="-2 -2 28 28"><path d="M12 2L18 11H15L20 18H14V22H10V18H4L9 11H6Z" fill="currentColor" stroke="none"/></svg>`,
  mountain: `<svg viewBox="-2 -2 28 28"><path d="M2 21 9 8 13 15 15 11 21 21Z" fill="currentColor" stroke="none"/><path d="M9 8 11.2 11.5 7.4 11.5Z" fill="var(--marker-color)" stroke="none"/></svg>`,
  volcano: `<svg viewBox="-2 -2 28 28"><path d="M2 20 9 8 12 13 15 8 22 20Z" fill="currentColor" stroke="none"/><path d="M12 2C10.7 3.6 10.7 5.2 12 6.8C13.3 5.2 13.3 3.6 12 2Z" fill="currentColor" stroke="none"/></svg>`,
  cave: `<svg viewBox="-2 -2 28 28"><path d="M3 21H21V12A9 9 0 0 0 3 12Z" fill="currentColor" stroke="none"/><path d="M8 21H16V13.5A4 5 0 0 0 8 13.5Z" fill="var(--marker-color)" stroke="none"/></svg>`,
  desert: `<svg viewBox="-2 -2 28 28"><circle cx="17.5" cy="6" r="2.4" fill="currentColor" stroke="none"/><path d="M6.5 19V8"/><path d="M6.5 13c-1.6 0-2.6-1-2.6-2.6V8"/><path d="M6.5 11c1.6 0 2.6-1 2.6-2.6V6"/><path d="M2 17c2.5-1.5 5-1.5 7.5 0s5 1.5 7.5 0 5-1.5 7.5 0" stroke-width="1.6"/><path d="M2 20.3c2.5-1.5 5-1.5 7.5 0s5 1.5 7.5 0 5-1.5 7.5 0" stroke-width="1.6"/></svg>`,
  river: `<svg viewBox="-2 -2 28 28"><path d="M2 9C6 5 9 13 13 9C17 5 20 13 22 10V15C19 18 16 10 12 14C8 18 5 10 2 14Z" fill="currentColor" stroke="none"/></svg>`,
  lake: `<svg viewBox="-2 -2 28 28"><path d="M2 12C1.5 6 6.5 2 12 2S22.5 6 22 12C21.5 17 16.5 20.5 12 20.5S2.5 17 2 12Z" fill="currentColor" stroke="none"/><path d="M4 9.7C6 11.7 8 11.7 10 9.7C12 7.7 14 7.7 16 9.7C18 11.7 20 11.7 22 9.7" fill="none" stroke="var(--marker-color)" stroke-width="1.8"/><path d="M4 13.3C6 15.3 8 15.3 10 13.3C12 11.3 14 11.3 16 13.3C18 15.3 20 15.3 22 13.3" fill="none" stroke="var(--marker-color)" stroke-width="1.8"/></svg>`,
  bridge: `<svg viewBox="-2 -2 28 28"><path d="M1 17C1 9 23 9 23 17Z" fill="currentColor" stroke="none"/><path d="M5 17C5 12 19 12 19 17Z" fill="var(--marker-color)" stroke="none"/><rect x="1" y="16" width="22" height="3" rx="1" fill="currentColor" stroke="none"/></svg>`,
  island: `<svg viewBox="-2 -2 28 28"><path d="M12 21C11.4 17 11.4 14 12 12" fill="none" stroke-width="2"/><path d="M12 12C7 9.5 3 5.5 1 0.5C7 2.5 11 7 12 12Z" fill="currentColor" stroke="none"/><path d="M12 12C17 9.5 21 5.5 23 0.5C17 2.5 13 7 12 12Z" fill="currentColor" stroke="none"/><path d="M12 12C9 8 7.5 4 8.5 0C11 3 12 7.5 12 12Z" fill="currentColor" stroke="none"/><path d="M12 12C15 8 16.5 4 15.5 0C13 3 12 7.5 12 12Z" fill="currentColor" stroke="none"/><path d="M1 21.5Q6 18 11 21.5T21 21.5" fill="none" stroke-width="1.8"/></svg>`,
  signpost: `<svg viewBox="-2 -2 28 28"><path d="M2 7H19L23 12 19 17H2Z" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.6" fill="var(--marker-color)" stroke="none"/></svg>`,
  library: `<svg viewBox="-2 -2 28 28"><path d="M12 5C9 3.3 5.5 2.8 2 3.7V17C5.5 16.1 9 16.6 12 18.3C15 16.6 18.5 16.1 22 17V3.7C18.5 2.8 15 3.3 12 5Z" fill="currentColor" stroke="none"/><rect x="11.2" y="5" width="1.6" height="13.3" fill="var(--marker-color)" stroke="none"/></svg>`,
  port: `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.6"/><path d="M12 7.6V20"/><path d="M8.5 9.5H15.5"/><path d="M4 13a8 8 0 0 0 16 0"/><path d="M4 13V10.5"/><path d="M20 13V10.5"/></svg>`,
  camp: `<svg viewBox="-2 -2 28 28"><path d="M12 5 21 20H3Z" fill="currentColor" stroke="none"/><path d="M9.7 20 12 13.3 14.3 20Z" fill="var(--marker-color)" stroke="none"/><path d="M3 20 1 21.6" fill="none" stroke-width="1.7"/><path d="M21 20 23 21.6" fill="none" stroke-width="1.7"/></svg>`,
  ship: `<svg viewBox="-2 -2 28 28"><path d="M3 15L21 15L18 20L6 20Z" fill="currentColor" stroke="none"/><rect x="11" y="4" width="2" height="12" fill="currentColor" stroke="none"/><path d="M13 5L13 14L20 12Z" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.6" fill="var(--marker-color)" stroke="none"/></svg>`,
  ruins: `<svg viewBox="-2 -2 28 28"><path d="M7.2 9 8.2 6.5 8.8 8 9.6 6.8 11.2 9V20H7.2Z" fill="currentColor" stroke="none"/><path d="M13.7 13 14.5 11 15.2 12.3 16 10.8 17.2 13V20H13.7Z" fill="currentColor" stroke="none"/><rect x="6.5" y="20" width="11" height="1.3" rx="0.2" fill="currentColor" stroke="none"/></svg>`,
  battle: `<svg viewBox="-2 -2 28 28"><ellipse cx="12" cy="19.6" rx="7.6" ry="1.5" fill="currentColor" stroke="none"/><path d="M10.3 9.3H13.7L12.7 17.5L12 19.2L11.3 17.5Z" fill="currentColor" stroke="none"/><rect x="7.6" y="7.4" width="8.8" height="1.8" rx="0.6" fill="currentColor" stroke="none"/><rect x="11" y="4.2" width="2" height="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  grave: `<svg viewBox="-2 -2 28 28"><path d="M5 21V10A7 7 0 0 1 19 10V21Z" fill="currentColor" stroke="none"/><rect x="11" y="6" width="2" height="6" fill="var(--marker-color)" stroke="none"/><rect x="9" y="8" width="6" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  danger: `<svg viewBox="-2 -2 28 28"><path d="M12 2.5C7 2.5 4 6 4 10.5c0 3 1.5 4.8 3 6.3V20h10v-3.2c1.5-1.5 3-3.3 3-6.3C20 6 17 2.5 12 2.5Z"/><path d="M8.3 9.3 9.6 10.6 8.3 11.9 7 10.6Z" fill="currentColor"/><path d="M15.7 9.3 17 10.6 15.7 11.9 14.4 10.6Z" fill="currentColor"/><path d="M12 12.6l-1.3 2.3h2.6Z" fill="currentColor"/><path d="M8.5 20v1.7M10.5 20v1.7M12 20v1.7M13.5 20v1.7M15.5 20v1.7"/><path d="M12.3 3 11.2 5.8 12.7 7.6 11.5 9.6"/></svg>`,
  magic: `<svg viewBox="-2 -2 28 28"><path d="M10.5 5L12.2 10.3L17.5 12L12.2 13.7L10.5 19L8.8 13.7L3.5 12L8.8 10.3Z" fill="currentColor" stroke="none"/><path d="M17.5 5L18.2 7.3L20.5 8L18.2 8.7L17.5 11L16.8 8.7L14.5 8L16.8 7.3Z" fill="currentColor" stroke="none"/></svg>`,
  secret: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="9" r="4" fill="currentColor" stroke="none"/><path d="M9.7 12L8 20H16L14.3 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r="1.6" fill="var(--marker-color)" stroke="none"/></svg>`,
  treasure: `<svg viewBox="-2 -2 28 28"><path d="M3 10 5 5H19L21 10Z" fill="currentColor" stroke="none"/><rect x="3" y="10" width="18" height="9" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="13.5" width="18" height="1.6" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="12.5" width="3" height="3.5" rx="0.6" fill="var(--marker-color)" stroke="none"/></svg>`,
  person: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="7" r="3.6" fill="currentColor" stroke="none"/><path d="M4.5 21C4.5 15.8 7.8 13 12 13S19.5 15.8 19.5 21Z" fill="currentColor" stroke="none"/></svg>`,
  creature: `<svg viewBox="-2 -2 28 28"><path d="M5.5 4 6.3 5.3 5.2 6.3 6.1 7.3Q7.5 13 5 19"/><path d="M11 2.5 11.8 3.8 10.7 4.8 11.6 5.8Q13 13 10.5 21"/><path d="M16.5 4 17.3 5.3 16.2 6.3 17.1 7.3Q18.5 13 16 19"/></svg>`,
  beast: `<svg viewBox="-2 -2 28 28"><ellipse cx="12" cy="16" rx="5" ry="4.3" fill="currentColor" stroke="none"/><ellipse cx="4.7" cy="10" rx="1.7" ry="2.7" fill="currentColor" stroke="none" transform="rotate(-32 4.7 10)"/><ellipse cx="9.2" cy="4.3" rx="1.8" ry="2.8" fill="currentColor" stroke="none" transform="rotate(-10 9.2 4.3)"/><ellipse cx="15.8" cy="4.3" rx="1.8" ry="2.8" fill="currentColor" stroke="none" transform="rotate(10 15.8 4.3)"/><ellipse cx="20.3" cy="10" rx="1.7" ry="2.7" fill="currentColor" stroke="none" transform="rotate(32 20.3 10)"/></svg>`,
  portal: `<svg viewBox="-2 -2 28 28"><ellipse cx="12" cy="12" rx="8" ry="9" fill="currentColor" stroke="none"/><ellipse cx="14" cy="12.5" rx="5.5" ry="7.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  landmark: `<svg viewBox="-2 -2 28 28"><rect x="10.2" y="2" width="1.6" height="20" fill="currentColor" stroke="none"/><path d="M11.8 3L21 6.5 11.8 10Z" fill="currentColor" stroke="none"/></svg>`,
  other: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.3" fill="var(--marker-color)" stroke="none"/><rect x="11" y="11" width="2" height="6" rx="1" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === 🏙 ПОСЕЛЕНИЯ ===
  capital: `<svg viewBox="-2 -2 28 28"><path d="M3 8L7 11L12 5L17 11L21 8L19.4 18H4.6Z" fill="currentColor" stroke="none"/><rect x="5.5" y="18.5" width="13" height="2" rx="0.5" fill="currentColor" stroke="none"/></svg>`,
  town: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="4.5" height="7" fill="currentColor" stroke="none"/><rect x="8.5" y="10" width="4.5" height="11" fill="currentColor" stroke="none"/><rect x="15" y="6" width="4.5" height="15" fill="currentColor" stroke="none"/><rect x="21.5" y="12" width="3" height="9" fill="currentColor" stroke="none"/><rect x="2" y="21" width="23" height="1.2" fill="currentColor" stroke="none"/><rect x="11" y="14" width="2" height="3" fill="var(--marker-color)" stroke="none"/><rect x="17.5" y="10" width="1.5" height="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  hamlet: `<svg viewBox="-2 -2 28 28"><path d="M3 14L12 4L21 14Z" fill="currentColor" stroke="none"/><rect x="5" y="14" width="4" height="7" fill="currentColor" stroke="none"/><rect x="13" y="14" width="4" height="7" fill="currentColor" stroke="none"/><rect x="2" y="21" width="18" height="1.2" fill="currentColor" stroke="none"/><rect x="7" y="16" width="1.6" height="2" fill="var(--marker-color)" stroke="none"/><rect x="15" y="17" width="1.6" height="2" fill="var(--marker-color)" stroke="none"/><path d="M18.5 13L21.5 15.5L20.5 18.5L17.5 16L18.5 13Z" fill="currentColor" stroke="none"/></svg>`,
  colony: `<svg viewBox="-2 -2 28 28"><path d="M6 10L12 4L18 10Z" fill="currentColor" stroke="none"/><rect x="3" y="10" width="18" height="9" fill="currentColor" stroke="none"/><rect x="3" y="10" width="18" height="1.4" fill="var(--marker-color)" stroke="none"/><rect x="8" y="12" width="1.6" height="2.4" fill="var(--marker-color)" stroke="none"/><rect x="12" y="14" width="1.6" height="2.4" fill="var(--marker-color)" stroke="none"/><rect x="16" y="12" width="1.6" height="2.4" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="11.5" r="1" fill="var(--marker-color)" stroke="none"/></svg>`,
  border_town: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="5" height="7" fill="currentColor" stroke="none"/><rect x="9" y="9" width="5" height="12" fill="currentColor" stroke="none"/><rect x="16" y="12" width="5" height="9" fill="currentColor" stroke="none"/><rect x="2" y="21" width="19" height="1.2" fill="currentColor" stroke="none"/><rect x="11" y="13" width="1.8" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="18.5" y="16" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><path d="M21.5 7L23.5 9V11L21.5 13V7Z" fill="currentColor" stroke="none"/></svg>`,

  // === 🏛 СООРУЖЕНИЯ ===
  palace: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="20" height="8" rx="1" fill="currentColor" stroke="none"/><path d="M7 14V10C7 8.5 8.5 7 10 7H14C15.5 7 17 8.5 17 10V14" fill="currentColor" stroke="none"/><path d="M10 7V2L12 4L14 2V7" fill="currentColor" stroke="none"/><rect x="8" y="11" width="1.5" height="1.5" fill="var(--marker-color)" stroke="none"/><rect x="14.5" y="11" width="1.5" height="1.5" fill="var(--marker-color)" stroke="none"/><rect x="11" y="17" width="2" height="3.5" rx="0.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  town_hall: `<svg viewBox="-2 -2 28 28"><rect x="2" y="13" width="20" height="8" fill="currentColor" stroke="none"/><path d="M2 13L12 5L22 13Z" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r="1.6" fill="var(--marker-color)" stroke="none"/><rect x="6" y="15" width="2.4" height="2.4" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="15" width="2.4" height="2.4" fill="var(--marker-color)" stroke="none"/><rect x="15" y="15" width="2.4" height="2.4" fill="var(--marker-color)" stroke="none"/></svg>`,
  tower: `<svg viewBox="-2 -2 28 28"><rect x="7" y="4" width="10" height="17" fill="currentColor" stroke="none"/><rect x="4" y="3" width="16" height="2.5" rx="0.5" fill="currentColor" stroke="none"/><path d="M4 12L2 10V8L4 6" fill="none" stroke-width="1.6"/><path d="M20 12L22 10V8L20 6" fill="none" stroke-width="1.6"/><rect x="8" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="13.5" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="5.5" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,
  city_wall: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="20" height="2" fill="currentColor" stroke="none"/><rect x="2" y="11" width="20" height="2" fill="currentColor" stroke="none"/><rect x="8" y="9" width="2" height="5" fill="currentColor" stroke="none"/><rect x="14" y="9" width="2" height="5" fill="currentColor" stroke="none"/><path d="M4 11L2 9V7" fill="none" stroke-width="1.6"/><path d="M20 11L22 9V7" fill="none" stroke-width="1.6"/><rect x="6" y="13" width="1" height="5" fill="var(--marker-color)" stroke="none"/><rect x="17" y="13" width="1" height="5" fill="var(--marker-color)" stroke="none"/></svg>`,
  gate: `<svg viewBox="-2 -2 28 28"><rect x="2" y="8" width="20" height="13" fill="currentColor" stroke="none"/><path d="M7 8V3H17V8" fill="currentColor" stroke="none"/><rect x="7" y="8" width="10" height="6" rx="0.5" fill="var(--marker-color)" stroke="none"/><rect x="2" y="15" width="8" height="1.5" fill="currentColor" stroke="none"/><rect x="14" y="15" width="8" height="1.5" fill="currentColor" stroke="none"/></svg>`,
  fortress: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="6" height="13" fill="currentColor" stroke="none"/><rect x="15" y="8" width="6" height="13" fill="currentColor" stroke="none"/><rect x="6" y="11" width="12" height="10" fill="currentColor" stroke="none"/><rect x="3" y="5" width="2.4" height="3" fill="currentColor" stroke="none"/><rect x="6.4" y="5" width="2.4" height="3" fill="currentColor" stroke="none"/><rect x="15" y="5" width="2.4" height="3" fill="currentColor" stroke="none"/><rect x="18.4" y="5" width="2.4" height="3" fill="currentColor" stroke="none"/><rect x="6" y="15" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="16.5" y="15" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><path d="M12 21V17A1.5 1.5 0 0 1 13.5 15.5A1.5 1.5 0 0 1 15 17V21" fill="var(--marker-color)" stroke="none"/></svg>`,
  barracks: `<svg viewBox="-2 -2 28 28"><rect x="2" y="10" width="5" height="11" fill="currentColor" stroke="none"/><rect x="9" y="10" width="5" height="11" fill="currentColor" stroke="none"/><rect x="16" y="10" width="5" height="11" fill="currentColor" stroke="none"/><rect x="2" y="6" width="19" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="4" y="13" width="1.5" height="1.8" fill="var(--marker-color)" stroke="none"/><rect x="11" y="13" width="1.5" height="1.8" fill="var(--marker-color)" stroke="none"/><rect x="18" y="13" width="1.5" height="1.8" fill="var(--marker-color)" stroke="none"/></svg>`,
  prison: `<svg viewBox="-2 -2 28 28"><rect x="4" y="6" width="16" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="4" y="6" width="16" height="1.5" fill="var(--marker-color)" stroke="none"/><rect x="6" y="9" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="10" y="9" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="14" y="9" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="6" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="10" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="14" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><circle cx="9" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  lighthouse: `<svg viewBox="0 0 24 24"><path d="M9 21L10 7L14 7L15 21Z"/><path d="M10 7L10 4.5L14 4.5L14 7"/><path d="M9.3 4.5L12 2.3L14.7 4.5"/><path d="M9.6 13L14.4 13"/><path d="M9.3 17L14.7 17"/><path d="M11 21L11 18L13 18L13 21"/><path d="M4 21L20 21"/><path d="M7.5 3.5L5 1.5"/><path d="M12 2L12 0.3"/><path d="M16.5 3.5L19 1.5"/></svg>`,
  shipyard: `<svg viewBox="-2 -2 28 28"><path d="M3 18L21 18L19 15L5 15L3 18Z" fill="currentColor" stroke="none"/><rect x="7" y="8" width="10" height="7" fill="currentColor" stroke="none"/><path d="M7 8L12 4L17 8Z" fill="var(--marker-color)" stroke="none"/><rect x="5" y="15" width="14" height="1.5" fill="currentColor" stroke="none"/><path d="M12 14L12 18" stroke-width="1.2" fill="none"/><rect x="2" y="21" width="20" height="1.5" fill="currentColor" stroke="none"/></svg>`,
  warehouse: `<svg viewBox="-2 -2 28 28"><rect x="2" y="8" width="20" height="13" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 8L12 2L22 8Z" fill="currentColor" stroke="none"/><rect x="6" y="12" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="12" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><rect x="15" y="12" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><rect x="12" y="17" width="1.5" height="3" fill="var(--marker-color)" stroke="none"/></svg>`,
  market: `<svg viewBox="-2 -2 28 28"><path d="M2 14L5 10H19L22 14Z" fill="currentColor" stroke="none"/><rect x="2" y="14" width="20" height="7" rx="0.8" fill="currentColor" stroke="none"/><rect x="6" y="16" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="16" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="15" y="16" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="12" r="1" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === 🌲 ПРИРОДА ===
  ancient_forest: `<svg viewBox="-2 -2 28 28"><path d="M12 2L18 11H15L20 18H14V22H10V18H4L9 11H6Z" fill="currentColor" stroke="none"/><path d="M8 6L10 10L6 10Z" fill="var(--marker-color)" stroke="none"/><path d="M16 6L18 10L14 10Z" fill="var(--marker-color)" stroke="none"/><path d="M12 12L14 16L10 16Z" fill="var(--marker-color)" stroke="none"/></svg>`,
  grove: `<svg viewBox="-2 -2 28 28"><path d="M6 8L12 2L18 8Z" fill="currentColor" stroke="none"/><path d="M8 12L14 6L20 12Z" fill="currentColor" stroke="none"/><path d="M4 16L10 10L16 16Z" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,
  pass: `<svg viewBox="-2 -2 28 28"><path d="M2 21L7 12L9 15L12 8L15 15L17 12L22 21Z" fill="currentColor" stroke="none"/><path d="M12 8L14.5 12.5L9.5 12.5Z" fill="var(--marker-color)" stroke="none"/><path d="M6 14L8 17" stroke-width="1.2" fill="none"/><path d="M18 14L16 17" stroke-width="1.2" fill="none"/></svg>`,
  mine: `<svg viewBox="-2 -2 28 28"><path d="M2 21H22V15H16V10H8V15H2Z" fill="currentColor" stroke="none"/><rect x="5" y="15" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><rect x="10" y="15" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><rect x="15" y="15" width="2.5" height="3" fill="var(--marker-color)" stroke="none"/><path d="M4 15L2 12" stroke-width="1.2" fill="none"/><path d="M20 15L22 12" stroke-width="1.2" fill="none"/></svg>`,
  swamp: `<svg viewBox="-2 -2 28 28"><path d="M4 18C6 15 8 17 10 14C12 11 14 13 16 10C18 7 20 9 22 7V21H4Z" fill="currentColor" stroke="none"/><path d="M8 21V18" stroke-width="1.2" fill="none"/><path d="M12 21V15" stroke-width="1.2" fill="none"/><path d="M16 21V13" stroke-width="1.2" fill="none"/><circle cx="6" cy="18" r="0.8" fill="var(--marker-color)" stroke="none"/><circle cx="14" cy="15" r="0.8" fill="var(--marker-color)" stroke="none"/></svg>`,
  oasis: `<svg viewBox="-2 -2 28 28"><ellipse cx="12" cy="14" rx="7" ry="5" fill="currentColor" stroke="none"/><path d="M6 12L8 8L12 6L16 8L18 12Z" fill="currentColor" stroke="none"/><ellipse cx="12" cy="14" rx="3" ry="2" fill="var(--marker-color)" stroke="none"/><path d="M10 12L12 9L14 12Z" fill="currentColor" stroke="none"/></svg>`,
  waterfall: `<svg viewBox="-2 -2 28 28"><path d="M6 4L18 4L12 12Z" fill="currentColor" stroke="none"/><rect x="10" y="12" width="4" height="10" rx="1" fill="currentColor" stroke="none"/><path d="M8 16C10 14 14 14 16 16" stroke-width="1.2" fill="none"/><path d="M8 19C10 17 14 17 16 19" stroke-width="1.2" fill="none"/><path d="M8 22C10 20 14 20 16 22" stroke-width="1.2" fill="none"/><circle cx="12" cy="8" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  spring: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="15" r="6" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="3" fill="var(--marker-color)" stroke="none"/><path d="M8 15L6 10" stroke-width="1.2" fill="none"/><path d="M16 15L18 10" stroke-width="1.2" fill="none"/><path d="M12 9V6" stroke-width="1.2" fill="none"/></svg>`,
  bay: `<svg viewBox="-2 -2 28 28"><path d="M2 14C2 8 6.5 4 12 4S22 8 22 14C22 18 18.5 21 12 21S2 18 2 14Z" fill="currentColor" stroke="none"/><path d="M8 14C8 11 10 9 12 9S16 11 16 14" stroke-width="1.6" fill="none"/><circle cx="12" cy="12.5" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === 🛤 ПУТИ И ПУТЕШЕСТВИЯ ===
  road: `<svg viewBox="-2 -2 28 28"><path d="M2 20L12 4L22 20Z" fill="currentColor" stroke="none"/><path d="M10 14L14 14" stroke="var(--marker-color)" stroke-width="1.5"/><path d="M11 17L13 17" stroke="var(--marker-color)" stroke-width="1.5"/><path d="M6 12L18 12" stroke-width="1" stroke-dasharray="2 2" fill="none" opacity="0.3"/></svg>`,
  crossroads: `<svg viewBox="-2 -2 28 28"><path d="M12 2L12 22" stroke-width="2" fill="none"/><path d="M2 12L22 12" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,
  ford: `<svg viewBox="-2 -2 28 28"><path d="M2 12C6 9 10 12 14 9C18 6 22 9 22 12V16C18 13 14 16 10 13C6 10 2 13 2 16Z" fill="currentColor" stroke="none"/><path d="M8 12L8 16" stroke-width="1" fill="none"/><path d="M16 12L16 16" stroke-width="1" fill="none"/><circle cx="12" cy="12" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  caravan_route: `<svg viewBox="-2 -2 28 28"><path d="M2 18L8 10L14 18L20 10L22 14" stroke="var(--marker-color)" stroke-width="2.5" stroke-dasharray="2 3" fill="none"/><path d="M2 18L8 10L14 18L20 10" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="4" cy="19" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="9.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  campsite: `<svg viewBox="-2 -2 28 28"><path d="M8 20L12 8L16 20Z" fill="currentColor" stroke="none"/><path d="M4 20L8 12L12 20Z" fill="currentColor" stroke="none"/><path d="M12 20L16 12L20 20Z" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  resting_spot: `<svg viewBox="-2 -2 28 28"><path d="M4 16H20L18 12L6 12L4 16Z" fill="currentColor" stroke="none"/><path d="M8 12L12 6L16 12Z" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="9" r="1.2" fill="currentColor" stroke="none"/><path d="M9 20L15 20" stroke-width="1.5" fill="none"/></svg>`,
  inn: `<svg viewBox="-2 -2 28 28"><rect x="3" y="10" width="18" height="11" rx="1" fill="currentColor" stroke="none"/><path d="M3 10L12 4L21 10Z" fill="var(--marker-color)" stroke="none"/><rect x="6" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="9.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="13" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="16.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none"/></svg>`,
  caravanserai: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="18" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="8" width="18" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="6" y="12" width="2.5" height="2" fill="currentColor" stroke="none"/><rect x="10" y="12" width="2.5" height="2" fill="currentColor" stroke="none"/><rect x="14" y="12" width="2.5" height="2" fill="currentColor" stroke="none"/><rect x="18" y="12" width="2.5" height="2" fill="currentColor" stroke="none"/><path d="M3 20L21 20" stroke-width="1.5" fill="none"/></svg>`,
  meeting_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3.5" fill="var(--marker-color)" stroke="none"/><path d="M8 8L6 6" stroke-width="1.5" fill="none"/><path d="M16 8L18 6" stroke-width="1.5" fill="none"/><path d="M8 16L6 18" stroke-width="1.5" fill="none"/><path d="M16 16L18 18" stroke-width="1.5" fill="none"/></svg>`,
  resting_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/><rect x="10" y="12" width="1.5" height="4" rx="0.5" fill="var(--marker-color)" stroke="none"/><rect x="13" y="12" width="1.5" height="4" rx="0.5" fill="var(--marker-color)" stroke="none"/><path d="M12 6V3" stroke-width="1.5" fill="none"/></svg>`,

  // === ⚒ ТОРГОВЛЯ И РЕМЕСЛО ===
  trade_center: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="20" height="7" rx="1" fill="currentColor" stroke="none"/><path d="M2 14L12 7L22 14Z" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="17" r="1.5" fill="var(--marker-color)" stroke="none"/><rect x="10" y="15.5" width="4" height="3" rx="0.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  trade_post: `<svg viewBox="-2 -2 28 28"><rect x="2" y="12" width="8" height="9" rx="0.8" fill="currentColor" stroke="none"/><rect x="14" y="12" width="8" height="9" rx="0.8" fill="currentColor" stroke="none"/><path d="M6 12L12 8L18 12" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,
  guild: `<svg viewBox="-2 -2 28 28"><rect x="3" y="10" width="18" height="11" rx="1" fill="currentColor" stroke="none"/><path d="M3 10L12 4L21 10Z" fill="var(--marker-color)" stroke="none"/><rect x="6" y="13" width="2" height="2.5" fill="currentColor" stroke="none"/><rect x="10" y="13" width="2" height="2.5" fill="currentColor" stroke="none"/><rect x="14" y="13" width="2" height="2.5" fill="currentColor" stroke="none"/><rect x="18" y="13" width="2" height="2.5" fill="currentColor" stroke="none"/></svg>`,
  shop: `<svg viewBox="-2 -2 28 28"><rect x="2" y="10" width="20" height="11" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 10L7 6H17L22 10Z" fill="currentColor" stroke="none"/><rect x="6" y="13" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="9.5" y="13" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="13" y="13" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="16.5" y="13" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  customs: `<svg viewBox="-2 -2 28 28"><rect x="2" y="10" width="20" height="11" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 10L12 4L22 10Z" fill="var(--marker-color)" stroke="none"/><rect x="6" y="13" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="10.5" y="13" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="15" y="13" width="2.5" height="2.5" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  bank: `<svg viewBox="-2 -2 28 28"><rect x="3" y="10" width="18" height="11" rx="0.8" fill="currentColor" stroke="none"/><path d="M3 10L12 3L21 10Z" fill="currentColor" stroke="none"/><rect x="6" y="14" width="2" height="3.5" fill="var(--marker-color)" stroke="none"/><rect x="10" y="14" width="2" height="3.5" fill="var(--marker-color)" stroke="none"/><rect x="14" y="14" width="2" height="3.5" fill="var(--marker-color)" stroke="none"/><rect x="18" y="14" width="2" height="3.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  mint: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3.5" fill="var(--marker-color)" stroke="none"/><path d="M8 12L11 15L17 9" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  fair: `<svg viewBox="-2 -2 28 28"><path d="M2 14L5 10H19L22 14Z" fill="currentColor" stroke="none"/><rect x="2" y="14" width="20" height="7" rx="0.8" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="17" r="2" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  fishing_port: `<svg viewBox="-2 -2 28 28"><path d="M2 18L6 12L10 18Z" fill="currentColor" stroke="none"/><path d="M8 18L12 10L16 18Z" fill="currentColor" stroke="none"/><path d="M14 18L18 12L22 18Z" fill="currentColor" stroke="none"/><rect x="2" y="18" width="20" height="3" rx="0.5" fill="currentColor" stroke="none"/><circle cx="6" cy="15" r="0.8" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="13" r="0.8" fill="var(--marker-color)" stroke="none"/><circle cx="18" cy="15" r="0.8" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === 🛡 ВОЕННОЕ ===
  fort: `<svg viewBox="-2 -2 28 28"><rect x="4" y="9" width="5" height="12" fill="currentColor" stroke="none"/><rect x="15" y="9" width="5" height="12" fill="currentColor" stroke="none"/><rect x="6" y="12" width="12" height="9" fill="currentColor" stroke="none"/><rect x="4" y="6" width="2" height="3" fill="currentColor" stroke="none"/><rect x="7" y="6" width="2" height="3" fill="currentColor" stroke="none"/><rect x="15" y="6" width="2" height="3" fill="currentColor" stroke="none"/><rect x="18" y="6" width="2" height="3" fill="currentColor" stroke="none"/><rect x="8" y="15" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="14.5" y="15" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  outpost: `<svg viewBox="-2 -2 28 28"><rect x="7" y="8" width="10" height="8" fill="currentColor" stroke="none"/><path d="M3 8L12 3L21 8Z" fill="currentColor" stroke="none"/><rect x="9" y="10" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="13.5" y="10" width="1.5" height="2" fill="var(--marker-color)" stroke="none"/><path d="M12 8L12 16" stroke-width="1.2" fill="none"/></svg>`,
  checkpoint: `<svg viewBox="-2 -2 28 28"><rect x="2" y="10" width="20" height="8" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 10L12 4L22 10Z" fill="currentColor" stroke="none"/><rect x="6" y="13" width="2" height="2" fill="var(--marker-color)" stroke="none"/><rect x="10" y="13" width="2" height="2" fill="var(--marker-color)" stroke="none"/><rect x="14" y="13" width="2" height="2" fill="var(--marker-color)" stroke="none"/><rect x="18" y="13" width="2" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  military_camp: `<svg viewBox="-2 -2 28 28"><path d="M12 4L4 20H20Z" fill="currentColor" stroke="none"/><rect x="5" y="15" width="14" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="8" y="18" width="2" height="3" fill="currentColor" stroke="none"/><rect x="14" y="18" width="2" height="3" fill="currentColor" stroke="none"/><rect x="11" y="13" width="2" height="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  arsenal: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="18" height="13" rx="0.8" fill="currentColor" stroke="none"/><rect x="3" y="8" width="18" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="5" y="12" width="2" height="2" fill="currentColor" stroke="none"/><rect x="9" y="12" width="2" height="2" fill="currentColor" stroke="none"/><rect x="13" y="12" width="2" height="2" fill="currentColor" stroke="none"/><rect x="17" y="12" width="2" height="2" fill="currentColor" stroke="none"/></svg>`,
  battlefield: `<svg viewBox="-2 -2 28 28"><path d="M4 18L10 8L16 18L22 8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="6" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="22" cy="8" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  siege_site: `<svg viewBox="-2 -2 28 28"><rect x="8" y="8" width="8" height="10" fill="currentColor" stroke="none"/><path d="M4 18L8 8L16 8L20 18Z" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="2" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="14" r="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  military_port: `<svg viewBox="-2 -2 28 28"><path d="M3 15L21 15L18 20L6 20Z" fill="currentColor" stroke="none"/><rect x="11" y="4" width="2" height="12" fill="currentColor" stroke="none"/><path d="M13 5L13 14L20 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="9" cy="17" r="1.6" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === ⛪ РЕЛИГИЯ ===
  monastery: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="18" height="13" rx="0.8" fill="currentColor" stroke="none"/><path d="M3 8L12 2L21 8Z" fill="currentColor" stroke="none"/><rect x="5" y="11" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="9.5" y="11" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="14" y="11" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="18.5" y="11" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="6" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  shrine: `<svg viewBox="-2 -2 28 28"><path d="M2 10L12 3L22 10Z" fill="currentColor" stroke="none"/><rect x="4" y="10" width="16" height="2" fill="currentColor" stroke="none"/><rect x="5" y="12" width="3" height="7" fill="currentColor" stroke="none"/><rect x="10" y="12" width="3" height="7" fill="currentColor" stroke="none"/><rect x="15" y="12" width="3" height="7" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  cathedral: `<svg viewBox="-2 -2 28 28"><path d="M4 10L12 2L20 10Z" fill="currentColor" stroke="none"/><rect x="4" y="10" width="16" height="2" fill="currentColor" stroke="none"/><rect x="5" y="12" width="3" height="8" fill="currentColor" stroke="none"/><rect x="9.5" y="12" width="3" height="8" fill="currentColor" stroke="none"/><rect x="14" y="12" width="3" height="8" fill="currentColor" stroke="none"/><rect x="18.5" y="12" width="3" height="8" fill="currentColor" stroke="none"/><path d="M8 12L12 8L16 12Z" fill="var(--marker-color)" stroke="none"/><path d="M10 20L14 20" stroke-width="1.5" fill="none"/></svg>`,
  chapel: `<svg viewBox="-2 -2 28 28"><path d="M6 10L12 3L18 10Z" fill="currentColor" stroke="none"/><rect x="6" y="10" width="12" height="2" fill="currentColor" stroke="none"/><rect x="7" y="12" width="3" height="7" fill="currentColor" stroke="none"/><rect x="12" y="12" width="3" height="7" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  holy_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><path d="M12 4L12 20" stroke-width="1.5" fill="none"/><path d="M4 12L20 12" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  pilgrimage_site: `<svg viewBox="-2 -2 28 28"><path d="M12 2L16 8L22 8L18 14L20 20L12 16L4 20L6 14L2 8L8 8Z" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="2" fill="var(--marker-color)" stroke="none"/><path d="M10 11L14 11" stroke-width="1.2" fill="none"/><path d="M12 9L12 13" stroke-width="1.2" fill="none"/></svg>`,
  catacombs: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="18" height="13" rx="0.8" fill="currentColor" stroke="none"/><path d="M3 8L12 3L21 8Z" fill="currentColor" stroke="none"/><circle cx="8" cy="13" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="13" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="17" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  cemetery: `<svg viewBox="-2 -2 28 28"><rect x="3" y="8" width="18" height="13" rx="0.8" fill="currentColor" stroke="none"/><path d="M8 8L8 21" stroke-width="1.2" fill="none"/><path d="M16 8L16 21" stroke-width="1.2" fill="none"/><path d="M4 13L20 13" stroke-width="1.2" fill="none"/><path d="M4 17L20 17" stroke-width="1.2" fill="none"/><circle cx="8" cy="11" r="1" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="11" r="1" fill="var(--marker-color)" stroke="none"/><circle cx="8" cy="15" r="1" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="15" r="1" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === 👑 ВЛАСТЬ ===
  royal_palace: `<svg viewBox="-2 -2 28 28"><rect x="2" y="14" width="20" height="8" rx="1" fill="currentColor" stroke="none"/><path d="M7 14V9C7 7.5 8.5 6 10 6H14C15.5 6 17 7.5 17 9V14" fill="currentColor" stroke="none"/><path d="M10 6V2L12 4L14 2V6" fill="var(--marker-color)" stroke="none"/><rect x="8" y="11" width="1.5" height="1.5" fill="currentColor" stroke="none"/><rect x="14.5" y="11" width="1.5" height="1.5" fill="currentColor" stroke="none"/><rect x="11" y="17" width="2" height="3.5" rx="0.5" fill="var(--marker-color)" stroke="none"/><path d="M4 22L20 22" stroke-width="1.2" fill="none"/></svg>`,
  residence: `<svg viewBox="-2 -2 28 28"><rect x="3" y="10" width="18" height="11" rx="0.8" fill="currentColor" stroke="none"/><path d="M3 10L12 4L21 10Z" fill="currentColor" stroke="none"/><rect x="6" y="13" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="13" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="15" y="13" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  administrative_center: `<svg viewBox="-2 -2 28 28"><rect x="3" y="10" width="18" height="11" rx="0.8" fill="currentColor" stroke="none"/><path d="M3 10L12 4L21 10Z" fill="currentColor" stroke="none"/><rect x="6" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="15" y="14" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  council: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="8" r="5" fill="currentColor" stroke="none"/><rect x="2" y="14" width="20" height="7" rx="0.8" fill="currentColor" stroke="none"/><rect x="5" y="16" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="9.5" y="16" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="14" y="16" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/><rect x="18.5" y="16" width="2.5" height="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  embassy: `<svg viewBox="-2 -2 28 28"><rect x="2" y="10" width="6" height="11" rx="0.6" fill="currentColor" stroke="none"/><rect x="10" y="10" width="6" height="11" rx="0.6" fill="currentColor" stroke="none"/><rect x="18" y="10" width="4" height="11" rx="0.6" fill="currentColor" stroke="none"/><rect x="2" y="6" width="20" height="3" rx="0.5" fill="currentColor" stroke="none"/><circle cx="6" cy="4" r="1.2" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="4" r="1.2" fill="var(--marker-color)" stroke="none"/></svg>`,
  court: `<svg viewBox="-2 -2 28 28"><rect x="2" y="12" width="20" height="9" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 12L12 5L22 12Z" fill="currentColor" stroke="none"/><rect x="5" y="15" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="9.5" y="15" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="14" y="15" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="18.5" y="15" width="2.5" height="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,

  // === ⚔ СОБЫТИЯ ===
  assassination: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/><path d="M12 6L12 18" stroke-width="2" fill="none"/><path d="M6 12L18 12" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  birth: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3.5" fill="var(--marker-color)" stroke="none"/><path d="M12 12L12 16" stroke-width="1.5" fill="none"/><path d="M10 14L14 14" stroke-width="1.5" fill="none"/></svg>`,
  coronation: `<svg viewBox="-2 -2 28 28"><path d="M6 16L12 6L18 16Z" fill="currentColor" stroke="none"/><rect x="4" y="16" width="16" height="4" rx="0.8" fill="currentColor" stroke="none"/><path d="M4 16L12 10L20 16Z" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="2.5" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  rebellion: `<svg viewBox="-2 -2 28 28"><path d="M2 16L8 8L12 14L16 8L22 16" fill="currentColor" stroke="none"/><rect x="4" y="16" width="16" height="4" rx="0.8" fill="currentColor" stroke="none"/><circle cx="8" cy="11" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="11" r="1.5" fill="var(--marker-color)" stroke="none"/><path d="M12 14L12 20" stroke-width="1.5" fill="none"/></svg>`,
  treaty: `<svg viewBox="-2 -2 28 28"><rect x="2" y="8" width="20" height="12" rx="0.8" fill="currentColor" stroke="none"/><path d="M2 8L12 3L22 8Z" fill="currentColor" stroke="none"/><rect x="6" y="11" width="3.5" height="2.5" fill="var(--marker-color)" stroke="none"/><rect x="18.5" y="11" width="3.5" height="2.5" fill="var(--marker-color)" stroke="none"/><path d="M12 11L12 15" stroke-width="1.5" fill="none"/><path d="M8 15L16 15" stroke-width="1.5" fill="none"/></svg>`,
  disaster: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><path d="M6 18L18 6" stroke-width="2" fill="none"/><path d="M6 6L18 18" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  crime_scene: `<svg viewBox="-2 -2 28 28"><rect x="2" y="6" width="20" height="16" rx="1" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="3" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="14" r="3" fill="var(--marker-color)" stroke="none"/><path d="M6 6L4 4" stroke-width="1.5" fill="none"/><path d="M18 6L20 4" stroke-width="1.5" fill="none"/><path d="M8 12L8 16" stroke-width="1.5" fill="none"/><path d="M16 12L16 16" stroke-width="1.5" fill="none"/></svg>`,

  // === ✦ ОСОБЫЕ ===
  ruins: `<svg viewBox="-2 -2 28 28"><path d="M7.2 9 8.2 6.5 8.8 8 9.6 6.8 11.2 9V20H7.2Z" fill="currentColor" stroke="none"/><path d="M13.7 13 14.5 11 15.2 12.3 16 10.8 17.2 13V20H13.7Z" fill="currentColor" stroke="none"/><rect x="6.5" y="20" width="11" height="1.3" rx="0.2" fill="currentColor" stroke="none"/></svg>`,
  abandoned_settlement: `<svg viewBox="-2 -2 28 28"><path d="M3 12L12 4L21 12Z" fill="currentColor" stroke="none"/><rect x="5" y="12" width="5" height="8" fill="currentColor" stroke="none"/><rect x="14" y="12" width="5" height="8" fill="currentColor" stroke="none"/><rect x="2" y="20" width="20" height="1.2" fill="currentColor" stroke="none"/><path d="M8 14L8 18" stroke-width="1.5" fill="none" opacity="0.5"/><path d="M15 14L15 18" stroke-width="1.5" fill="none" opacity="0.5"/><circle cx="12" cy="7" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  secret_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="10" r="6" fill="currentColor" stroke="none"/><path d="M8 10L12 14L16 10L14 16H10Z" fill="var(--marker-color)" stroke="none"/></svg>`,
  lair: `<svg viewBox="-2 -2 28 28"><path d="M4 18C6 14 8 16 10 12C12 8 14 10 16 6C18 2 20 4 22 0V20H4Z" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="14" cy="8" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="18" cy="4" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  bandit_camp: `<svg viewBox="-2 -2 28 28"><path d="M12 4L6 18H18Z" fill="currentColor" stroke="none"/><rect x="4" y="18" width="16" height="2" rx="0.5" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="1.5" fill="var(--marker-color)" stroke="none"/><circle cx="16" cy="14" r="1.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  monster_lair: `<svg viewBox="-2 -2 28 28"><path d="M4 20L12 4L20 20Z" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="4" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="13" r="2" fill="currentColor" stroke="none"/><path d="M8 20L16 20" stroke-width="1.5" fill="none"/></svg>`,
  cursed_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><path d="M6 6L18 18" stroke-width="2" fill="none"/><path d="M6 18L18 6" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2" fill="var(--marker-color)" stroke="none"/></svg>`,
  magic_place: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/><path d="M12 5L14 9L18 8L15 12L18 16L14 15L12 19L10 15L6 16L9 12L6 8L10 9Z" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  portal: `<svg viewBox="-2 -2 28 28"><ellipse cx="12" cy="12" rx="8" ry="9" fill="currentColor" stroke="none"/><ellipse cx="14" cy="12.5" rx="5.5" ry="7.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  anomaly: `<svg viewBox="-2 -2 28 28"><path d="M12 2L14 8L20 6L16 12L22 16L14 14L12 20L10 14L2 16L8 12L4 6L10 8Z" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="2.5" fill="var(--marker-color)" stroke="none"/></svg>`,
  artifact_site: `<svg viewBox="-2 -2 28 28"><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><path d="M8 12L12 16L16 12L14 8H10Z" fill="var(--marker-color)" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  treasure: `<svg viewBox="-2 -2 28 28"><path d="M3 10L5 5H19L21 10Z" fill="currentColor" stroke="none"/><rect x="3" y="10" width="18" height="9" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="13.5" width="18" height="1.6" fill="var(--marker-color)" stroke="none"/><rect x="10.5" y="12.5" width="3" height="3.5" rx="0.6" fill="var(--marker-color)" stroke="none"/></svg>`
};

function markerIconKey(mk){
  const raw = mk && mk.icon;
  if(raw && MARKER_SVG[raw]) return raw;
  if(raw && LEGACY_MARKER_ICONS[raw]) return LEGACY_MARKER_ICONS[raw];
  if(mk && mk.type==='city') return 'city';
  if(mk && mk.type==='poi') return 'landmark';
  return 'other';
}

function markerIcon(mk, size='map'){
  const key = markerIconKey(mk);
  const svg = MARKER_SVG[key] || MARKER_SVG.other;
  const color = MARKER_COLORS[key] || MARKER_COLORS.other;
  const cls = size==='card' ? 'marker-card-icon' : 'map-marker-icon';
  return `<span class="${cls}" style="--marker-color:${color}" aria-hidden="true">${svg}</span>`;
}

function markerFields(){
  return [
    {key:'name', label:'Название', type:'text', required:true},
    {key:'type', label:'Тип', type:'select', options:[['city','Город'],['poi','Точка интереса'],['other','Другое']]},
    {key:'icon', label:'Значок', type:'select', options: MARKER_ICONS},
    {key:'desc', label:'Описание', type:'textarea'},
  ];
}
function openMarkerPanel(m, existingMarker, x, y){
  const isNew = !existingMarker;
  const mk = existingMarker || { id:uid(), x, y, name:'', type:'poi', icon:'landmark', desc:'' };
  if(mk.icon && !MARKER_SVG[mk.icon] && LEGACY_MARKER_ICONS[mk.icon]) mk.icon = LEGACY_MARKER_ICONS[mk.icon];
  if(isNew){
    if(!m.markers) m.markers = [];
    m.markers.push(mk);
  }
  state.mapPanel = { type:'marker', mapId:m.id, id:mk.id };
  drawMapMarkers(m);
  attachMapMarkerDrag(m);
  renderMarkerPanel(m, mk, isNew);
}
function openNewMarkerModal(m, x, y){ openMarkerPanel(m, null, x, y); }
function openEditMarkerModal(mapId, markerId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  const mk = (m.markers||[]).find(x=>x.id===markerId);
  if(!mk) return;
  openMarkerPanel(m, mk, mk.x, mk.y);
}
function renderMarkerPanel(m, mk, isNew){
  const panel = document.getElementById('mapSidePanel');
  if(!panel) return;
  const typeOptions = [['city','Город'],['poi','Точка интереса'],['other','Другое']]
    .map(([v,l])=>`<option value="${v}" ${mk.type===v?'selected':''}>${esc(l)}</option>`).join('');
  // Local (non-persisted) UI state: which category tab is currently open in
  // the icon picker. Starts on whichever category the marker's current icon
  // belongs to, so editing an existing marker doesn't drop you on tab 1.
  let activeIconCat = iconCategoryOf(mk.icon);

  function iconPickerHtml(){
    const tabs = MARKER_ICON_CATEGORIES.map(cat=>
      `<button type="button" class="btn btn-sm mp-cat-tab ${cat.key===activeIconCat?'btn-primary':''}" data-cat="${cat.key}">${esc(cat.label)}</button>`
    ).join('');
    const cat = MARKER_ICON_CATEGORIES.find(c=>c.key===activeIconCat) || MARKER_ICON_CATEGORIES[0];
    const grid = cat.icons.map(key=>{
      const label = MARKER_ICON_LABELS[key] || key;
      const selected = mk.icon===key ? ' selected' : '';
      return `<button type="button" class="mp-icon-btn${selected}" data-icon="${key}" title="${esc(label)}">${markerIcon({icon:key}, 'card')}</button>`;
    }).join('');
    const currentLabel = MARKER_ICON_LABELS[mk.icon] || mk.icon;
    return `
      <div class="mp-cat-tabs">${tabs}</div>
      <div class="mp-icon-grid">${grid}</div>
      <div class="mp-current-icon-label">Выбрано: ${esc(currentLabel)}</div>
    `;
  }

  // Local (non-persisted) UI state for the "add a side icon" popover.
  let traitPickerOpen = false;
  let traitPickerCat = null;

  function traitsPickerHtml(){
    const traits = (mk.traits||[]).slice(0,2);
    const slotsHtml = traits.map((key,i)=>{
      const label = MARKER_ICON_LABELS[key] || key;
      return `<div class="mp-trait-slot" title="${esc(label)}">
        ${markerIcon({icon:key}, 'card')}
        <button type="button" class="mp-trait-remove" data-idx="${i}" title="Убрать">×</button>
      </div>`;
    }).join('');
    const canAddMore = traits.length < 2;
    const addBtn = canAddMore ? `<button type="button" class="mp-trait-add-btn" id="mpTraitAddBtn">+ Добавить</button>` : '';
    const popover = (traitPickerOpen && canAddMore) ? traitIconPickerHtml() : '';
    return `<div class="mp-trait-slots">${slotsHtml}${addBtn}</div>
      <div class="mp-trait-hint">Один основной значок сверху + до двух боковых здесь</div>
      ${popover}`;
  }

  function traitIconPickerHtml(){
    if(!traitPickerCat) traitPickerCat = MARKER_ICON_CATEGORIES[0].key;
    const tabs = MARKER_ICON_CATEGORIES.map(cat=>
      `<button type="button" class="btn btn-sm mp-cat-tab ${cat.key===traitPickerCat?'btn-primary':''}" data-trait-cat="${cat.key}">${esc(cat.label)}</button>`
    ).join('');
    const cat = MARKER_ICON_CATEGORIES.find(c=>c.key===traitPickerCat) || MARKER_ICON_CATEGORIES[0];
    const taken = new Set([mk.icon, ...(mk.traits||[])]);
    const grid = cat.icons.filter(key=>!taken.has(key)).map(key=>{
      const label = MARKER_ICON_LABELS[key] || key;
      return `<button type="button" class="mp-icon-btn" data-trait-icon="${key}" title="${esc(label)}">${markerIcon({icon:key}, 'card')}</button>`;
    }).join('');
    return `<div class="mp-trait-picker-popover">
      <div class="mp-cat-tabs">${tabs}</div>
      <div class="mp-icon-grid">${grid || '<div class="empty-tab" style="padding:12px;">Все значки категории уже выбраны</div>'}</div>
    </div>`;
  }

  panel.innerHTML = `<div class="panel-inner">
    <h3 style="margin:0 0 14px; font-size:15px;">${isNew ? 'Новая метка' : 'Метка на карте'}</h3>
    <div class="field"><label>Название</label><input type="text" id="mpName" value="${esc(mk.name)}" placeholder="Город, крепость, святыня…"></div>
    <div class="field"><label>Тип</label><select id="mpType">${typeOptions}</select></div>
    <div class="field"><label>Основной значок</label><div id="mpIconPicker">${iconPickerHtml()}</div></div>
    <div class="field">
      <label>Боковые значки (максимум 2)</label>
      <div id="mpTraitsPicker">${traitsPickerHtml()}</div>
    </div>
    <div class="field"><label>Описание</label><textarea id="mpDesc" rows="4">${esc(mk.desc||'')}</textarea></div>
    <div style="display:flex; gap:8px;">
      ${isNew ? `<button class="btn btn-sm" id="mpCancel">Отменить</button>` : `<button class="btn btn-sm btn-danger" id="mpDelete">Удалить</button>`}
      <button class="btn btn-sm btn-primary" id="mpDone" style="margin-left:auto;">Готово</button>
    </div>
  </div>`;
  panel.classList.add('open');
  const upd = ()=>{ drawMapMarkers(m); attachMapMarkerDrag(m); };

  function bindIconPicker(){
    const wrap = document.getElementById('mpIconPicker');
    wrap.querySelectorAll('.mp-cat-tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        activeIconCat = btn.dataset.cat;
        wrap.innerHTML = iconPickerHtml();
        bindIconPicker();
      });
    });
    wrap.querySelectorAll('.mp-icon-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        mk.icon = btn.dataset.icon;
        mk.iconTouched = true;
        mk.traits = (mk.traits||[]).filter(t=>t!==mk.icon);
        wrap.innerHTML = iconPickerHtml();
        bindIconPicker();
        const traitsWrap = document.getElementById('mpTraitsPicker');
        traitsWrap.innerHTML = traitsPickerHtml();
        bindTraitsPicker();
        upd();
      });
    });
  }
  bindIconPicker();

  document.getElementById('mpName').addEventListener('input', (e)=>{ mk.name = e.target.value; upd(); });
  document.getElementById('mpType').addEventListener('change', (e)=>{
    mk.type = e.target.value;
    if(!mk.iconTouched) mk.icon = mk.type==='city' ? 'city' : mk.type==='poi' ? 'landmark' : 'other';
    activeIconCat = iconCategoryOf(mk.icon);
    const wrap = document.getElementById('mpIconPicker');
    wrap.innerHTML = iconPickerHtml();
    bindIconPicker();
    upd();
  });
  function bindTraitsPicker(){
    const wrap = document.getElementById('mpTraitsPicker');
    wrap.querySelectorAll('.mp-trait-remove').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = Number(btn.dataset.idx);
        mk.traits.splice(idx,1);
        wrap.innerHTML = traitsPickerHtml();
        bindTraitsPicker();
        upd();
      });
    });
    const addBtn = document.getElementById('mpTraitAddBtn');
    if(addBtn){
      addBtn.addEventListener('click', ()=>{
        traitPickerOpen = !traitPickerOpen;
        wrap.innerHTML = traitsPickerHtml();
        bindTraitsPicker();
      });
    }
    wrap.querySelectorAll('[data-trait-cat]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        traitPickerCat = btn.dataset.traitCat;
        wrap.innerHTML = traitsPickerHtml();
        bindTraitsPicker();
      });
    });
    wrap.querySelectorAll('[data-trait-icon]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!mk.traits) mk.traits = [];
        const key = btn.dataset.traitIcon;
        if(mk.traits.length < 2 && !mk.traits.includes(key) && key!==mk.icon) mk.traits.push(key);
        traitPickerOpen = false;
        wrap.innerHTML = traitsPickerHtml();
        bindTraitsPicker();
        upd();
      });
    });
  }
  bindTraitsPicker();
  document.getElementById('mpDesc').addEventListener('input', (e)=>{ mk.desc = e.target.value; });
  const finish = ()=>{
    if(!mk.name || !mk.name.trim()){
      m.markers = (m.markers||[]).filter(x=>x.id!==mk.id);
      if(!isNew) showToast('Метка без названия удалена');
    }
    queueSave();
    hideMapSidePanel();
    refreshMapEditor();
  };
  document.getElementById('mpDone').addEventListener('click', finish);
  if(isNew){
    document.getElementById('mpCancel').addEventListener('click', ()=>{
      m.markers = (m.markers||[]).filter(x=>x.id!==mk.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  } else {
    document.getElementById('mpDelete').addEventListener('click', ()=>{
      m.markers = (m.markers||[]).filter(x=>x.id!==mk.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  }
}
function deleteMarker(mapId, markerId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  m.markers = (m.markers||[]).filter(x=>x.id!==markerId);
  queueSave(); refreshMapEditor();
}
function onMarkerClick(id){ openEditMarkerModal(state.activeMapId, id); }

function markerHtml(mk){
  const icon = markerIcon(mk);
  const key = markerIconKey(mk);
  const color = MARKER_COLORS[key] || MARKER_COLORS.other;
  const traits = (mk.traits||[]).filter(t=>t!==key).slice(0,2);
  const traitBadge = (t)=>{
    const tColor = MARKER_COLORS[t] || MARKER_COLORS.other;
    const tSvg = MARKER_SVG[t] || MARKER_SVG.other;
    const tOpt = MARKER_ICONS.find(o=>o[0]===t);
    const tLabel = tOpt ? tOpt[1] : t;
    return `<span class="map-marker-trait" style="--marker-color:${tColor}" title="${esc(tLabel)}">${tSvg}</span>`;
  };
  const traitsRightHtml = traits[0] ? `<div class="map-marker-traits-r">${traitBadge(traits[0])}</div>` : '';
  const traitsLeftHtml = traits[1] ? `<div class="map-marker-traits-l">${traitBadge(traits[1])}</div>` : '';
  return `<div class="map-marker" data-id="${mk.id}" style="left:${mk.x}%; top:${mk.y}%; --marker-color:${color}" title="${esc(mk.name)}">
    <div class="map-marker-main">
      ${icon}
      ${traitsLeftHtml}
      ${traitsRightHtml}
    </div>
    <span class="map-marker-label">${esc(mk.name)}</span>
  </div>`;
}
function drawMapMarkers(m){
  const layer = document.getElementById('mapMarkersLayer');
  if(!layer) return;
  const show = !m.layers || m.layers.markers !== false;
  const editingId = (state.mapPanel && state.mapPanel.type==='marker' && state.mapPanel.mapId===m.id) ? state.mapPanel.id : null;
  layer.innerHTML = !show ? '' : (m.markers||[]).map(mk=>{
    const html = markerHtml(mk);
    return mk.id===editingId ? html.replace('class="map-marker"', 'class="map-marker force-full"') : html;
  }).join('');
}
function markerCard(mk){
  const typeLabel = mk.type==='city' ? 'Город' : mk.type==='poi' ? 'Точка интереса' : 'Другое';
  const key = markerIconKey(mk);
  const traits = (mk.traits||[]).filter(t=>t!==key).slice(0,2);
  const traitsHtml = traits.length ? `<div class="d-tags">${traits.map(t=>{
    const tOpt = MARKER_ICONS.find(o=>o[0]===t);
    return `<span class="d-tag">${esc(tOpt ? tOpt[1] : t)}</span>`;
  }).join('')}</div>` : '';
  return `<div class="dossier">
    <h3 style="font-size:15px; display:flex; align-items:center; gap:9px;">${markerIcon(mk,'card')} <span>${esc(mk.name)}</span></h3>
    <div class="d-role">${esc(typeLabel)}</div>
    ${traitsHtml}
    ${mk.desc ? `<div class="d-desc">${esc(mk.desc)}</div>` : ''}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openEditMarkerModal('${state.activeMapId}','${mk.id}')">Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMarker('${state.activeMapId}','${mk.id}')">Удалить</button>
    </div>
  </div>`;
}
function pathCard(p){
  return `<div class="dossier">
    <div class="d-top"><h3 style="font-size:15px; display:flex; align-items:center; gap:8px;"><span style="width:14px; height:14px; border-radius:50%; background:${p.color||'var(--gold)'}; display:inline-block; flex-shrink:0;"></span>${esc(p.name)}</h3></div>
    <div class="d-alias">${(p.points||[]).length} точек маршрута</div>
    ${p.desc ? `<div class="d-desc">${esc(p.desc)}</div>` : ''}
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openEditPathModal('${state.activeMapId}','${p.id}')">Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMapPath('${state.activeMapId}','${p.id}')">Удалить</button>
    </div>
  </div>`;
}

function renderMapEditor(el, m){
  if(!m.markers) m.markers = [];
  if(!m.paths) m.paths = [];
  if(!m.labels) m.labels = [];
  ensureMapLayers(m);
  const pathToolbar = state.mapMode==='path'
    ? (state.mapDrawingPath
        ? `<button class="btn btn-sm btn-primary" onclick="finishMapPath()">Завершить путь (${state.mapDrawingPath.points.length})</button><button class="btn btn-sm" onclick="cancelMapPath()">Отменить</button>`
        : `<button class="btn btn-sm" onclick="startMapPath()">Начать новый путь</button>`)
    : '';
  const hintFull = state.mapMode==='marker'
    ? 'Дважды кликните по карте, чтобы поставить метку. Перетаскивайте метки, чтобы переместить. Клик по метке — изменить. Колесо мыши — масштаб, перетаскивание фона — панорама.'
    : state.mapMode==='label'
    ? 'Дважды кликните по карте, чтобы добавить название страны или региона. Тяните за текст, чтобы переместить, за золотой кружок над ним — чтобы повернуть (виден при наведении). Двойной клик по кружку — сбросить поворот. Клик по тексту без перетаскивания — изменить шрифт, цвет и изгиб.'
    : (state.mapDrawingPath ? 'Кликайте по карте, чтобы добавлять точки пути. Когда закончите — нажмите «Завершить путь».' : 'Нажмите «Начать новый путь», затем кликайте по карте, чтобы отметить маршрут героя. Клик по уже нарисованному пути — изменить толщину, стиль и цвет.');
  const hintShort = state.mapMode==='marker'
    ? '2× клик — метка · перетащить — переместить · клик — изменить'
    : state.mapMode==='label'
    ? '2× клик — название · тяните текст — переместить · золотой кружок — поворот'
    : (state.mapDrawingPath ? 'Кликайте по карте — точки пути · «Завершить путь» в конце' : '«Начать новый путь» → кликайте по карте · клик по пути — изменить');
  const fullscreen = !!state.mapFullscreen;
  const hint = fullscreen ? hintShort : hintFull;
  const layersPanelHtml = state.mapLayersPanelOpen ? `
    <div class="map-layers-panel-overlay" onclick="closeMapLayersPanel()"></div>
    <div class="map-layers-panel">
      <div class="layer-row ${m.layers.markers?'':'off'}" onclick="toggleMapLayer('markers')"><span>${uiIcon('map-pin',14)} Метки</span>${uiIcon('eye',15)}</div>
      <div class="layer-row ${m.layers.labels?'':'off'}" onclick="toggleMapLayer('labels')"><span>${uiIcon('typography',14)} Названия</span>${uiIcon('eye',15)}</div>
      <div class="layer-sub-list">
        ${MAP_LABEL_TYPE_ORDER.map(t=>`<div class="layer-row ${m.layers.labelTypes[t]?'':'off'}" onclick="toggleMapLabelType('${t}')"><span>${esc(MAP_LABEL_TYPES[t].short)}</span>${uiIcon('eye',15)}</div>`).join('')}
      </div>
      <div class="layer-row ${m.layers.paths?'':'off'}" onclick="toggleMapLayer('paths')"><span>${uiIcon('route',14)} Пути</span>${uiIcon('eye',15)}</div>
      <div class="layer-panel-divider"></div>
      <div class="layer-panel-actions">
        <button onclick="setAllMapLabelTypes(true)">Все названия</button>
        <button onclick="setAllMapLabelTypes(false)">Скрыть все</button>
      </div>
    </div>
  ` : '';
  const listTab = state.mapListTab || state.mapMode;
  el.innerHTML = `
    <div id="mapEditorRoot" class="${fullscreen ? 'map-editor-fullscreen' : ''} mode-${state.mapMode}">
      <div class="canvas-toolbar">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <button class="btn btn-sm" onclick="closeMapEditor()">← Назад к картам</button>
          <h3 style="margin:0; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(m.name)}</h3>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div class="map-mode-seg">
            <button class="${state.mapMode==='marker'?'active':''}" onclick="setMapMode('marker')">${uiIcon('map-pin')} Метки</button>
            <button class="${state.mapMode==='label'?'active':''}" onclick="setMapMode('label')">${uiIcon('typography')} Название</button>
            <button class="${state.mapMode==='path'?'active':''}" onclick="setMapMode('path')">${uiIcon('route')} Путь</button>
          </div>
          ${pathToolbar}
          ${histBtnsHtml('maps')}
          <div class="canvas-zoom-controls">
            <button class="btn btn-sm" onclick="zoomMapCanvas(-0.2)">${uiIcon('minus',14)}</button>
            <span class="mono" id="mapZoomLabel" style="font-size:12px; color:var(--text-faint); min-width:42px; text-align:center; display:inline-block;">100%</span>
            <button class="btn btn-sm" onclick="zoomMapCanvas(0.2)">${uiIcon('plus',14)}</button>
          </div>
          <button class="map-icon-btn" onclick="resetMapCanvasView()" title="Центрировать">${uiIcon('refresh',15)}</button>
          <button class="map-icon-btn" onclick="toggleMapFullscreen()" title="${fullscreen ? 'Свернуть' : 'Во весь экран'}">${uiIcon(fullscreen ? 'x' : 'maximize',15)}</button>
          <div class="map-layers-btn-wrap">
            <button class="map-layers-btn ${state.mapLayersPanelOpen?'open':''}" onclick="toggleMapLayersPanel(event)">${uiIcon('stack-2',14)} Слои ${uiIcon('chevron-down',11)}</button>
            ${layersPanelHtml}
          </div>
        </div>
      </div>
      <div class="eyebrow" style="margin-bottom:${fullscreen ? '6px' : '10px'}; ${fullscreen ? 'font-size:10.5px; opacity:.65;' : ''}">${hint}</div>
      <div class="map-stage-row" id="mapStageRow">
        <div class="map-stage" id="mapStage">
          <div id="mapViewport" style="${fullscreen ? '' : `aspect-ratio:${m.aspect||1.6};`}">
            <div id="mapCanvasInner">
              <img src="${m.image}" class="map-bg-img" draggable="false" alt="">
              <svg id="mapPathsSvg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
              <div id="mapLabelsLayer"></div>
              <div id="mapMarkersLayer"></div>
            </div>
          </div>
        </div>
        <div id="mapSidePanel"></div>
      </div>
      ${fullscreen ? '' : `
      <div class="map-list-tabs">
        <div class="map-list-tab ${listTab==='marker'?'active':''}" onclick="setMapListTab('marker')">Метки<span class="count">${m.markers.length}</span></div>
        <div class="map-list-tab ${listTab==='label'?'active':''}" onclick="setMapListTab('label')">Названия<span class="count">${(m.labels||[]).length}</span></div>
        <div class="map-list-tab ${listTab==='path'?'active':''}" onclick="setMapListTab('path')">Пути<span class="count">${m.paths.length}</span></div>
      </div>
      ${listTab==='marker' ? `
      ${!m.layers.markers ? '<div class="eyebrow" style="margin-bottom:10px;">Слой меток сейчас скрыт на карте.</div>' : ''}
      <div class="grid">${m.markers.length ? m.markers.map(markerCard).join('') : '<div class="empty-tab">Меток пока нет — кликните по карте.</div>'}</div>
      ` : ''}
      ${listTab==='label' ? `
      ${!m.layers.labels ? '<div class="eyebrow" style="margin-bottom:10px;">Слой названий сейчас скрыт на карте.</div>' : ''}
      ${MAP_LABEL_TYPE_ORDER.map(t=>{
        const items = (m.labels||[]).filter(lb=>(lb.type||'country')===t);
        if(!items.length) return '';
        const hidden = !m.layers.labelTypes[t];
        return `<div class="eyebrow" style="margin:14px 0 6px;">${esc(MAP_LABEL_TYPES[t].label)} (${items.length})${hidden?' — скрыт':''}</div>
        <div class="grid">${items.map(labelCard).join('')}</div>`;
      }).join('') || '<div class="empty-tab">Названий пока нет — переключитесь на «Название» и кликните по карте.</div>'}
      ` : ''}
      ${listTab==='path' ? `
      ${!m.layers.paths ? '<div class="eyebrow" style="margin-bottom:10px;">Слой путей сейчас скрыт на карте.</div>' : ''}
      <div class="grid">${m.paths.length ? m.paths.map(pathCard).join('') : '<div class="empty-tab">Путей пока нет.</div>'}</div>
      ` : ''}
      `}
    </div>
  `;
  layoutMapStage(m);
  if(state.mapFullscreen && mapFullscreenNeedsCenter){
    centerMapCanvasView(m);
    mapFullscreenNeedsCenter = false;
  }
  applyMapCanvasTransform();
  drawMapPaths(m);
  drawMapLabels(m);
  drawMapMarkers(m);
  attachMapCanvasEvents();
  attachMapMarkerDrag(m);
  attachMapLabelDrag(m);
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(()=>{
      if(state.activeMapId!==m.id) return;
      drawMapLabels(m);
      attachMapLabelDrag(m); // re-attach: drawMapLabels rebuilds the DOM, dropping old listeners
    }).catch(()=>{});
  }
}

// Sizes the inner canvas (image + markers + paths) so it always keeps the
// map's true aspect ratio — never stretched. In fullscreen it's sized with
// a "cover" fit so it fills the whole viewport edge-to-edge (cropping any
// excess instead of leaving empty bars or distorting the image).
function layoutMapStage(m){
  const viewport = document.getElementById('mapViewport');
  const inner = document.getElementById('mapCanvasInner');
  if(!viewport || !inner) return;
  if(!state.mapFullscreen){
    inner.style.width = '';
    inner.style.height = '';
    return;
  }
  const availW = viewport.clientWidth;
  const availH = viewport.clientHeight;
  if(availW<=0 || availH<=0) return;
  const aspect = m.aspect || 1.6;
  const w = Math.max(availW, availH * aspect);
  const h = w / aspect;
  inner.style.width = Math.round(w) + 'px';
  inner.style.height = Math.round(h) + 'px';
}

// Centers the (larger) cover-fit canvas inside the fullscreen viewport.
function centerMapCanvasView(m){
  const viewport = document.getElementById('mapViewport');
  const inner = document.getElementById('mapCanvasInner');
  if(!viewport || !inner) return;
  const availW = viewport.clientWidth, availH = viewport.clientHeight;
  const w = parseFloat(inner.style.width) || availW;
  const h = parseFloat(inner.style.height) || availH;
  mapCanvasView = { pan:{ x:(availW-w)/2, y:(availH-h)/2 }, scale:1 };
}

function applyMapCanvasTransform(){
  const inner = document.getElementById('mapCanvasInner');
  if(!inner) return;
  inner.style.transform = `translate(${mapCanvasView.pan.x}px, ${mapCanvasView.pan.y}px) scale(${mapCanvasView.scale})`;
  const lbl = document.getElementById('mapZoomLabel');
  if(lbl) lbl.textContent = Math.round(mapCanvasView.scale*100)+'%';
}
function zoomMapCanvas(delta){
  mapCanvasView.scale = Math.min(4, Math.max(0.4, mapCanvasView.scale+delta));
  applyMapCanvasTransform();
}
function resetMapCanvasView(){
  if(state.mapFullscreen){
    const m = data.maps.find(x=>x.id===state.activeMapId);
    if(m) centerMapCanvasView(m);
  } else {
    mapCanvasView = { pan:{x:0,y:0}, scale:1 };
  }
  applyMapCanvasTransform();
}

function attachMapCanvasEvents(){
  const viewport = document.getElementById('mapViewport');
  if(!viewport) return;
  viewport.addEventListener('mousedown', onMapCanvasMouseDown);
  viewport.addEventListener('dblclick', onMapCanvasDblClick);
  viewport.addEventListener('wheel', onMapCanvasWheel, {passive:false});
}

function onMapCanvasWheel(e){
  e.preventDefault();
  const viewport = document.getElementById('mapViewport');
  const rect = viewport.getBoundingClientRect();
  const cursorX = e.clientX-rect.left, cursorY = e.clientY-rect.top;
  const oldScale = mapCanvasView.scale;
  const newScale = Math.min(4, Math.max(0.4, oldScale + (e.deltaY<0?0.12:-0.12)));
  const localX = (cursorX-mapCanvasView.pan.x)/oldScale, localY = (cursorY-mapCanvasView.pan.y)/oldScale;
  mapCanvasView.pan.x = cursorX-localX*newScale;
  mapCanvasView.pan.y = cursorY-localY*newScale;
  mapCanvasView.scale = newScale;
  applyMapCanvasTransform();
}

function onMapCanvasMouseDown(e){
  if(e.target.closest('.map-marker')) return; // marker dragging is handled separately
  const viewport = document.getElementById('mapViewport');
  let lastX = e.clientX, lastY = e.clientY;
  let moved = false;
  const move=(ev)=>{
    if(Math.abs(ev.clientX-lastX)>3 || Math.abs(ev.clientY-lastY)>3 || moved){
      moved = true;
      mapCanvasView.pan.x += (ev.clientX-lastX);
      mapCanvasView.pan.y += (ev.clientY-lastY);
      applyMapCanvasTransform();
      viewport.classList.add('panning');
    }
    lastX = ev.clientX; lastY = ev.clientY;
  };
  const up=(ev)=>{
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    viewport.classList.remove('panning');
    // Marker and label placement now require a double-click (see onMapCanvasDblClick);
    // a plain single click only still places path points, since drawing a route
    // point-by-point with double-clicks would be awkward.
    if(!moved && state.mapMode==='path') handleMapPlacementClick(ev);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  e.preventDefault();
}

function onMapCanvasDblClick(e){
  if(e.target.closest('.map-marker') || e.target.closest('.map-label')) return;
  if(state.mapMode==='marker' || state.mapMode==='label'){
    handleMapPlacementClick(e);
  }
}

function handleMapPlacementClick(e){
  const viewport = document.getElementById('mapViewport');
  const inner = document.getElementById('mapCanvasInner');
  const rect = viewport.getBoundingClientRect();
  const localX = (e.clientX-rect.left-mapCanvasView.pan.x)/mapCanvasView.scale;
  const localY = (e.clientY-rect.top-mapCanvasView.pan.y)/mapCanvasView.scale;
  const xPct = (localX/inner.offsetWidth)*100;
  const yPct = (localY/inner.offsetHeight)*100;
  if(xPct<0 || xPct>100 || yPct<0 || yPct>100) return;
  const m = data.maps.find(x=>x.id===state.activeMapId);
  if(!m) return;
  if(state.mapMode==='marker'){
    openNewMarkerModal(m, xPct, yPct);
  } else if(state.mapMode==='label'){
    openNewLabelModal(m, xPct, yPct);
  } else if(state.mapMode==='path'){
    if(!state.mapDrawingPath){ showToast('Сначала нажмите «Начать новый путь»'); return; }
    state.mapDrawingPath.points.push({x:xPct, y:yPct});
    refreshMapEditor();
  }
}

function drawMapPaths(m){
  const svg = document.getElementById('mapPathsSvg');
  if(!svg) return;
  let out = '';
  const showPaths = !m.layers || m.layers.paths !== false;
  if(showPaths){
    (m.paths||[]).forEach(p=>{
      const w = Number(p.width)||0.35;
      const dash = p.dashed ? `stroke-dasharray="${(w*3.2).toFixed(2)} ${(w*2.2).toFixed(2)}"` : '';
      const pts = (p.points||[]).map(pt=>`${pt.x},${pt.y}`).join(' ');
      out += `<polyline data-path-id="${p.id}" class="map-path-hit" points="${pts}" fill="none" stroke="transparent" stroke-width="${Math.max(w*3, 2.2)}" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:${state.mapMode==='path' ? 'stroke' : 'none'}; cursor:pointer;"/>`;
      out += `<polyline points="${pts}" fill="none" stroke="${p.color||'var(--gold)'}" stroke-width="${w}" ${dash} stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"/>`;
      (p.points||[]).forEach((pt,i)=>{
        out += `<circle cx="${pt.x}" cy="${pt.y}" r="${i===0||i===p.points.length-1?w*1.8:w*1.15}" fill="${p.color||'var(--gold)'}" style="pointer-events:none;"/>`;
      });
    });
  }
  if(state.mapDrawingPath){
    const w = 0.35;
    const pts = state.mapDrawingPath.points;
    const ptsStr = pts.map(pt=>`${pt.x},${pt.y}`).join(' ');
    out += `<polyline points="${ptsStr}" fill="none" stroke="var(--thread)" stroke-width="${w}" stroke-dasharray="1.5 1" stroke-linecap="round"/>`;
    pts.forEach(pt=>{ out += `<circle cx="${pt.x}" cy="${pt.y}" r="${w*1.6}" fill="var(--thread)"/>`; });
  }
  svg.innerHTML = out;
  if(showPaths){
    svg.querySelectorAll('.map-path-hit').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(state.mapDrawingPath) return;
        openEditPathModal(m.id, el.dataset.pathId);
      });
    });
  }
}

function attachMapMarkerDrag(m){
  const viewport = document.getElementById('mapViewport');
  if(!viewport) return;
  viewport.querySelectorAll('.map-marker').forEach(nodeEl=>{
    nodeEl.addEventListener('mousedown', (e)=>{
      e.stopPropagation();
      const id = nodeEl.dataset.id;
      const marker = (m.markers||[]).find(x=>x.id===id);
      if(!marker) return;
      const inner = document.getElementById('mapCanvasInner');
      const startX=e.clientX, startY=e.clientY, ox=marker.x, oy=marker.y;
      let moved = false;
      const move=(ev)=>{
        if(Math.abs(ev.clientX-startX)>3 || Math.abs(ev.clientY-startY)>3) moved = true;
        let nx = ox + ((ev.clientX-startX)/mapCanvasView.scale/inner.offsetWidth)*100;
        let ny = oy + ((ev.clientY-startY)/mapCanvasView.scale/inner.offsetHeight)*100;
        nx = Math.min(100, Math.max(0, nx));
        ny = Math.min(100, Math.max(0, ny));
        marker.x = nx; marker.y = ny;
        nodeEl.style.left = nx+'%'; nodeEl.style.top = ny+'%';
        drawMapPaths(m);
      };
      const up=()=>{
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        if(moved) queueSave();
        else onMarkerClick(id);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      e.preventDefault();
    });
  });
}

/* ---------------- MAP LABELS (curved country / region names) ---------------- */
// Cartographic label categories. Each has its own default styling (so a fresh
// label already looks like the map convention for that kind of name) and a
// zLayer used to paint background-ish labels (land/ocean) behind foreground
// ones (country/lake/river) so overlapping text stays readable.
const MAP_LABEL_TYPES = {
  land:    { label:'Земля / регион', short:'Земли',  zLayer:0, defaults:{ font:'ebGaramond', size:46, spacing:6, curve:0,  color:'#c9a24c' } },
  ocean:   { label:'Океан',          short:'Океаны', zLayer:1, defaults:{ font:'playfair',   size:30, spacing:6, curve:0,  color:'#6a8caf' } },
  country: { label:'Страна',         short:'Страны', zLayer:2, defaults:{ font:'ebGaramond', size:32, spacing:3, curve:0,  color:'#e9e4d8' } },
  lake:    { label:'Озеро',          short:'Озёра',  zLayer:3, defaults:{ font:'caveat',     size:20, spacing:1, curve:0,  color:'#6a8caf' } },
  river:   { label:'Река',           short:'Реки',   zLayer:4, defaults:{ font:'marckScript',size:20, spacing:1, curve:25, color:'#6a8caf' } },
};
const MAP_LABEL_TYPE_ORDER = ['country','river','lake','ocean','land'];

const MAP_LABEL_FONTS = {
  caveat:        { label:'Caveat — рукописный (кириллица)',  family:'Caveat' },
  pacifico:      { label:'Pacifico — курсивный (кириллица)', family:'Pacifico' },
  playfair:      { label:'Playfair Display — контрастный (кириллица)', family:'Playfair Display' },
  lora:          { label:'Lora — книжный (кириллица)',       family:'Lora' },
  merriweather:  { label:'Merriweather — плотный (кириллица)', family:'Merriweather' },
  kellySlab:     { label:'Kelly Slab — слэб (кириллица)',    family:'Kelly Slab' },
  marckScript:   { label:'Marck Script — рукописный росчерк (кириллица)', family:'Marck Script' },
  pattaya:       { label:'Pattaya — узкий декоративный (кириллица)', family:'Pattaya' },
  badScript:     { label:'Bad Script — небрежный почерк (кириллица)', family:'Bad Script' },
  ebGaramond:    { label:'EB Garamond — старостильный (кириллица)', family:'EB Garamond' },
};

let _labelMeasureCanvas = null;
function measureLabelWidth(text, size, family, spacing){
  if(!_labelMeasureCanvas) _labelMeasureCanvas = document.createElement('canvas');
  const ctx = _labelMeasureCanvas.getContext('2d');
  ctx.font = `${size}px "${family}"`;
  const t = text && text.length ? text : ' ';
  const w = ctx.measureText(t).width;
  const extra = Math.max(0, t.length-1) * (spacing||0);
  return w + extra;
}

// Builds an inline SVG for one label, curving the text along a quadratic
// path whose bend is driven by lb.curve (-100..100): negative bows the
// text downward like a valley, positive arches it upward, 0 stays straight.
function labelSvgMarkup(lb){
  const fontDef = MAP_LABEL_FONTS[lb.font] || MAP_LABEL_FONTS.caveat;
  const size = Math.max(10, Math.min(72, Number(lb.size)||26));
  const color = lb.color || '#e9e4d8';
  const spacing = Number(lb.spacing)||0;
  const curve = Math.max(-100, Math.min(100, Number(lb.curve)||0));
  const text = lb.text || '';
  const textW = measureLabelWidth(text, size, fontDef.family, spacing);
  const pad = size*0.9;
  const svgW = Math.max(40, textW + pad*2);
  const bend = (curve/100) * size * 1.35;
  const svgH = Math.max(size*2.2, size*1.5 + Math.abs(bend)*2);
  const midY = svgH/2;
  const pathId = 'lblpath-'+(lb.id||'preview');
  const d = `M ${pad.toFixed(1)},${midY.toFixed(1)} Q ${(svgW/2).toFixed(1)},${(midY-bend).toFixed(1)} ${(svgW-pad).toFixed(1)},${midY.toFixed(1)}`;
  return `<svg width="${svgW.toFixed(0)}" height="${svgH.toFixed(0)}" viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" style="overflow:visible;">
    <path id="${pathId}" d="${d}" fill="none" stroke="none"/>
    <text font-family="${esc(fontDef.family)}" font-size="${size}" letter-spacing="${spacing}" fill="${color}"
      style="paint-order:stroke; stroke:rgba(20,21,27,.6); stroke-width:${Math.max(1,size*0.05).toFixed(1)}px; stroke-linejoin:round;">
      <textPath href="#${pathId}" startOffset="50%" text-anchor="middle" dominant-baseline="middle">${esc(text)}</textPath>
    </text>
  </svg>`;
}

function drawMapLabels(m){
  const layer = document.getElementById('mapLabelsLayer');
  if(!layer) return;
  ensureMapLayers(m);
  const show = m.layers.labels !== false;
  const visible = !show ? [] : (m.labels||[]);
  const sorted = visible.slice().sort((a,b)=>{
    const za = (MAP_LABEL_TYPES[a.type]||MAP_LABEL_TYPES.country).zLayer;
    const zb = (MAP_LABEL_TYPES[b.type]||MAP_LABEL_TYPES.country).zLayer;
    return za - zb;
  });
  layer.innerHTML = sorted.map(lb=>{
    const rot = Number(lb.rotation)||0;
    const muted = !m.layers.labelTypes[lb.type||'country'];
    return `<div class="map-label${muted?' label-type-muted':''}" data-id="${lb.id}" style="left:${lb.x}%; top:${lb.y}%;">
      <div class="map-label-group" data-id="${lb.id}" style="transform:translate(-50%,-50%) rotate(${rot}deg);">
        <div class="map-label-rotate-handle" data-id="${lb.id}" title="Перетащите, чтобы повернуть надпись"></div>
        <div class="map-label-svgwrap" data-id="${lb.id}" title="${esc(lb.text)}">${labelSvgMarkup(lb)}</div>
      </div>
    </div>`;
  }).join('');
}

function attachMapLabelDrag(m){
  const layer = document.getElementById('mapLabelsLayer');
  if(!layer) return;
  // Drag on the text itself moves the label around the map.
  layer.querySelectorAll('.map-label-svgwrap').forEach(svgwrap=>{
    svgwrap.addEventListener('mousedown', (e)=>{
      e.stopPropagation();
      const id = svgwrap.dataset.id;
      const lb = (m.labels||[]).find(x=>x.id===id);
      if(!lb) return;
      const outer = svgwrap.closest('.map-label');
      const inner = document.getElementById('mapCanvasInner');
      const startX=e.clientX, startY=e.clientY, ox=lb.x, oy=lb.y;
      let moved = false;
      const move=(ev)=>{
        if(Math.abs(ev.clientX-startX)>3 || Math.abs(ev.clientY-startY)>3) moved = true;
        let nx = ox + ((ev.clientX-startX)/mapCanvasView.scale/inner.offsetWidth)*100;
        let ny = oy + ((ev.clientY-startY)/mapCanvasView.scale/inner.offsetHeight)*100;
        nx = Math.min(100, Math.max(0, nx));
        ny = Math.min(100, Math.max(0, ny));
        lb.x = nx; lb.y = ny;
        outer.style.left = nx+'%'; outer.style.top = ny+'%';
      };
      const up=()=>{
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        if(moved) queueSave();
        else openEditLabelModal(state.activeMapId, id);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      e.preventDefault();
    });
  });
  // Drag on the small handle above the label rotates it in place, live.
  layer.querySelectorAll('.map-label-rotate-handle').forEach(handle=>{
    handle.addEventListener('mousedown', (e)=>{
      e.stopPropagation();
      const id = handle.dataset.id;
      const lb = (m.labels||[]).find(x=>x.id===id);
      if(!lb) return;
      const outer = handle.closest('.map-label');
      const group = handle.closest('.map-label-group');
      const rect = outer.getBoundingClientRect();
      const cx = rect.left, cy = rect.top;
      handle.classList.add('active');
      let moved = false;
      const move=(ev)=>{
        moved = true;
        const dx = ev.clientX-cx, dy = ev.clientY-cy;
        let deg = Math.atan2(dy,dx)*180/Math.PI + 90;
        deg = ((deg+180)%360+360)%360-180;
        if(ev.shiftKey) deg = Math.round(deg/15)*15;
        lb.rotation = Math.round(deg*10)/10;
        group.style.transform = `translate(-50%,-50%) rotate(${lb.rotation}deg)`;
      };
      const up=()=>{
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        handle.classList.remove('active');
        if(moved) queueSave();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      e.preventDefault();
    });
    handle.addEventListener('dblclick', (e)=>{
      e.stopPropagation();
      const id = handle.dataset.id;
      const lb = (m.labels||[]).find(x=>x.id===id);
      if(!lb) return;
      lb.rotation = 0;
      const group = handle.closest('.map-label-group');
      group.style.transform = 'translate(-50%,-50%) rotate(0deg)';
      queueSave();
    });
  });
}

function labelCard(lb){
  const fontDef = MAP_LABEL_FONTS[lb.font] || MAP_LABEL_FONTS.caveat;
  const typeDef = MAP_LABEL_TYPES[lb.type] || MAP_LABEL_TYPES.country;
  const previewLb = Object.assign({}, lb, { size: Math.min(Number(lb.size)||26, 30) });
  const rot = Number(lb.rotation)||0;
  return `<div class="dossier">
    <div style="background:var(--bg-alt); border:1px solid var(--border-soft); border-radius:4px; padding:10px; margin-bottom:8px; display:flex; align-items:center; justify-content:center; min-height:64px; overflow:hidden;"><div style="transform:rotate(${rot}deg);">${labelSvgMarkup(previewLb)}</div></div>
    <h3 style="font-size:14px;">${esc(lb.text)}</h3>
    <div class="d-role">${esc(typeDef.label)} · ${esc(fontDef.label)}</div>
    <div class="d-actions">
      <button class="btn btn-ghost btn-sm" onclick="openEditLabelModal('${state.activeMapId}','${lb.id}')">Изменить</button>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMapLabel('${state.activeMapId}','${lb.id}')">Удалить</button>
    </div>
  </div>`;
}

// Closes whichever side-panel editor is currently open (label/marker/path),
// discarding no data — everything is already live-saved into the map object
// as the person types, so closing just hides the UI.
function hideMapSidePanel(){
  const panel = document.getElementById('mapSidePanel');
  if(panel){ panel.classList.remove('open'); panel.innerHTML = ''; }
  state.mapPanel = null;
}

// Opens the live side panel for a country/region label. Instead of a
// separate small preview, the label itself is placed on the map right away
// (as a draft, if new) and every field edit updates that same real label in
// place — so what you see on the map IS the result, with no duplicate SVG
// elements or stale previews to fall out of sync.
function openLabelPanel(m, existingLabel, x, y){
  const isNew = !existingLabel;
  const startType = state.lastLabelType || 'country';
  const preset = (MAP_LABEL_TYPES[startType] || MAP_LABEL_TYPES.country).defaults;
  const lb = existingLabel || { id:uid(), x, y, text:'', type:startType, font:preset.font, size:preset.size, color:preset.color, spacing:preset.spacing, curve:preset.curve, rotation:0 };
  if(!lb.type) lb.type = 'country';
  if(isNew){
    if(!m.labels) m.labels = [];
    m.labels.push(lb);
  }
  state.mapPanel = { type:'label', mapId:m.id, id:lb.id };
  drawMapLabels(m);
  attachMapLabelDrag(m);
  renderLabelPanel(m, lb, isNew);
}
function openNewLabelModal(m, x, y){ openLabelPanel(m, null, x, y); }
function openEditLabelModal(mapId, labelId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  const lb = (m.labels||[]).find(x=>x.id===labelId);
  if(!lb) return;
  openLabelPanel(m, lb, lb.x, lb.y);
}
function renderLabelPanel(m, lb, isNew){
  const panel = document.getElementById('mapSidePanel');
  if(!panel) return;
  const fontOptions = Object.entries(MAP_LABEL_FONTS).map(([key,f])=>
    `<option value="${key}" style="font-family:'${f.family}'" ${lb.font===key?'selected':''}>${esc(f.label)}</option>`
  ).join('');
  const typeOptions = MAP_LABEL_TYPE_ORDER.map(t=>`<option value="${t}" ${(lb.type||'country')===t?'selected':''}>${esc(MAP_LABEL_TYPES[t].label)}</option>`).join('');
  const swatches = ['#e9e4d8','#c9a24c','#c1443b','#5fa8a0','#b5698f','#8c7ec9','#ffffff','#14151b'];
  panel.innerHTML = `<div class="panel-inner">
    <h3 style="margin:0 0 14px; font-size:15px;">${isNew ? 'Новое название' : 'Название на карте'}</h3>
    <div class="field"><label>Тип</label><select id="lpType">${typeOptions}</select></div>
    <div class="field"><label>Текст</label><input type="text" id="lpText" value="${esc(lb.text)}" placeholder="Название страны, региона…"></div>
    <div class="field"><label>Шрифт</label><select id="lpFont">${fontOptions}</select></div>
    <div class="field"><label>Размер (<span id="lpSizeVal">${lb.size}</span>px)</label><input type="range" id="lpSize" min="12" max="64" step="1" value="${lb.size}"></div>
    <div class="field"><label>Интервал (<span id="lpSpacingVal">${lb.spacing}</span>px)</label><input type="range" id="lpSpacing" min="-1" max="10" step="0.5" value="${lb.spacing}"></div>
    <div class="field">
      <label>Изгиб (<span id="lpCurveVal">${lb.curve}</span>)</label>
      <input type="range" id="lpCurve" min="-100" max="100" step="5" value="${lb.curve}">
      <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-faint); margin-top:-2px;">
        <span>◡ вниз</span><span>прямо</span><span>◠ вверх</span>
      </div>
    </div>
    <div class="field"><label>Цвет</label>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <input type="color" id="lpColor" value="${lb.color}" style="width:40px; height:30px; padding:2px; border-radius:6px; cursor:pointer;">
        ${swatches.map(c=>`<button type="button" class="lbl-swatch" data-c="${c}" style="width:18px; height:18px; border-radius:50%; background:${c}; border:1px solid var(--border); cursor:pointer;"></button>`).join('')}
      </div>
    </div>
    <div class="eyebrow" style="margin:2px 0 14px;">Поворот тяните прямо на карте — за золотой кружок над надписью.</div>
    <div style="display:flex; gap:8px;">
      ${isNew ? `<button class="btn btn-sm" id="lpCancel">Отменить</button>` : `<button class="btn btn-sm btn-danger" id="lpDelete">Удалить</button>`}
      <button class="btn btn-sm btn-primary" id="lpDone" style="margin-left:auto;">Готово</button>
    </div>
  </div>`;
  panel.classList.add('open');
  const upd = ()=>{ drawMapLabels(m); attachMapLabelDrag(m); };
  document.getElementById('lpType').addEventListener('change', (e)=>{
    lb.type = e.target.value;
    state.lastLabelType = lb.type;
    queueSave();
    renderLabelPanel(m, lb, isNew);
    upd();
  });
  document.getElementById('lpText').addEventListener('input', (e)=>{ lb.text = e.target.value; upd(); });
  document.getElementById('lpFont').addEventListener('change', (e)=>{ lb.font = e.target.value; upd(); });
  const sizeI = document.getElementById('lpSize');
  sizeI.addEventListener('input', ()=>{ lb.size = Number(sizeI.value); document.getElementById('lpSizeVal').textContent = sizeI.value; upd(); });
  const spacingI = document.getElementById('lpSpacing');
  spacingI.addEventListener('input', ()=>{ lb.spacing = Number(spacingI.value); document.getElementById('lpSpacingVal').textContent = spacingI.value; upd(); });
  const curveI = document.getElementById('lpCurve');
  curveI.addEventListener('input', ()=>{ lb.curve = Number(curveI.value); document.getElementById('lpCurveVal').textContent = curveI.value; upd(); });
  document.getElementById('lpColor').addEventListener('input', (e)=>{ lb.color = e.target.value; upd(); });
  panel.querySelectorAll('.lbl-swatch').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      lb.color = btn.dataset.c;
      document.getElementById('lpColor').value = btn.dataset.c;
      upd();
    });
  });
  const finish = ()=>{
    if(!lb.text || !lb.text.trim()){
      m.labels = (m.labels||[]).filter(x=>x.id!==lb.id);
      if(!isNew) showToast('Пустое название удалено');
    }
    queueSave();
    hideMapSidePanel();
    refreshMapEditor();
  };
  document.getElementById('lpDone').addEventListener('click', finish);
  if(isNew){
    document.getElementById('lpCancel').addEventListener('click', ()=>{
      m.labels = (m.labels||[]).filter(x=>x.id!==lb.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  } else {
    document.getElementById('lpDelete').addEventListener('click', ()=>{
      m.labels = (m.labels||[]).filter(x=>x.id!==lb.id);
      queueSave(); hideMapSidePanel(); refreshMapEditor();
    });
  }
}
function deleteMapLabel(mapId, labelId){
  const m = data.maps.find(x=>x.id===mapId);
  if(!m) return;
  m.labels = (m.labels||[]).filter(x=>x.id!==labelId);
  queueSave(); refreshMapEditor();
}

function openNewLocationModal(){
  openFormModal('Новая локация', locationFields(), {}, (vals)=>{ data.locations.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('locations', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditLocationModal(id){
  const l = data.locations.find(x=>x.id===id);
  openFormModal('Изменить локацию', locationFields(), l, (vals)=>{ Object.assign(l, vals); queueSave(); closeModal(); renderMain(); });
}
function deleteLocation(id){ data.locations = data.locations.filter(l=>l.id!==id); queueSave(); renderMain(); }
function locationFields(){
  return [
    {key:'name', label:'Название', type:'text', required:true},
    {key:'photo', label:'Изображение', type:'image'},
    {key:'faction', label:'Контролирующая фракция (если есть)', type:'text'},
    {key:'desc', label:'Описание', type:'textarea'},
  ];
}
function openNewFactionModal(){
  openFormModal('Новая фракция', factionFields(), {}, (vals)=>{ data.factions.push(Object.assign({id:uid(), projectId: state.activeProjectId, order: nextOrder('factions', state.activeProjectId)}, vals)); queueSave(); closeModal(); renderMain(); });
}
function openEditFactionModal(id){
  const f = data.factions.find(x=>x.id===id);
  openFormModal('Изменить фракцию', factionFields(), f, (vals)=>{ Object.assign(f, vals); queueSave(); closeModal(); renderMain(); });
}
function deleteFaction(id){ data.factions = data.factions.filter(f=>f.id!==id); queueSave(); renderMain(); }
function factionFields(){
  return [
    {key:'name', label:'Название', type:'text', required:true},
    {key:'photo', label:'Изображение / герб', type:'image'},
    {key:'desc', label:'Описание, цели, устройство', type:'textarea'},
  ];
}

/* ---------------- PROJECTS ---------------- */
function openNewProjectModal(){
  openFormModal('Новый проект', projectFields(), {}, (vals)=>{
    const p = Object.assign({id:uid()}, vals);
    data.projects.push(p); state.activeProjectId = p.id; state.activeTab='overview';
    queueSave(); closeModal(); render();
  });
}
function openEditProjectModal(id){
  const p = proj(id);
  openFormModal('Изменить проект', projectFields(), p, (vals)=>{ Object.assign(p, vals); queueSave(); closeModal(); render(); },
    { label: 'Удалить проект', onClick: ()=>{ closeModal(); deleteProject(id); } });
}
function deleteProject(id){
  askConfirm('Удалить проект целиком, со всеми персонажами, связями, событиями и лором? Это необратимо.', 'Удалить проект', ()=>{
    data.projects = data.projects.filter(p=>p.id!==id);
    ['characters','relationships','events','locations','factions','scenes','sceneLinks','creatures','myths','magicSystems','deities','maps','countries','dynasties','dynastyMembers','dynastyMemberLinks','artifacts'].forEach(coll=>{ data[coll] = data[coll].filter(x=>x.projectId!==id); });
    if(state.activeProjectId===id){ state.activeProjectId = data.projects[0] ? data.projects[0].id : null; }
    queueSave(); render();
  });
}
function projectFields(){
  return [
    {key:'name', label:'Название проекта', type:'text', required:true},
    {key:'type', label:'Тип проекта', type:'text', placeholder:'роман, манга, веб-комикс, кампания…'},
    {key:'photo', label:'Обложка / иконка проекта', type:'image'},
    {key:'color', label:'Цвет метки', type:'color'},
    {key:'desc', label:'Кратко о проекте', type:'textarea'},
  ];
}

/* ---------------- GENERIC MODAL ---------------- */
/* ---------- «Выбрать из существующих»: подставляет данные готового персонажа / члена рода в форму ---------- */
function buildFormPicker(f, fw){
  const wrap = document.createElement('div');
  wrap.className = 'field form-picker';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn-sm form-picker-btn';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span>${esc(f.label || 'Выбрать')}</span>`;
  const panel = document.createElement('div');
  panel.className = 'form-picker-panel'; panel.hidden = true;
  panel.innerHTML = `<input type="text" class="fp-search" placeholder="Поиск по имени…"><div class="fp-list"></div>`;
  const search = panel.querySelector('.fp-search'), list = panel.querySelector('.fp-list');
  let groups = [];
  const render = ()=>{
    const q = search.value.trim().toLowerCase();
    let html = '', total = 0;
    groups.forEach((g, gi)=>{
      const rows = g.items.map((it, ii)=>({it, ii})).filter(({it})=>!q || (it.name||'').toLowerCase().includes(q) || (it.sub||'').toLowerCase().includes(q));
      if(!rows.length) return;
      html += `<div class="fp-group">${esc(g.title)}</div>` + rows.map(({it, ii})=>{
        total++;
        const ava = it.photo ? `<img class="fp-ava" src="${it.photo}" alt="">` : `<span class="fp-ava">${esc(initials(it.name||''))}</span>`;
        return `<button type="button" class="fp-item" data-g="${gi}" data-i="${ii}">${ava}<span class="fp-name">${esc(it.name||'Без имени')}</span>${it.sub ? `<span class="fp-sub">${esc(it.sub)}</span>` : ''}</button>`;
      }).join('');
    });
    list.innerHTML = total ? html : '<div class="fp-empty">Никого не нашлось</div>';
  };
  const apply = values=>{
    Object.keys(values).forEach(key=>{
      const el = fw.querySelector(`[data-key="${key}"]`);
      if(!el) return;
      const val = values[key] || '';
      if(el._applyImage){ el._applyImage(val); return; }
      el.value = val;
      el.dispatchEvent(new Event('input', {bubbles:true}));
    });
  };
  btn.onclick = ()=>{
    panel.hidden = !panel.hidden;
    if(!panel.hidden){ groups = (f.sources ? f.sources() : []).filter(g=>g.items.length); search.value = ''; render(); search.focus(); }
  };
  search.addEventListener('input', render);
  list.addEventListener('click', e=>{
    const b = e.target.closest('.fp-item');
    if(!b) return;
    const it = groups[+b.dataset.g].items[+b.dataset.i];
    apply(it.values || {});
    panel.hidden = true;
    showToast('Данные подставлены — их можно изменить перед сохранением');
  });
  wrap.appendChild(btn); wrap.appendChild(panel);
  return wrap;
}
// кандидаты для нового члена рода: персонажи проекта и участники других родов
function memberPickerSources(dynastyId){
  const pid = state.activeProjectId;
  const groups = [{ title:'Персонажи проекта', items: itemsOf('characters', pid).map(c=>({ name:c.name, photo:c.photo, sub:c.role||'', values:{ name:c.name, photo:c.photo||'', note:c.desc||'' } })) }];
  itemsOf('dynasties', pid).filter(d=>d.id!==dynastyId).forEach(d=>{
    groups.push({ title:'Род: '+(d.name||'без названия'), items: data.dynastyMembers.filter(m=>m.dynastyId===d.id).map(m=>({ name:m.name, photo:m.photo, sub:[m.birth, m.death].filter(Boolean).join(' — '), values:{ name:m.name, photo:m.photo||'', birth:m.birth||'', death:m.death||'', note:m.note||'' } })) });
  });
  return groups;
}
// кандидаты для нового персонажа: члены всех родов проекта
function characterPickerSources(){
  const pid = state.activeProjectId;
  return itemsOf('dynasties', pid).map(d=>({ title:'Род: '+(d.name||'без названия'), items: data.dynastyMembers.filter(m=>m.dynastyId===d.id).map(m=>({ name:m.name, photo:m.photo, sub:[m.birth, m.death].filter(Boolean).join(' — '), values:{ name:m.name, photo:m.photo||'', desc:[m.birth ? 'Рождение: '+m.birth : '', m.death ? 'Смерть: '+m.death : '', m.note||''].filter(Boolean).join('\n') } })) }));
}
function memberFieldsNew(){
  return [{type:'picker', label:'Выбрать из персонажей и других родов', sources:()=>memberPickerSources(state.activeTreeId)}, ...memberFields()];
}
function characterFieldsNew(){
  return [{type:'picker', label:'Выбрать из членов родов', sources:characterPickerSources}, ...characterFields()];
}

function openFormModal(title, fields, initial, onSave, dangerAction){
  const box = document.getElementById('modalBox');
  box.style.maxWidth = '';
  box.innerHTML = `<h2>${esc(title)}</h2><div id="modalFields"></div>
    <div id="modalActions">
      <div id="modalLeftActions">${dangerAction ? `<button class="btn btn-danger btn-sm" id="modalDangerBtn">${esc(dangerAction.label)}</button>` : ''}</div>
      <div id="modalRightActions" style="display:flex; gap:10px;">
        <button class="btn btn-primary" id="modalSaveBtn">Сохранить</button>
      </div>
    </div>`;
  const fw = document.getElementById('modalFields');
  fields.forEach(f=>{
    if(f.type==='picker'){ fw.appendChild(buildFormPicker(f, fw)); return; }
    const wrap = document.createElement('div'); wrap.className='field';
    const label = document.createElement('label'); label.textContent = f.label; wrap.appendChild(label);
    let input;
    if(f.type==='textarea'){ input = document.createElement('textarea'); input.value = initial[f.key]||''; }
    else if(f.type==='image'){
      input = document.createElement('input'); input.type='hidden'; input.value = initial[f.key] || '';
      const previewWrap = document.createElement('div');
      previewWrap.style.cssText = 'display:flex; align-items:center; gap:12px; margin-top:2px;';
      const img = document.createElement('img');
      img.style.cssText = 'width:60px; height:60px; border-radius:50%; object-fit:cover; border:1px solid var(--border); background:var(--bg-alt); flex-shrink:0; display:'+(input.value?'block':'none')+';';
      if(input.value) img.src = input.value;
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:60px; height:60px; border-radius:50%; border:1px solid var(--border); background:var(--bg-alt); flex-shrink:0; align-items:center; justify-content:center; font-family:\'IBM Plex Mono\',monospace; font-size:17px; color:var(--text-faint); display:'+(input.value?'none':'flex')+';';
      const nameInput = fw.querySelector('[data-key="name"]');
      placeholder.textContent = initials((nameInput ? nameInput.value : initial.name) || '') || '?';
      if(nameInput){ nameInput.addEventListener('input', ()=>{ placeholder.textContent = initials(nameInput.value) || '?'; }); }
      const controls = document.createElement('div'); controls.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
      const fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*'; fileInput.style.display='none';
      const addBtn = document.createElement('button'); addBtn.type='button'; addBtn.className='btn btn-ghost btn-sm';
      addBtn.style.cssText = 'align-self:flex-start;';
      addBtn.textContent = input.value ? 'Изменить фото' : 'Добавить фото';
      addBtn.onclick = ()=> fileInput.click();
      const removeBtn = document.createElement('button'); removeBtn.type='button'; removeBtn.className='btn btn-ghost btn-sm';
      removeBtn.textContent = 'Убрать фото';
      removeBtn.style.cssText = 'align-self:flex-start; display:'+(input.value?'inline-block':'none')+';';
      removeBtn.onclick = ()=>{
        input.value=''; img.src=''; img.style.display='none'; placeholder.style.display='flex';
        removeBtn.style.display='none'; addBtn.textContent='Добавить фото';
      };
      fileInput.onchange = ()=>{
        const file = fileInput.files[0];
        if(!file) return;
        openAvatarCropper(file, dataUrl=>{
          input.value = dataUrl; img.src = dataUrl; img.style.display='block'; placeholder.style.display='none';
          removeBtn.style.display='inline-block'; addBtn.textContent='Изменить фото';
        });
        fileInput.value='';
      };
      const hint=document.createElement('div'); hint.textContent='Выбери нужный фрагмент: двигай изображение и меняй масштаб. Аватар сохранится квадратным 512 × 512. Нажми на фото в карточке, чтобы увеличить.'; hint.style.cssText='font-size:11px; line-height:1.45; color:var(--text-faint); max-width:290px;';
      // позволяет подставить фото программно (например, при выборе готового персонажа)
      input._applyImage = (dataUrl)=>{
        input.value = dataUrl || '';
        if(dataUrl){ img.src = dataUrl; img.style.display='block'; placeholder.style.display='none'; removeBtn.style.display='inline-block'; addBtn.textContent='Изменить фото'; }
        else { img.src=''; img.style.display='none'; placeholder.style.display='flex'; removeBtn.style.display='none'; addBtn.textContent='Добавить фото'; }
      };
      controls.appendChild(fileInput); controls.appendChild(addBtn); controls.appendChild(removeBtn); controls.appendChild(hint);
      previewWrap.appendChild(img); previewWrap.appendChild(placeholder); previewWrap.appendChild(controls);
      wrap.appendChild(previewWrap);
    }
    else if(f.type==='color'){
      const currentVal = initial[f.key] || '';
      input = document.createElement('input'); input.type='hidden'; input.value = currentVal;
      const row = document.createElement('div'); row.style.cssText = 'display:flex; align-items:center; gap:10px; margin-top:2px;';
      const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.checked = !!currentVal;
      checkbox.style.cssText = 'width:16px; height:16px; accent-color:var(--gold); cursor:pointer;';
      const colorInput = document.createElement('input'); colorInput.type='color';
      colorInput.value = currentVal || '#c9a24c';
      colorInput.disabled = !currentVal;
      colorInput.style.cssText = 'width:48px; height:34px; padding:2px; border-radius:6px; cursor:pointer; opacity:'+(currentVal?'1':'.4')+';';
      const label = document.createElement('span'); label.textContent = 'Свой цвет (иначе — по типу проекта)'; label.style.cssText = 'font-size:12.5px; color:var(--text-dim);';
      checkbox.onchange = ()=>{
        colorInput.disabled = !checkbox.checked;
        colorInput.style.opacity = checkbox.checked ? '1' : '.4';
        input.value = checkbox.checked ? colorInput.value : '';
      };
      colorInput.oninput = ()=>{ if(checkbox.checked) input.value = colorInput.value; };
      row.appendChild(checkbox); row.appendChild(colorInput); row.appendChild(label);
      wrap.appendChild(row);
    }
    else if(f.type==='select'){
      input = document.createElement('select');
      f.options.forEach(([val,lab])=>{ const o=document.createElement('option'); o.value=val; o.textContent=lab; input.appendChild(o); });
      input.value = initial[f.key]!==undefined ? initial[f.key] : (f.options[0]?f.options[0][0]:'');
    } else if(f.type==='multiselect'){
      input = document.createElement('input'); input.type='hidden';
      const selected = new Set(initial[f.key] || []);
      input.value = JSON.stringify(Array.from(selected));
      const box = document.createElement('div');
      box.style.cssText = 'display:flex; flex-direction:column; gap:2px; max-height:190px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:6px 4px; background:var(--bg-alt);';
      if(!f.options.length){
        box.innerHTML = '<div style="font-size:12.5px; color:var(--text-faint); padding:6px 8px;">Нет доступных вариантов</div>';
      }
      f.options.forEach(([val,lab])=>{
        const row = document.createElement('label');
        row.style.cssText = 'display:flex; align-items:center; gap:9px; font-size:13.5px; color:var(--text); cursor:pointer; padding:6px 8px; border-radius:4px;';
        row.onmouseenter = ()=>{ row.style.background='var(--card-hover)'; };
        row.onmouseleave = ()=>{ row.style.background='transparent'; };
        const cb = document.createElement('input'); cb.type='checkbox'; cb.value=val; cb.checked = selected.has(val);
        cb.style.cssText = 'width:17px; height:17px; accent-color:var(--gold); cursor:pointer; flex-shrink:0;';
        cb.addEventListener('change', ()=>{
          if(cb.checked) selected.add(val); else selected.delete(val);
          input.value = JSON.stringify(Array.from(selected));
        });
        const span = document.createElement('span'); span.textContent = lab;
        row.appendChild(cb); row.appendChild(span);
        box.appendChild(row);
      });
      wrap.appendChild(box);
    } else if(f.type==='tags'){
      input = document.createElement('input'); input.type='text'; input.value=(initial[f.key]||[]).join(', '); input.placeholder='тег1, тег2…';
    } else {
      input = document.createElement('input'); input.type='text'; input.value = initial[f.key]!==undefined ? initial[f.key] : ''; if(f.placeholder) input.placeholder=f.placeholder;
    }
    input.dataset.key = f.key; input.dataset.type = f.type;
    wrap.appendChild(input); fw.appendChild(wrap);
  });
  document.getElementById('modalSaveBtn').onclick = ()=>{
    const vals = {};
    fw.querySelectorAll('[data-key]').forEach(inp=>{
      if(inp.dataset.type==='multiselect'){ try{ vals[inp.dataset.key] = JSON.parse(inp.value || '[]'); }catch(e){ vals[inp.dataset.key] = []; } }
      else if(inp.dataset.type==='tags'){ vals[inp.dataset.key] = inp.value.split(',').map(s=>s.trim()).filter(Boolean); }
      else { vals[inp.dataset.key] = inp.value; }
    });
    const req = fields.find(f=> f.required && (f.type==='multiselect' ? (!vals[f.key] || vals[f.key].length===0) : !vals[f.key]));
    if(req){ showToast(`Заполните поле «${req.label}»`); return; }
    onSave(vals);
  };
  if(dangerAction){ document.getElementById('modalDangerBtn').onclick = dangerAction.onClick; }
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('show'); }
function askConfirm(message, confirmLabel, onConfirm){
  const box = document.getElementById('modalBox');
  box.style.maxWidth = '';
  box.innerHTML = `<h2>Подтверждение</h2>
    <p style="font-size:13.5px; color:var(--text-dim); line-height:1.65; margin:0 0 14px;">${esc(message)}</p>
    <label style="display:flex; align-items:center; gap:9px; font-size:13px; color:var(--text); cursor:pointer; padding:10px 12px; background:var(--bg-alt); border:1px solid var(--border-soft); border-radius:var(--radius);">
      <input type="checkbox" id="confirmAgreeCheck" style="width:17px; height:17px; accent-color:var(--thread); cursor:pointer; flex-shrink:0;">
      Подтверждаю удаление
    </label>
    <div id="modalActions">
      <div id="modalLeftActions"></div>
      <div id="modalRightActions" style="display:flex; gap:10px;">
        <button class="btn" id="confirmDangerBtn" disabled style="background:var(--thread); border-color:var(--thread); color:#fff; opacity:.45; cursor:not-allowed;">${esc(confirmLabel||'Удалить')}</button>
      </div>
    </div>`;
  const checkEl = document.getElementById('confirmAgreeCheck');
  const btnEl = document.getElementById('confirmDangerBtn');
  checkEl.addEventListener('change', ()=>{
    btnEl.disabled = !checkEl.checked;
    btnEl.style.opacity = checkEl.checked ? '1' : '.45';
    btnEl.style.cursor = checkEl.checked ? 'pointer' : 'not-allowed';
  });
  btnEl.onclick = ()=>{
    if(!checkEl.checked) return;
    closeModal();
    onConfirm();
  };
  document.getElementById('modalOverlay').classList.add('show');
}

/* ---------------- READ MODAL (full untruncated text) ---------------- */
/* ---------------- CROSS-ENTITY LINKS ("Связано") ---------------- */
function getEntity(coll, id){ return (data[coll]||[]).find(x=>x.id===id) || null; }

function getCharacterLinks(charId, projectId){
  const scenes = data.scenes.filter(s=>s.projectId===projectId && (s.charIds||[]).includes(charId));
  const events = data.events.filter(e=>e.projectId===projectId && (e.charIds||[]).includes(charId));
  const rels = data.relationships
    .filter(r=>r.projectId===projectId && (r.charA===charId || r.charB===charId))
    .map(r=>({ rel:r, other: getEntity('characters', r.charA===charId ? r.charB : r.charA) }))
    .filter(x=>x.other);
  return { scenes, events, rels };
}

function relatedItemBtn(coll, id, projectId, title, sub){
  return `<button type="button" class="related-item" onclick="closeModal(); jumpTo('${coll}','${id}','${projectId}')">
    <span class="related-item-title">${esc(title)}</span>
    ${sub ? `<span class="related-item-sub">${esc(sub)}</span>` : ''}
  </button>`;
}
function relatedGroup(label, itemsHtml){
  if(!itemsHtml || !itemsHtml.length) return '';
  return `<div class="related-group">
    <div class="related-group-label">${esc(label)}</div>
    <div class="related-items">${itemsHtml.join('')}</div>
  </div>`;
}
function renderRelatedBlock(kind, item){
  const pid = item.projectId;
  let groupsHtml = '';
  if(kind==='characters'){
    const { scenes, events, rels } = getCharacterLinks(item.id, pid);
    groupsHtml =
      relatedGroup('Персонажи', rels.map(x=>relatedItemBtn('characters', x.other.id, pid, x.other.name, relTypes(x.rel).map(relTypeLabel).join(', ')))) +
      relatedGroup('События', events.map(e=>relatedItemBtn('events', e.id, pid, e.title, e.date))) +
      relatedGroup('Сцены', scenes.map(s=>relatedItemBtn('scenes', s.id, pid, s.title || 'Без названия')));
  } else if(kind==='events'){
    const chars = (item.charIds||[]).map(id=>getEntity('characters', id)).filter(Boolean);
    groupsHtml = relatedGroup('Участники', chars.map(c=>relatedItemBtn('characters', c.id, pid, c.name, c.role)));
  } else if(kind==='relationships'){
    const a = getEntity('characters', item.charA), b = getEntity('characters', item.charB);
    groupsHtml = relatedGroup('Персонажи', [a,b].filter(Boolean).map(c=>relatedItemBtn('characters', c.id, pid, c.name)));
  }
  if(!groupsHtml) return '';
  return `<div class="related-block"><div class="side-section-label" style="margin-bottom:2px;">Связано</div>${groupsHtml}</div>`;
}

const READ_MODAL_CONFIG = {
  characters: { getItem:(id)=>data.characters.find(x=>x.id===id), fields:()=>characterFields(), title:(it)=>it.name, editFn:openEditCharacterModal },
  relationships: { getItem:(id)=>data.relationships.find(x=>x.id===id), fields:()=>relationshipFields(), title:(it)=>`${charName(it.charA)} ↔ ${charName(it.charB)}`,
    prepare:(it)=>Object.assign({}, it, { types: relTypes(it), evolvesTo: relEvolves(it) }), editFn:openEditRelationshipModal },
  events: { getItem:(id)=>data.events.find(x=>x.id===id), fields:()=>eventFields(), title:(it)=>it.title, editFn:openEditEventModal },
  locations: { getItem:(id)=>data.locations.find(x=>x.id===id), fields:()=>locationFields(), title:(it)=>it.name, editFn:openEditLocationModal },
  factions: { getItem:(id)=>data.factions.find(x=>x.id===id), fields:()=>factionFields(), title:(it)=>it.name, editFn:openEditFactionModal },
  creatures: { getItem:(id)=>data.creatures.find(x=>x.id===id), fields:()=>creatureFields(), title:(it)=>it.name, editFn:openEditCreatureModal },
  myths: { getItem:(id)=>data.myths.find(x=>x.id===id), fields:()=>mythFields(), title:(it)=>it.name, editFn:openEditMythModal },
  magicSystems: { getItem:(id)=>data.magicSystems.find(x=>x.id===id), fields:()=>magicFields(), title:(it)=>it.name, editFn:openEditMagicModal },
  deities: { getItem:(id)=>data.deities.find(x=>x.id===id), fields:()=>deityFields(), title:(it)=>it.name, editFn:openEditDeityModal },
  countries: { getItem:(id)=>data.countries.find(x=>x.id===id), fields:()=>countryFields(), title:(it)=>it.name, editFn:openEditCountryModal },
  dynasties: { getItem:(id)=>data.dynasties.find(x=>x.id===id), fields:()=>dynastyFields(), title:(it)=>it.name, editFn:openEditDynastyModal },
  artifacts: { getItem:(id)=>data.artifacts.find(x=>x.id===id), fields:()=>artifactFields(), title:(it)=>it.name, editFn:openEditArtifactModal },
};
function renderReadFieldValue(f, val){
  if(f.type==='image'){
    if(!val) return null;
    return `<img src="${val}" alt="" title="Нажмите, чтобы увеличить" onclick="openImageViewer(this.src, '')" style="max-width:100%; max-height:340px; border-radius:8px; border:1px solid var(--border); display:block; cursor:zoom-in;">`;
  }
  if(f.type==='color'){
    if(!val) return null;
    return `<span style="display:inline-flex; align-items:center; gap:8px;"><span style="width:18px; height:18px; border-radius:4px; background:${val}; border:1px solid var(--border); display:inline-block;"></span>${esc(val)}</span>`;
  }
  if(f.type==='select'){
    if(val===undefined || val===null || val==='') return null;
    const opt = (f.options||[]).find(o=>o[0]===val);
    return esc(opt ? opt[1] : val);
  }
  if(f.type==='multiselect'){
    if(!val || !val.length) return null;
    const labels = val.map(v=>{ const opt=(f.options||[]).find(o=>o[0]===v); return opt ? opt[1] : v; });
    return `<div class="d-tags">${labels.map(l=>`<span class="d-tag">${esc(l)}</span>`).join('')}</div>`;
  }
  if(f.type==='tags'){
    if(!val || !val.length) return null;
    return `<div class="d-tags">${val.map(t=>`<span class="d-tag">${esc(t)}</span>`).join('')}</div>`;
  }
  if(val===undefined || val===null || val==='') return null;
  return esc(String(val));
}
function openReadModal(kind, id){
  const cfg = READ_MODAL_CONFIG[kind];
  if(!cfg) return;
  let item = cfg.getItem(id);
  if(!item) return;
  if(cfg.prepare) item = cfg.prepare(item);
  const fields = cfg.fields(item);
  const rowsHtml = fields.map(f=>{
    const rendered = renderReadFieldValue(f, item[f.key]);
    if(rendered===null) return '';
    return `<div class="read-field">
      <div class="read-field-label">${esc(f.label)}</div>
      <div class="read-field-value">${rendered}</div>
    </div>`;
  }).join('');
  const box = document.getElementById('modalBox');
  box.style.maxWidth = '680px';
  const relatedHtml = renderRelatedBlock(kind, item);
  box.innerHTML = `<h2>${esc(cfg.title(item))}</h2>
    <div class="read-modal-body">${rowsHtml || '<div class="empty-tab">Нет данных для отображения.</div>'}${relatedHtml}</div>
    <div id="modalActions">
      <div id="modalLeftActions"></div>
      <div id="modalRightActions" style="display:flex; gap:10px;">
        <button class="btn" id="readModalCopyBtn">${btnIconSvg('copy')}Копировать</button>
        ${cfg.editFn ? `<button class="btn" id="readModalEditBtn">${btnIconSvg('edit')}Изменить</button>` : ''}
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('readModalCopyBtn').addEventListener('click', ()=>{
    copyCardToClipboard(cfg.title(item), fields, item);
  });
  if(cfg.editFn){
    document.getElementById('readModalEditBtn').addEventListener('click', ()=>{
      closeModal();
      cfg.editFn(id);
    });
  }
}
// Generic "copy this card's fields to the clipboard" usable directly from a
// card's action row, without first opening the read modal — reuses the
// exact same field list/formatting the read modal's own copy button uses.
function copyEntityToClipboard(kind, id){
  const cfg = READ_MODAL_CONFIG[kind];
  if(!cfg) return;
  let item = cfg.getItem(id);
  if(!item) return;
  if(cfg.prepare) item = cfg.prepare(item);
  const fields = cfg.fields(item);
  copyCardToClipboard(cfg.title(item), fields, item);
}
function fieldValueToPlainText(f, val){
  if(f.type==='image') return null; // nothing sensible to put in plain text for an image
  if(val===undefined || val===null || val==='') return null;
  if(f.type==='color') return String(val);
  if(f.type==='select'){
    const opt = (f.options||[]).find(o=>o[0]===val);
    return opt ? opt[1] : String(val);
  }
  if(f.type==='multiselect'){
    if(!val.length) return null;
    return val.map(v=>{ const opt=(f.options||[]).find(o=>o[0]===v); return opt ? opt[1] : v; }).join(', ');
  }
  if(f.type==='tags'){
    if(!val.length) return null;
    return val.join(', ');
  }
  return String(val);
}
function copyCardToClipboard(title, fields, item){
  const lines = [title, ''];
  fields.forEach(f=>{
    const text = fieldValueToPlainText(f, item[f.key]);
    if(text===null) return;
    lines.push(`${f.label}: ${text}`);
  });
  const text = lines.join('\n');
  const done = ()=> showToast('Карточка скопирована в буфер обмена');
  const fail = ()=> showToast('Не удалось скопировать — попробуйте выделить текст вручную');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(fail);
  } else {
    try{
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }catch(e){ fail(); }
  }
}
/* ---------------- КРЕСТИК И «СВЕРНУТЬ» ДЛЯ ВСЕХ МОДАЛОК ---------------- */
const MODAL_ICON_MIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 18h14"/></svg>';
const MODAL_ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const modalDock = [];   // свёрнутые модалки: {id, title, nodes, maxWidth, pid}
let modalDockSeq = 0;
(function initModalControls(){
  const box = document.getElementById('modalBox'), ov = document.getElementById('modalOverlay');
  if(!box || !ov) return;
  const mo = new MutationObserver(()=>{
    if(!box.firstChild || box.querySelector(':scope > .modal-ctrl')) return;
    const isConfirm = !!box.querySelector('#confirmAgreeCheck');
    const ctrl = document.createElement('div');
    ctrl.className = 'modal-ctrl';
    ctrl.innerHTML = (isConfirm ? '' : `<button type="button" class="modal-ctrl-btn" data-act="min" title="Свернуть" aria-label="Свернуть">${MODAL_ICON_MIN}</button>`) +
      `<button type="button" class="modal-ctrl-btn" data-act="close" title="Закрыть" aria-label="Закрыть">${MODAL_ICON_X}</button>`;
    box.prepend(ctrl);
  });
  mo.observe(box, {childList:true});
  box.addEventListener('click', e=>{
    const b = e.target.closest('.modal-ctrl-btn');
    if(!b) return;
    if(b.dataset.act==='close') closeModal(); else minimizeModal();
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && ov.classList.contains('show')) closeModal();
  });

  window.minimizeModal = function(){
    if(!ov.classList.contains('show') || box.querySelector('#confirmAgreeCheck') || !box.firstChild) return;
    const h = box.querySelector('h2');
    modalDock.push({ id:'md'+(++modalDockSeq), title:(h ? h.textContent : '').trim() || 'Окно', nodes:Array.from(box.childNodes), maxWidth:box.style.maxWidth, pid:state.activeProjectId });
    box.replaceChildren();
    mo.takeRecords();
    ov.classList.remove('show');
    renderModalDock();
  };
  window.restoreModal = function(id){
    const i = modalDock.findIndex(x=>x.id===id);
    if(i<0) return;
    const item = modalDock[i];
    if(item.pid !== state.activeProjectId){ showToast('Это окно относится к другому проекту'); return; }
    if(ov.classList.contains('show')){
      if(box.querySelector('#confirmAgreeCheck')) closeModal(); else minimizeModal();
    }
    const j = modalDock.findIndex(x=>x.id===id);   // индекс мог сместиться
    modalDock.splice(j, 1);
    box.replaceChildren(...item.nodes);
    box.style.maxWidth = item.maxWidth;
    mo.takeRecords();
    ov.classList.add('show');
    renderModalDock();
  };
  window.discardMinimizedModal = function(id){
    const i = modalDock.findIndex(x=>x.id===id);
    if(i>=0){ modalDock.splice(i,1); renderModalDock(); }
  };
})();
function renderModalDock(){
  let dock = document.getElementById('modalDock');
  if(!dock){ dock = document.createElement('div'); dock.id = 'modalDock'; document.body.appendChild(dock); }
  const items = modalDock.filter(x=>x.pid===state.activeProjectId);
  dock.innerHTML = items.map(x=>`<div class="modal-dock-chip" data-id="${x.id}" title="Развернуть: ${esc(x.title)}"><span class="modal-dock-title">${esc(x.title)}</span><button type="button" class="modal-dock-x" data-act="discard" title="Закрыть без сохранения" aria-label="Закрыть без сохранения">${MODAL_ICON_X}</button></div>`).join('');
  dock.classList.toggle('has-items', items.length>0);
  dock.onclick = e=>{
    const chip = e.target.closest('.modal-dock-chip');
    if(!chip) return;
    if(e.target.closest('[data-act="discard"]')) discardMinimizedModal(chip.dataset.id); else restoreModal(chip.dataset.id);
  };
}
// после любой перерисовки (в т.ч. смены проекта) обновляем панель свёрнутых окон
(function(){ const _rm = renderMain; renderMain = function(){ const r = _rm.apply(this, arguments); renderModalDock(); return r; }; })();

/* ---------------- ОТМЕНА / ВОЗВРАТ ДЕЙСТВИЙ (связи, древо династий, карты, сцены) ---------------- */
const HIST_MAX = 100;
const HIST_SCOPES = {
  rel:    ['characters','relationships'],
  tree:   ['dynasties','dynastyMembers','dynastyMemberLinks'],
  maps:   ['maps'],
  scenes: ['scenes','sceneLinks']
};
const HIST_ICON_UNDO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const HIST_ICON_REDO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
const H = { ref:null, base:{}, undo:[], redo:[], busy:false };
let histOrigQueueSave = null;

function histClone(v){
  if(v===null || typeof v!=='object') return v;          // строки (в т.ч. картинки) не копируются — хранится ссылка
  if(Array.isArray(v)) return v.map(histClone);
  const o = {}; for(const k in v) o[k] = histClone(v[k]); return o;
}
function histEqual(a, b){
  if(a===b) return true;
  if(a===null || b===null || typeof a!=='object' || typeof b!=='object') return false;
  if(Array.isArray(a)!==Array.isArray(b)) return false;
  if(Array.isArray(a)){
    if(a.length!==b.length) return false;
    for(let i=0;i<a.length;i++) if(!histEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if(ka.length!==kb.length) return false;
  for(const k of ka){ if(!(k in b) || !histEqual(a[k], b[k])) return false; }
  return true;
}
function histKeys(){ return Object.keys(data).filter(k=>k!=='projects' && Array.isArray(data[k])); }
function histEnsure(){
  if(H.ref===data) return;
  H.ref = data; H.base = {}; H.undo = []; H.redo = [];
  histKeys().forEach(k=>{ H.base[k] = histClone(data[k]); });
}
function histTouches(entry, scope){
  const cols = HIST_SCOPES[scope] || [];
  return Object.keys(entry.after).some(k=>cols.includes(k));
}
function histFindLast(list, scope){
  for(let i=list.length-1; i>=0; i--) if(histTouches(list[i], scope)) return i;
  return -1;
}
function histCan(which, scope){ histEnsure(); return histFindLast(which==='undo' ? H.undo : H.redo, scope) >= 0; }

// вызывается из queueSave сразу после изменения данных
function histRecord(){
  if(H.busy) return;
  if(H.ref!==data){ histEnsure(); return; }
  const before = {}, after = {};
  histKeys().forEach(k=>{
    if(!histEqual(H.base[k], data[k])){ before[k] = H.base[k] || []; after[k] = histClone(data[k]); }
  });
  const keys = Object.keys(after);
  if(!keys.length) return;
  keys.forEach(k=>{ H.base[k] = after[k]; });
  const last = H.undo[H.undo.length-1], now = Date.now();
  // быстрые подряд идущие сохранения тех же данных (перетаскивание и т.п.) склеиваем в одно действие
  if(last && now-last.t < 400 && Object.keys(last.after).length===keys.length && keys.every(k=>k in last.after)){
    keys.forEach(k=>{ last.after[k] = after[k]; }); last.t = now;
  } else {
    H.undo.push({before, after, t:now});
    if(H.undo.length>HIST_MAX) H.undo.shift();
  }
  H.redo = H.redo.filter(e=>!Object.keys(e.after).some(k=>keys.includes(k)));
  histRefreshButtons();
}
function histApply(entry, snapKey){
  H.busy = true;
  try{
    Object.keys(entry.after).forEach(k=>{
      const snap = entry[snapKey][k] || [];
      data[k] = histClone(snap);
      H.base[k] = snap;
    });
  } finally { H.busy = false; }
  if(histOrigQueueSave) histOrigQueueSave();   // сохраняем результат
}
function histRefreshView(scope){
  if(scope==='tree') return refreshTreeEditor();
  if(scope==='maps') return refreshMapEditor();
  renderMain();
}
function histUndo(scope){
  histEnsure();
  const i = histFindLast(H.undo, scope);
  if(i<0){ showToast('Нечего отменять'); return; }
  const e = H.undo.splice(i,1)[0];
  histApply(e, 'before');
  H.redo.push(e);
  histRefreshView(scope);
  histRefreshButtons();
}
function histRedo(scope){
  histEnsure();
  const i = histFindLast(H.redo, scope);
  if(i<0){ showToast('Нечего возвращать'); return; }
  const e = H.redo.splice(i,1)[0];
  histApply(e, 'after');
  H.undo.push(e);
  histRefreshView(scope);
  histRefreshButtons();
}
function histBtnsHtml(scope){
  const u = histCan('undo', scope), r = histCan('redo', scope);
  return `<div class="hist-btns" data-scope="${scope}">` +
    `<button type="button" class="btn btn-sm hist-btn" data-which="undo" title="Отменить действие (Ctrl+Z)" aria-label="Отменить действие" ${u?'':'disabled'} onclick="histUndo('${scope}')">${HIST_ICON_UNDO}</button>` +
    `<button type="button" class="btn btn-sm hist-btn" data-which="redo" title="Вернуть отменённое (Ctrl+Y)" aria-label="Вернуть отменённое действие" ${r?'':'disabled'} onclick="histRedo('${scope}')">${HIST_ICON_REDO}</button>` +
    `</div>`;
}
function histRefreshButtons(){
  document.querySelectorAll('.hist-btns').forEach(box=>{
    const scope = box.dataset.scope;
    box.querySelectorAll('.hist-btn').forEach(b=>{ b.disabled = !histCan(b.dataset.which, scope); });
  });
}
function histCurrentScope(){
  const t = state.activeTab;
  if(t==='relationships') return 'rel';
  if(t==='structure') return 'scenes';
  if(isWorldTab(t)){
    if(state.activeMapId) return 'maps';
    if(state.activeTreeId) return 'tree';
  }
  return null;
}
document.addEventListener('keydown', e=>{
  if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  const isUndo = (k==='z' && !e.shiftKey) || e.code==='KeyZ' && !e.shiftKey;
  const isRedo = k==='y' || (k==='z' && e.shiftKey) || e.code==='KeyY';
  if(!isUndo && !isRedo) return;
  if(document.getElementById('modalOverlay').classList.contains('show')) return;
  const el = document.activeElement;
  if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable)) return;
  const scope = histCurrentScope();
  if(!scope) return;
  e.preventDefault();
  if(isRedo) histRedo(scope); else histUndo(scope);
});
(function(){
  histOrigQueueSave = queueSave;
  queueSave = function(){ try{ histRecord(); }catch(err){ console.error('history', err); } return histOrigQueueSave.apply(this, arguments); };
  const _rm2 = renderMain;
  renderMain = function(){ try{ histEnsure(); }catch(err){ console.error('history', err); } const r = _rm2.apply(this, arguments); try{ syncBoardFs(); }catch(err){ console.error(err); } return r; };
})();

/* ---------------- ПОЛНОЭКРАННЫЙ РЕЖИМ ПОЛЕЙ «СВЯЗИ» И «ДРЕВО ДИНАСТИИ» ---------------- */
const BOARD_FS_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
const BOARD_FS_EXIT_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
function boardVp(kind){
  if(kind==='tree' && state.viewModeDynasty==='family') return document.getElementById('familyViewport');
  const hex = (kind==='rel' ? state.viewModeNetworks : state.viewModeDynasty)==='hex';
  return document.getElementById(kind==='rel' ? (hex ? 'hexRelViewport' : 'relCanvasViewport') : (hex ? 'hexTreeViewport' : 'treeCanvasViewport'));
}
function boardFsBar(vp, kind){
  let bar = vp.querySelector(':scope > .board-fs-bar');
  if(bar) return bar;
  const zi = kind==='rel' ? ['zoomRelCanvas','resetRelCanvasView'] : ['zoomTreeCanvas','resetTreeCanvasView'];
  bar = document.createElement('div');
  bar.className = 'board-fs-bar';
  bar.innerHTML = histBtnsHtml(kind) +
    `<div class="canvas-zoom-controls"><button type="button" class="btn btn-sm" title="Уменьшить" onclick="${zi[0]}(-0.15)">−</button><button type="button" class="btn btn-sm" title="Увеличить" onclick="${zi[0]}(0.15)">+</button></div>` +
    `<button type="button" class="btn btn-sm" onclick="${zi[1]}()">Центрировать</button>` +
    `<button type="button" class="btn btn-sm btn-primary hist-btn" title="Выйти из полноэкранного режима (Esc)" aria-label="Выйти из полноэкранного режима" onclick="toggleBoardFs('${kind}')">${BOARD_FS_EXIT_ICON}</button>`;
  ['mousedown','mouseup','contextmenu','dblclick'].forEach(t=>bar.addEventListener(t, ev=>ev.stopPropagation()));
  vp.appendChild(bar);
  return bar;
}
function applyBoardFs(kind){
  const vp = boardVp(kind);
  if(!vp) return;
  const on = state.boardFs===kind;
  if(on) boardFsBar(vp, kind);
  vp.classList.toggle('board-fs', on);
  document.body.style.overflow = on ? 'hidden' : '';
  if(kind==='tree' && state.viewModeDynasty==='family') requestAnimationFrame(()=>familyFit());
  else if((kind==='rel' ? state.viewModeNetworks : state.viewModeDynasty)==='hex'){
    requestAnimationFrame(()=>{ invalidateHexGrid(kind); drawHexGrid(kind); });
  }
}
function setupBoardFs(kind){ if(state.boardFs===kind) applyBoardFs(kind); }
function toggleBoardFs(kind){
  state.boardFs = state.boardFs===kind ? null : kind;
  applyBoardFs(kind);
}
// если полноэкранная доска исчезла (смена вкладки, возврат к списку) — снимаем блокировку прокрутки
function syncBoardFs(){
  if(!document.querySelector('.board-fs')){ state.boardFs = null; document.body.style.overflow = ''; }
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && state.boardFs && !document.getElementById('modalOverlay').classList.contains('show')) toggleBoardFs(state.boardFs);
});

/* Фото на карточках не должно «отрываться» от неё как обычная картинка при перетаскивании */
document.addEventListener('dragstart', e=>{
  const t = e.target;
  if(t && t.tagName==='IMG' && t.closest && t.closest('#familyViewport, #treeCanvasViewport, #relCanvasViewport, .hex-viewport')) e.preventDefault();
});
let modalMouseDownOnBackdrop = false;
document.getElementById('modalOverlay').addEventListener('mousedown', (e)=>{
  modalMouseDownOnBackdrop = (e.target.id === 'modalOverlay');
});
document.getElementById('modalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='modalOverlay' && modalMouseDownOnBackdrop) closeModal();
});
document.getElementById('newProjectBtn').addEventListener('click', openNewProjectModal);
document.getElementById('projectsExpandBtn').addEventListener('click', toggleProjectsExpanded);
// колесо мыши прокручивает ряд проектов по горизонтали
document.getElementById('projectList').addEventListener('wheel', e=>{
  if(state.projectsExpanded) return;
  const l = e.currentTarget;
  if(l.scrollWidth <= l.clientWidth) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  e.preventDefault();
  l.scrollLeft += d;
}, {passive:false});
window.addEventListener('resize', updateProjectsExpandBtn);

/* ---------------- GLOBAL SEARCH ---------------- */
const searchInput = document.getElementById('globalSearch');
const searchResultsEl = document.getElementById('searchResults');
const searchScopeCheck = document.getElementById('searchScopeCheck');
function runGlobalSearch(){
  const q = searchInput.value.trim().toLowerCase();
  if(!q){ searchResultsEl.classList.remove('show'); return; }
  const scoped = searchScopeCheck.checked && !!state.activeProjectId;
  const hits = [];
  const collect = (coll, kind, nameKey, extraKey)=>{
    data[coll].forEach(item=>{
      if(scoped && item.projectId !== state.activeProjectId) return;
      const hay = ((item[nameKey]||'') + ' ' + (item[extraKey]||'') + ' ' + (item.desc||'')).toLowerCase();
      if(hay.includes(q)) hits.push({item, kind, coll});
    });
  };
  collect('characters','Персонаж','name','aliases');
  collect('scenes','Сцена','title','summary');
  collect('events','Событие','title','arc');
  collect('locations','Локация','name','faction');
  collect('factions','Фракция','name');
  collect('creatures','Существо','name');
  collect('myths','Миф / легенда','name','origin');
  collect('magicSystems','Магия / правило','name','source');
  collect('deities','Божество / культ','name','domain');
  collect('countries','Страна','name','capital');
  collect('dynasties','Династия','name','country');
  collect('artifacts','Артефакт / реликвия','name','owner');
  collect('maps','Карта','name');
  if(!scoped){
    data.projects.forEach(item=>{
      const hay = ((item.name||'') + ' ' + (item.type||'')).toLowerCase();
      if(hay.includes(q)) hits.push({item, kind:'Проект', coll:'projects'});
    });
  }
  if(!hits.length){ searchResultsEl.innerHTML = '<div class="search-empty">Ничего не найдено</div>'; searchResultsEl.classList.add('show'); return; }
  searchResultsEl.innerHTML = hits.slice(0,30).map(h=>{
    const pname = h.coll==='projects' ? h.item.name : (proj(h.item.projectId)||{}).name || '';
    const name = h.item.name || h.item.title;
    return `<div class="search-hit" onclick='jumpTo(${JSON.stringify(h.coll)}, ${JSON.stringify(h.item.id)}, ${JSON.stringify(h.item.projectId||h.item.id)})'>
      <span class="hit-name">${esc(name)}</span>
      <span class="hit-meta">${h.kind}${scoped ? '' : ' · ' + esc(pname)}</span>
    </div>`;
  }).join('');
  searchResultsEl.classList.add('show');
}
searchInput.addEventListener('input', runGlobalSearch);
searchScopeCheck.addEventListener('change', ()=>{
  searchInput.placeholder = searchScopeCheck.checked ? 'Искать в этом проекте…' : 'Искать по всем проектам…';
  document.getElementById('searchScopeTip').textContent = searchScopeCheck.checked ? 'Искать по всем проектам' : 'Ограничить поиск текущим проектом';
  runGlobalSearch();
});
document.addEventListener('click', (e)=>{ if(!document.getElementById('globalSearchWrap').contains(e.target)) searchResultsEl.classList.remove('show'); });

function jumpTo(coll, itemId, projectId){
  searchResultsEl.classList.remove('show'); searchInput.value='';
  const tabMap = { characters:'characters', scenes:'structure', events:'timeline', projects:'overview' };
  state.activeProjectId = coll==='projects' ? itemId : projectId;
  state.activeTab = tabMap[coll] || worldTabOf(coll) || 'overview';
  render();
  setTimeout(()=>{
    const el = document.getElementById('char-'+itemId) || document.getElementById('tlevent-'+itemId);
    if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('highlight-flash'); }
  }, 60);
}

/* ---------------- SETTINGS MENU ---------------- */
const dataToggle = document.getElementById('settingsToggle');
const dataPanel = document.getElementById('settingsPanel');
dataToggle.addEventListener('click', (e)=>{
  e.stopPropagation();
  const isOpen = dataPanel.classList.toggle('show');
  dataToggle.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', (e)=>{
  if(!document.getElementById('settingsSection').contains(e.target)){
    dataPanel.classList.remove('show');
    dataToggle.setAttribute('aria-expanded', 'false');
  }
});

/* ---------------- РЕЗЕРВНЫЕ КОПИИ: скачать на ПК / загрузить из файла ---------------- */
// Рабочие данные живут в облаке; файл — это бэкап «по требованию» (или способ перенести данные в другое место).
function downloadJsonFile(obj, filename){
  const blob = new Blob([JSON.stringify(obj)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function backupDateStamp(){ const d = new Date(), p = n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`; }
function safeFileName(name){ return (name||'проект').replace(/[\\/:*?"<>|]+/g,'').trim().replace(/\s+/g,'_').slice(0,50) || 'проект'; }
function projectScopedKeys(src){ return Object.keys(src).filter(k=>k!=='projects' && k!=='settings' && k!=='_export' && Array.isArray(src[k])); }
// все данные одного проекта, включая участников и связи его древ
function collectProjectData(pid){
  const p = data.projects.find(x=>x.id===pid);
  if(!p) return null;
  const out = { projects:[p] };
  projectScopedKeys(data).forEach(k=>{ out[k] = data[k].filter(x=>x && x.projectId===pid); });
  const dynIds = new Set((out.dynasties||[]).map(d=>d.id));
  ['dynastyMembers','dynastyMemberLinks'].forEach(k=>{
    if(Array.isArray(data[k])) out[k] = data[k].filter(x=>x && (x.projectId===pid || dynIds.has(x.dynastyId)));
  });
  return out;
}
function exportAllProjects(){
  if(!data.projects.length){ showToast('Пока нечего скачивать — проектов нет'); return; }
  downloadJsonFile(Object.assign({ _export:{ type:'all', version:1, at:new Date().toISOString() } }, data), `masterskaya-vse-proekty_${backupDateStamp()}.json`);
  showToast('Резервная копия всех проектов скачана');
}
function exportCurrentProject(){
  const pid = state.activeProjectId;
  const part = pid ? collectProjectData(pid) : null;
  if(!part){ showToast('Сначала выберите проект'); return; }
  const p = part.projects[0];
  downloadJsonFile(Object.assign({ _export:{ type:'project', version:1, at:new Date().toISOString() } }, part), `masterskaya-${safeFileName(p.name)}_${backupDateStamp()}.json`);
  showToast(`Проект «${p.name||'без названия'}» скачан`);
}
// файл с одним проектом: добавляем к существующим или заменяем проект с тем же id; остальные проекты не трогаем
function importProjectFile(parsed){
  const p = parsed.projects && parsed.projects[0];
  if(!p || !p.id) throw new Error('bad project');
  const exists = data.projects.some(x=>x.id===p.id);
  const msg = exists
    ? `Проект «${p.name||'без названия'}» уже есть. Заменить его данными из файла? Остальные проекты не изменятся.`
    : `Добавить проект «${p.name||'без названия'}» из файла к вашим проектам?`;
  askConfirm(msg, exists ? 'Заменить' : 'Добавить', ()=>{
    if(exists){
      const old = collectProjectData(p.id);
      const oldIds = {};
      projectScopedKeys(old).forEach(k=>{ oldIds[k] = new Set(old[k].map(x=>x.id)); });
      data.projects = data.projects.filter(x=>x.id!==p.id);
      projectScopedKeys(data).forEach(k=>{ if(oldIds[k]) data[k] = data[k].filter(x=>!oldIds[k].has(x.id)); });
    }
    data.projects.push(p);
    projectScopedKeys(parsed).forEach(k=>{ data[k] = (Array.isArray(data[k]) ? data[k] : []).concat(parsed[k]); });
    state.activeProjectId = p.id;
    state.activeTab = 'overview';
    queueSave();
    render();
    showToast(exists ? 'Проект заменён данными из файла' : 'Проект добавлен');
  });
}
document.getElementById('exportAllBtn').addEventListener('click', ()=>{ dataPanel.classList.remove('show'); exportAllProjects(); });
document.getElementById('exportProjectBtn').addEventListener('click', ()=>{ dataPanel.classList.remove('show'); exportCurrentProject(); });
document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed || !Array.isArray(parsed.projects)) throw new Error('bad format');
      dataPanel.classList.remove('show');
      if(parsed._export && parsed._export.type==='project'){ importProjectFile(parsed); return; }
      askConfirm('Загрузка заменит ВСЕ текущие данные данными из выбранного файла. Продолжить?', 'Заменить всё', ()=>{
        delete parsed._export;
        data = Object.assign({ projects:[], characters:[], relationships:[], events:[], locations:[], factions:[], scenes:[], sceneLinks:[], creatures:[], myths:[], magicSystems:[], deities:[], maps:[], countries:[], dynasties:[], dynastyMembers:[], dynastyMemberLinks:[], artifacts:[] }, parsed);
        ensureSettings();
        syncViewModes();
        state.activeProjectId = data.projects[0] ? data.projects[0].id : null;
        state.activeTab = 'overview';
        queueSave();
        render();
        showToast('Данные загружены из файла');
      });
    }catch(err){
      showToast('Не удалось прочитать файл — формат не распознан');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
// без локальной копии: предупреждаем, если закрывают вкладку, пока изменения не дошли до облака
window.addEventListener('beforeunload', e=>{
  if(unsavedChanges && currentUser){ e.preventDefault(); e.returnValue = ''; }
});

/* ---------------- AUTH + INIT ---------------- */
document.getElementById('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if(!supabaseConfigured || !supabaseClient){
    setAuthMessage('Сначала заполни SUPABASE_URL и SUPABASE_ANON_KEY в начале скрипта.', 'error');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true;
  setAuthMessage('Выполняется вход…');
  try{
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error) throw error;
    setAuthMessage('Вход выполнен. Загружаем проекты…', 'success');
  }catch(err){
    setAuthMessage(err?.message || 'Не удалось войти.', 'error');
  }finally{ btn.disabled = false; }
});
document.getElementById('authSignUpBtn').addEventListener('click', async ()=>{
  if(!supabaseConfigured || !supabaseClient){
    setAuthMessage('Сначала заполни SUPABASE_URL и SUPABASE_ANON_KEY в начале скрипта.', 'error');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || !password || password.length < 6){
    setAuthMessage('Укажи корректную почту и пароль длиной не менее 6 символов.', 'error');
    return;
  }
  const btn = document.getElementById('authSignUpBtn');
  btn.disabled = true;
  setAuthMessage('Создаем аккаунт…');
  try{
    const { data: result, error } = await supabaseClient.auth.signUp({
      email, password,
      options:{ emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if(error) throw error;
    if(!result?.session){
      setAuthMessage('Аккаунт создан. Если в Supabase включено подтверждение почты, проверь почту и перейди по ссылке, затем войди.', 'success');
    }
  }catch(err){
    setAuthMessage(err?.message || 'Не удалось создать аккаунт.', 'error');
  }finally{ btn.disabled = false; }
});
document.getElementById('signOutBtn').addEventListener('click', async ()=>{
  if(!supabaseClient) return;
  const btn = document.getElementById('signOutBtn');
  btn.disabled = true;
  try{
    clearTimeout(saveTimer);
    if(currentUser && saveRevision>0) await saveCloudData(true);   // перед выходом досохраняем в облако
    const { error } = await supabaseClient.auth.signOut();
    if(error) throw error;
    currentUser = null;
    data = Object.assign({}, DEFAULT_DATA);
    state.activeProjectId = null;
    showAuthGate('Ты вышел из аккаунта.');
  }catch(err){
    showToast('Не удалось выйти: ' + (err?.message || 'ошибка'));
  }finally{ btn.disabled = false; }
});
if(supabaseClient){
  supabaseClient.auth.onAuthStateChange((event, session)=>{
    if(event === 'SIGNED_OUT'){
      currentUser = null;
      data = Object.assign({}, DEFAULT_DATA);
      state.activeProjectId = null;
      showAuthGate();
    }else if(event === 'SIGNED_IN' && session?.user && !currentUser){
      // Событие может прийти раньше ручного обработчика формы.
      setTimeout(()=>loadData(), 0);
    }
  });
}
loadData();
document.addEventListener('click', e=>{ const img=e.target.closest('.d-avatar, .ph-avatar img'); if(img && img.tagName==='IMG' && img.src){ e.preventDefault(); e.stopPropagation(); openImageViewer(img.src, img.alt || ''); } });
