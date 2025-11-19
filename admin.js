/* admin.js
   Full Admin Panel logic (Agents, Tasks, Monitor, Audit, Settings)
   - uses localStorage keys:
     - june_admin_v1 (credentials)
     - june_agents_v1
     - june_tasks_v1
     - june_audit_v1
   - exposes: window.showAdminPane(name)
*/

(function(){

/* -----------------------
   Storage keys & helpers
   ----------------------- */
const ADMIN_KEY = 'june_admin_v1';
const AGENTS_KEY = 'june_agents_v1';
const TASKS_KEY  = 'june_tasks_v1';
const AUDIT_KEY  = 'june_audit_v1';

function nowISO(){ return new Date().toISOString(); }
function loadJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch(e){ return fallback; } }
function saveJSON(key, obj){ try { localStorage.setItem(key, JSON.stringify(obj)); } catch(e){ console.error('save failed', e); } }

/* -----------------------
   Init default data (demo)
   ----------------------- */
(function ensureDefaults(){
  try {
    if(!localStorage.getItem(ADMIN_KEY)){
      const defaultAdmin = { username:'director_admin', passHash: btoa('JUNE!R8pQ2') };
      localStorage.setItem(ADMIN_KEY, JSON.stringify(defaultAdmin));
    }
    if(!localStorage.getItem(AGENTS_KEY)){
      const sample = [
        { id:'SHADOW-1', codename:'SHADOW-1', real:'A. Keating', role:'Field Operative', threat:3, clearance:3, lastSeen:'Sector 7', avatar:'', secret:btoa('alpha77') },
        { id:'ECHO-7', codename:'ECHO-7', real:'M. Lin', role:'Recon Specialist', threat:2, clearance:2, lastSeen:'Sector 12', avatar:'', secret:btoa('echo-42') },
        { id:'VIPER-3', codename:'VIPER-3', real:'R. Zhou', role:'Cyber Warfare', threat:4, clearance:4, lastSeen:'Sector 3', avatar:'', secret:btoa('v1p3r!') }
      ];
      saveJSON(AGENTS_KEY, sample);
    }
    if(!localStorage.getItem(TASKS_KEY)) saveJSON(TASKS_KEY, []);
    if(!localStorage.getItem(AUDIT_KEY)) saveJSON(AUDIT_KEY, []);
  } catch(e){ console.warn('init defaults failed', e); }
})();

/* -----------------------
   Audit helper
   ----------------------- */
function audit(action, details=''){
  const list = loadJSON(AUDIT_KEY, []);
  list.unshift({ at: nowISO(), action, details });
  saveJSON(AUDIT_KEY, list.slice(0,1000));
}

/* -----------------------
   Agent / Task loaders
   ----------------------- */
function loadAgents(){ return loadJSON(AGENTS_KEY, []); }
function saveAgents(list){ saveJSON(AGENTS_KEY, list); audit('agents:save', `count=${list.length}`); }

function loadTasks(){ return loadJSON(TASKS_KEY, []); }
function saveTasks(list){ saveJSON(TASKS_KEY, list); audit('tasks:save', `count=${list.length}`); }

function loadAudit(){ return loadJSON(AUDIT_KEY, []); }
function saveAudit(list){ saveJSON(AUDIT_KEY, list); }

/* -----------------------
   Small UI helpers
   ----------------------- */
function el(tag='div', attrs={}, html=''){ const e=document.createElement(tag); if(attrs.cls) e.className=attrs.cls; for(const k in attrs) if(k!=='cls') e.setAttribute(k, attrs[k]); if(html) e.innerHTML = html; return e; }
function showBanner(msg, {danger=false,timeout=2200}={}){ const b = el('div',{cls:'banner'},msg); if(danger) b.style.background='var(--danger)'; document.body.appendChild(b); setTimeout(()=> b.remove(), timeout); }

/* -----------------------
   Avatar helper
   ----------------------- */
function avatarDataURL(name, size=128){
  const initials = (name||'AA').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const palette = ['#0ea5a3','#12b886','#06b6d4','#ef4444','#a78bfa'];
  let h=0; for(let i=0;i<name.length;i++) h=(h<<5)-h+name.charCodeAt(i);
  const bg = palette[Math.abs(h) % palette.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><rect width='100%' height='100%' fill='${bg}' rx='12'/><text x='50%' y='55%' font-family='monospace' font-size='${Math.floor(size*0.42)}' fill='#02121a' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* -----------------------
   Pane rendering
   ----------------------- */
const paneTitle = document.getElementById && document.getElementById('paneTitle');
const paneContent = document.getElementById && document.getElementById('paneContent');

function clearPane(){
  if(paneTitle) paneTitle.textContent = '';
  if(paneContent) paneContent.innerHTML = '';
}

/* ---------- Agents Pane ---------- */
function renderAgentsPane(){
  if(!paneContent) return;
  paneTitle && (paneTitle.textContent = 'Agent Management');

  const agents = loadAgents();

  const wrapper = el('div');

  // form (grid-based)
  const formHtml = `
  <div class="agent-form" id="agentFormPanel">
    <div class="full-row"><h4 style="margin:0 0 6px 0;">Create / Edit Agent</h4></div>

    <label for="a_codename">Codename</label>
    <input id="a_codename" class="input" placeholder="ECHO-7">

    <label for="a_real">Real name</label>
    <input id="a_real" class="input" placeholder="M. Lin">

    <label for="a_role">Role</label>
    <input id="a_role" class="input" placeholder="Recon Specialist">

    <label for="a_threat">Threat / Clearance</label>
    <div class="inline-row">
      <input id="a_threat" class="input" placeholder="Threat (1-5)">
      <input id="a_clearance" class="input" placeholder="Clearance (1-5)">
    </div>

    <label for="a_secret">Secret (password)</label>
    <input id="a_secret" class="input" placeholder="password">

    <div class="form-actions full-row">
      <button id="saveAgentBtn" class="btn primary">Save</button>
      <button id="newAgentBtn" class="btn ghost">Reset</button>
    </div>
  </div>
  `;

  wrapper.appendChild(el('div',{cls:'panel'},formHtml));

  // agents list
  const listPanel = el('div',{cls:'panel'});
  listPanel.innerHTML = '<h4 style="margin-top:0">Agents</h4>';
  agents.forEach(a=>{
    if(!a.avatar) a.avatar = avatarDataURL(a.codename || a.id);
    const row = el('div',{cls:'agent-card'},`
      <img class="agent-avatar" src="${a.avatar}" style="width:56px;height:56px;border-radius:10px;float:left;margin-right:12px;" />
      <div style="margin-left:72px">
        <strong>${a.codename}</strong><div class="muted">${a.role} • ${a.lastSeen || 'Unknown'}</div>
        <div style="margin-top:8px"><button class="btn small" data-act="edit" data-id="${a.id}">Edit</button> <button class="btn small" data-act="del" data-id="${a.id}">Delete</button> <button class="btn small" data-act="pw" data-id="${a.id}">Change PW</button></div>
      </div>
      <div style="clear:both"></div>
    `);
    listPanel.appendChild(row);
  });

  wrapper.appendChild(listPanel);
  paneContent.innerHTML = '';
  paneContent.appendChild(wrapper);

  // wire form handlers
  function resetForm(){
    const fields = ['a_codename','a_real','a_role','a_threat','a_clearance','a_secret'];
    fields.forEach(id=> { const el = document.getElementById(id); if(el) el.value = ''; });
  }

  document.getElementById('newAgentBtn').addEventListener('click', (e)=> { e.preventDefault(); resetForm(); });

  document.getElementById('saveAgentBtn').addEventListener('click', (e)=>{
    e.preventDefault();
    const codename = (document.getElementById('a_codename').value || '').trim().toUpperCase();
    if(!codename){ showBanner('Codename required', {danger:true}); return; }
    const real = (document.getElementById('a_real').value || '').trim();
    const role = (document.getElementById('a_role').value || '').trim() || 'Operative';
    const threat = Number(document.getElementById('a_threat').value) || 3;
    const clearance = Number(document.getElementById('a_clearance').value) || 3;
    const secret = (document.getElementById('a_secret').value || '').trim();

    const agentsLocal = loadAgents();
    const idx = agentsLocal.findIndex(x => (x.id||x.codename) === codename || x.codename === codename);
    if(idx >= 0){
      // update
      agentsLocal[idx].codename = codename;
      agentsLocal[idx].real = real;
      agentsLocal[idx].role = role;
      agentsLocal[idx].threat = threat;
      agentsLocal[idx].clearance = clearance;
      if(secret) agentsLocal[idx].secret = btoa(secret);
      audit('agent:update', codename);
      showBanner('Agent updated');
    } else {
      // create
      const newAgent = { id: codename, codename, real, role, threat, clearance, lastSeen:'Unknown', avatar: avatarDataURL(codename), secret: btoa(secret || Math.random().toString(36).slice(2,8)) };
      agentsLocal.push(newAgent);
      audit('agent:create', codename);
      showBanner('Agent created');
    }
    saveAgents(agentsLocal);
    // re-render pane
    window.showAdminPane('agents');
  });

  // wire agent list action buttons (edit/delete/pw)
  listPanel.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const act = ev.currentTarget.dataset.act;
      const id = ev.currentTarget.dataset.id;
      const agentsLocal = loadAgents();
      if(act === 'edit'){
        const a = agentsLocal.find(x => x.id === id || x.codename === id);
        if(a){
          document.getElementById('a_codename').value = a.codename;
          document.getElementById('a_real').value = a.real || '';
          document.getElementById('a_role').value = a.role || '';
          document.getElementById('a_threat').value = a.threat || '';
          document.getElementById('a_clearance').value = a.clearance || '';
          document.getElementById('a_secret').value = '';
          showBanner('Loaded agent for edit');
        }
      } else if(act === 'del'){
        if(!confirm('Delete agent?')) return;
        const filtered = agentsLocal.filter(x => x.id !== id && x.codename !== id);
        saveAgents(filtered);
        audit('agent:delete', id);
        showBanner('Agent deleted');
        window.showAdminPane('agents');
      } else if(act === 'pw'){
        const np = prompt('Enter new password for ' + id);
        if(np === null) return;
        const ix = agentsLocal.findIndex(x => x.id === id || x.codename === id);
        if(ix >= 0){ agentsLocal[ix].secret = btoa(np); saveAgents(agentsLocal); audit('agent:pw', id); showBanner('Secret changed'); }
      }
    });
  });
}

/* ---------- Tasks Pane ---------- */
function renderTasksPane(){
  if(!paneContent) return;
  paneTitle && (paneTitle.textContent = 'Task Assignment');

  const agents = loadAgents();
  const tasks = loadTasks();

  const wrap = el('div');
  wrap.appendChild(el('div',{cls:'panel'},`
    <h4>Assign Task</h4>
    <div class="field"><label class="label">Agent</label><select id="task_agent_select" class="input">${agents.map(a=>`<option value="${a.id}">${a.codename}</option>`).join('')}</select></div>
    <div class="field"><label class="label">Task Title</label><input id="task_title" class="input" /></div>
    <div class="field"><label class="label">Details</label><input id="task_details" class="input" /></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button id="assignTaskBtn" class="btn primary">Assign</button> <button id="taskClearBtn" class="btn ghost">Clear</button></div>
  `));

  const list = el('div',{cls:'panel'});
  list.innerHTML = '<h4>Active Tasks</h4>';
  tasks.forEach(t=>{
    const agent = agents.find(a=>a.id === t.agentId);
    list.appendChild(el('div',{},`
      <strong>${t.title}</strong>
      <div class="muted">Assigned to: ${agent?agent.codename:'Unknown'} • ${t.status || 'assigned'} • ${t.createdAt}</div>
      <div style="margin-top:8px">${t.details || ''}</div>
      <div style="margin-top:8px"><button class="btn small" data-task="${t.id}" data-act="done">Mark Done</button> <button class="btn small" data-task="${t.id}" data-act="del">Delete</button></div>
    `));
  });

  wrap.appendChild(list);
  paneContent.innerHTML = '';
  paneContent.appendChild(wrap);

  document.getElementById('assignTaskBtn').addEventListener('click', ()=>{
    const aid = document.getElementById('task_agent_select').value;
    const title = (document.getElementById('task_title').value || '').trim();
    const details = (document.getElementById('task_details').value || '').trim();
    if(!aid || !title){ showBanner('Select agent and title', {danger:true}); return; }
    const tasksLocal = loadTasks();
    const t = { id: 'T'+Math.random().toString(36).slice(2,8), agentId: aid, title, details, status:'assigned', createdAt: nowISO() };
    tasksLocal.unshift(t);
    saveTasks(tasksLocal);
    audit('task:create', `${t.id} -> ${aid}`);
    showBanner('Task assigned');
    window.showAdminPane('tasks');
  });

  list.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const tid = ev.currentTarget.dataset.task;
      const act = ev.currentTarget.dataset.act;
      let tasksLocal = loadTasks();
      const idx = tasksLocal.findIndex(x=>x.id===tid);
      if(idx === -1) return;
      if(act === 'done'){ tasksLocal[idx].status = 'complete'; saveTasks(tasksLocal); audit('task:complete', tid); showBanner('Task marked complete'); window.showAdminPane('tasks'); }
      if(act === 'del'){ tasksLocal.splice(idx,1); saveTasks(tasksLocal); audit('task:delete', tid); showBanner('Task deleted'); window.showAdminPane('tasks'); }
    });
  });
}

/* ---------- Monitor Pane ---------- */
function renderMonitorPane(){
  if(!paneContent) return;
  paneTitle && (paneTitle.textContent = 'Monitoring');

  const agents = loadAgents();
  const wrap = el('div',{cls:'panel'});
  wrap.innerHTML = '<h4>Agent Monitor</h4>';
  const grid = el('div',{cls:'agent-grid'});

  agents.forEach(a=>{
    const status = Math.random() > 0.4 ? 'online' : 'offline';
    const card = el('div',{cls:'agent-card'},`
      <strong>${a.codename}</strong>
      <div class="muted">${a.role} • ${a.lastSeen || 'Unknown'}</div>
      <div style="margin-top:8px">Status: <strong>${status}</strong></div>
      <div style="margin-top:8px"><button class="btn small" data-id="${a.id}" data-act="ping">Ping</button></div>
    `);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  paneContent.innerHTML = '';
  paneContent.appendChild(wrap);

  grid.querySelectorAll('button[data-act]').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const id = ev.currentTarget.dataset.id;
      audit('monitor:ping', id);
      showBanner(`Pinged ${id}`);
    });
  });
}

/* ---------- Audit Pane ---------- */
function renderAuditPane(){
  if(!paneContent) return;
  paneTitle && (paneTitle.textContent = 'Audit Log');

  const list = loadAudit();
  const wrap = el('div',{cls:'panel'});
  if(list.length === 0) wrap.innerHTML = '<div class="muted">No audit events</div>';
  else wrap.innerHTML = list.map(it => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)"><div class="muted">${it.at}</div><div>${it.action}${it.details ? ' — ' + it.details : ''}</div></div>`).join('');
  paneContent.innerHTML = '';
  paneContent.appendChild(wrap);
}

/* ---------- Settings Pane ---------- */
function renderSettingsPane(){
  if(!paneContent) return;
  paneTitle && (paneTitle.textContent = 'Admin Settings');

  const admin = loadJSON(ADMIN_KEY, {});
  const wrap = el('div',{cls:'panel'},`
    <h4>Admin Settings</h4>
    <div class="field"><label class="label">Current Admin</label><div class="muted">${admin.username || '—'}</div></div>
    <div class="field"><label class="label">Rotate admin password</label><input id="newAdminPass" class="input" placeholder="New password"></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button id="saveAdminPass" class="btn">Save</button> <button id="resetDefaults" class="btn btn-ghost">Reset to Demo</button></div>
  `);

  paneContent.innerHTML = '';
  paneContent.appendChild(wrap);

  document.getElementById('saveAdminPass').addEventListener('click', ()=>{
    const p = (document.getElementById('newAdminPass').value || '').trim();
    if(!p){ showBanner('Enter a new password', {danger:true}); return; }
    const cur = loadJSON(ADMIN_KEY, {});
    cur.passHash = btoa(p);
    saveJSON(ADMIN_KEY, cur);
    audit('admin:passwd', 'rotated');
    showBanner('Admin password updated');
    document.getElementById('newAdminPass').value = '';
  });

  document.getElementById('resetDefaults').addEventListener('click', ()=>{
    if(!confirm('Reset admin to demo credentials?')) return;
    saveJSON(ADMIN_KEY, { username:'director_admin', passHash:btoa('JUNE!R8pQ2') });
    audit('admin:reset','defaults restored');
    showBanner('Admin reset to demo credentials');
  });
}

/* -----------------------
   Expose main showAdminPane
   ----------------------- */
window.showAdminPane = function(name){
  if(!paneContent) return;
  switch(name){
    case 'agents': renderAgentsPane(); break;
    case 'tasks': renderTasksPane(); break;
    case 'monitor': renderMonitorPane(); break;
    case 'audit': renderAuditPane(); break;
    case 'settings': renderSettingsPane(); break;
    default: renderAgentsPane(); break;
  }
};

/* -----------------------
   Protect admin dashboard (in-case loaded directly)
   ----------------------- */
function protectAdminIfNeeded(){
  try {
    const s = sessionStorage.getItem('june_admin_session');
    if(!s){
      // not logged in - let admin-login.html redirect normally
      // (we won't forcibly redirect here to allow admin-login to run)
      return false;
    }
    return true;
  } catch(e){ return false; }
}

/* -----------------------
   Auto-show default pane on load
   ----------------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  // render default if adminMain exists
  if(document.getElementById('adminMain')){
    // optional protection: if not logged in, admin-dashboard.html usually redirects already
    const ok = protectAdminIfNeeded();
    if(!ok){
      // if admin page opened without session, we don't populate sensitive data
      const pane = document.getElementById('paneContent');
      if(pane) pane.innerHTML = '<div class="panel"><p class="muted">No admin session detected — please log in.</p></div>';
      return;
    }
    // show default pane
    window.showAdminPane('agents');
  }
});

})(); // end admin module
