/* script.js — Unified J.U.N.E. site + Admin (client-side demo)
   - Site features: agent grid, terminal feed, news/dossier loaders
   - Admin features: login (localStorage), admin dashboard (agents, tasks, monitor, audit, settings)
   - Hidden admin trigger: Ctrl+Shift+A and mobile long-press
*/

/* ---------------- Utilities ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function el(tag='div', attrs={}, html=''){ const e=document.createElement(tag); if(attrs.cls) e.className = attrs.cls; for(const k in attrs) if(k!=='cls') e.setAttribute(k, attrs[k]); if(html) e.innerHTML = html; return e; }
function nowISO(){ return new Date().toISOString(); }
function showBanner(msg, {danger=false, timeout=2200}={}){ const b = el('div',{cls:'banner'},msg); if(danger) b.style.background='var(--danger)'; document.body.appendChild(b); setTimeout(()=> b.remove(), timeout); }

/* ---------------- Agent dataset (demo & persisted) ---------------- */
const AGENTS_KEY = 'june_agents_v1';
const TASKS_KEY  = 'june_tasks_v1';
const AUDIT_KEY  = 'june_audit_v1';
const ADMIN_KEY  = 'june_admin_v1';

// default agents
function defaultAgents(){
  return [
    { id:'SHADOW-1', codename:'SHADOW-1', real:'A. Keating', role:'Field Operative', threat:3, clearance:3, lastSeen:'Sector 7', avatar:'', secret:btoa('alpha77') },
    { id:'ECHO-7', codename:'ECHO-7', real:'M. Lin', role:'Recon Specialist', threat:2, clearance:2, lastSeen:'Sector 12', avatar:'', secret:btoa('echo-42') },
    { id:'VIPER-3', codename:'VIPER-3', real:'R. Zhou', role:'Cyber Warfare', threat:4, clearance:4, lastSeen:'Sector 3', avatar:'', secret:btoa('v1p3r!') }
  ];
}
function loadAgents(){ try { const raw = localStorage.getItem(AGENTS_KEY); if(!raw){ const def=defaultAgents(); localStorage.setItem(AGENTS_KEY, JSON.stringify(def)); return def; } return JSON.parse(raw); } catch(e){ return defaultAgents(); } }
function saveAgents(list){ localStorage.setItem(AGENTS_KEY, JSON.stringify(list)); audit('agents:save', `count=${list.length}`); }

function loadTasks(){ try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch(e){ return []; } }
function saveTasks(t){ localStorage.setItem(TASKS_KEY, JSON.stringify(t)); audit('tasks:save', `count=${t.length}`); }

function loadAudit(){ try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch(e){ return []; } }
function saveAudit(a){ localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }

function audit(action, details=''){ const entry={at:nowISO(),action,details}; const list=loadAudit(); list.unshift(entry); saveAudit(list.slice(0,500)); }

/* ensure admin credentials exist */
(function ensureAdmin(){
  try {
    if(!localStorage.getItem(ADMIN_KEY)){
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ username:'director_admin', passHash: btoa('JUNE!R8pQ2') }));
    }
  } catch(e){}
})();

function loadAdminCreds(){ try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'); } catch(e){ return {}; } }
function saveAdminCreds(o){ localStorage.setItem(ADMIN_KEY, JSON.stringify(o)); audit('admin:update','credentials'); }

/* ---------------- Agent avatar helper ---------------- */
function avatarDataURL(name, size=128){
  const initials = (name||'AA').split(/[^A-Za-z0-9]+/).map(s=>s[0]).slice(0,2).join('').toUpperCase() || 'AA';
  const palette = ['#0ea5a3','#12b886','#06b6d4','#ef4444','#a78bfa'];
  let h=0; for(let i=0;i<name.length;i++) h=(h<<5)-h+name.charCodeAt(i);
  const bg = palette[Math.abs(h) % palette.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><rect width='100%' height='100%' fill='${bg}' rx='18'/><text x='50%' y='55%' font-family='monospace' font-size='${Math.floor(size*0.42)}' fill='#02121a' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* ---------------- Rendering agent grid on index.html ---------------- */
function renderAgentGrid(){
  const grid = $('#agentGrid');
  if(!grid) return;
  const agents = loadAgents();
  grid.innerHTML = '';
  agents.forEach(a => {
    if(!a.avatar) a.avatar = avatarDataURL(a.codename);
    const card = el('div',{cls:'agent-card'},`
      <img class="agent-avatar" src="${a.avatar}" alt="${a.codename}"/>
      <div class="agent-meta">
        <strong>${a.codename}</strong>
        <div class="muted">${a.role} • ${a.lastSeen}</div>
      </div>
      <div class="agent-actions">
        <button class="btn small" data-act="open" data-id="${a.id}">Dossier</button>
        <button class="btn small" data-act="login" data-id="${a.id}">Login</button>
      </div>
    `);
    grid.appendChild(card);
  });

  grid.querySelectorAll('button[data-act]').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const act = ev.currentTarget.dataset.act;
      const id = ev.currentTarget.dataset.id;
      if(act === 'open'){ localStorage.setItem('june_selected', id); window.location.href = 'dossier.html'; }
      if(act === 'login'){ openLoginModalFor(id); }
    });
  });
}

/* ---------------- Login modal helper (quick agent login) ---------------- */
function openLoginModalFor(agentId){
  // shortcut: redirect to admin login prefilling codename
  localStorage.setItem('june_selected', agentId);
  window.location.href = 'admin-login.html';
}

/* ---------------- Terminal feed ---------------- */
const terminalContent = $('#terminalContent');
const feedLines = [
  '[02:02Z] SIGINT: Confirmed probe on northern node.',
  '[02:14Z] FIELD: Shadow-1 reported fallback comms active.',
  '[03:01Z] CYBER: Suspicious auth attempt blocked.',
  '[03:22Z] FORENSICS: New artifact stored in archive-7.',
  '[04:00Z] RECON: Drone swarm detected over sector 12.'
];
let feedTimer=null, feedIndex=0, feedPaused=false;
function typeToTerminal(txt, speed=18){
  if(!terminalContent) return;
  const block = document.createElement('div'); block.className='terminal-line'; terminalContent.appendChild(block);
  let i=0; (function step(){ if(i < txt.length){ block.textContent += txt[i++]; terminalContent.parentElement.scrollTop = terminalContent.parentElement.scrollHeight; setTimeout(step, speed); } })();
}
function startFeed(){ if(feedTimer) return; feedTimer = setInterval(()=>{ if(feedPaused) return; typeToTerminal(feedLines[feedIndex++ % feedLines.length]); }, 900); }
function pauseFeed(){ feedPaused = true; }
function clearFeed(){ if(terminalContent) terminalContent.textContent=''; feedIndex=0; feedPaused=false; clearInterval(feedTimer); feedTimer=null; }

/* wire terminal buttons if present */
document.addEventListener('DOMContentLoaded', ()=>{
  const s = $('#startFeed'); if(s) s.addEventListener('click', startFeed);
  const p = $('#pauseFeed'); if(p) p.addEventListener('click', ()=> { pauseFeed(); showBanner('Feed paused'); });
  const c = $('#clearFeed'); if(c) c.addEventListener('click', ()=> { clearFeed(); showBanner('Feed cleared'); });
  renderAgentGrid();
});

/* ---------------- Admin login page wiring ---------------- */
if(document.getElementById('doAdminLogin') || document.getElementById('adminUser')){
  const loginBtn = $('#doAdminLogin') || null;
  const userIn = $('#adminUser');
  const passIn = $('#adminPass');
  const msg = $('#loginMsg');
  if(loginBtn) loginBtn.addEventListener('click', ()=>{
    const admin = loadAdminCreds();
    const u = userIn.value.trim();
    const p = passIn.value;
    if(!admin || !admin.username) { if(msg) msg.textContent = 'No admin configured'; return; }
    if(u === admin.username && btoa(p) === admin.passHash){
      sessionStorage.setItem('june_admin_session', JSON.stringify({ user: admin.username, at: nowISO() }));
      audit('admin:signin', admin.username);
      showBanner('Admin authenticated');
      location.href = 'admin-dashboard.html';
    } else {
      if(msg) msg.textContent = 'Invalid credentials';
      showBanner('Access denied', {danger:true});
      audit('admin:signin-failed', u);
    }
  });
}

/* ---------------- Admin Dashboard panes & logic ---------------- */
(function adminDashboardBindings(){
  if(!document.getElementById('adminMain')) return;
  // storage helpers
  function loadAgentsLocal(){ return loadAgents(); } // wrapper
  function loadTasksLocal(){ return loadTasks(); }
  function saveTasksLocal(t){ saveTasks(t); }
  function renderPaneTitle(title){ $('#paneTitle').textContent = title; $('#paneContent').innerHTML = ''; }

  window.showAdminPane = function(name){
    renderPaneTitle(({agents:'Agent Management', tasks:'Task Assignment', monitor:'Monitoring', audit:'Audit Log', settings:'Admin Settings'}[name]||'Admin'));
    if(name === 'agents') renderAgentsPane();
    if(name === 'tasks') renderTasksPane();
    if(name === 'monitor') renderMonitorPane();
    if(name === 'audit') renderAuditPane();
    if(name === 'settings') renderSettingsPane();
  };

  /* Agents pane */
  function renderAgentsPane(){
    const agents = loadAgentsLocal();
    const wrap = el('div');
    const formHtml = `
      <h4>Create / Edit Agent</h4>
      <div class="field"><label class="label">Codename</label><input id="a_codename" class="input"></div>
      <div class="field"><label class="label">Real name</label><input id="a_real" class="input"></div>
      <div class="field"><label class="label">Role</label><input id="a_role" class="input"></div>
      <div class="field" style="display:flex;gap:8px"><input id="a_threat" class="input" placeholder="threat" style="flex:1"><input id="a_clearance" class="input" placeholder="clearance" style="flex:1"></div>
      <div class="field"><label class="label">Secret (password)</label><input id="a_secret" class="input" type="text"></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button id="saveAgentBtn" class="btn primary">Save</button><button id="newAgentBtn" class="btn btn-ghost">Reset</button></div>
    `;
    wrap.appendChild(el('div',{cls:'panel'},formHtml));

    const list = el('div',{cls:'panel'},'<h4>Agents</h4>');
    agents.forEach(a=>{
      list.appendChild(el('div',{cls:'agent-card'},`
        <img class="agent-avatar" src="${a.avatar||avatarDataURL(a.codename)}" />
        <div style="margin-left:72px">
          <strong>${a.codename}</strong><div class="muted">${a.role} • ${a.lastSeen}</div>
          <div style="margin-top:8px"><button class="btn small" data-act="edit" data-id="${a.id}">Edit</button> <button class="btn small" data-act="del" data-id="${a.id}">Delete</button> <button class="btn small" data-act="pw" data-id="${a.id}">Change PW</button></div>
        </div><div style="clear:both"></div>
      `));
    });

    wrap.appendChild(list);
    $('#paneContent').appendChild(wrap);

    $('#saveAgentBtn').addEventListener('click', ()=>{
      const codename = $('#a_codename').value.trim().toUpperCase();
      if(!codename){ showBanner('Codename required', {danger:true}); return; }
      const real = $('#a_real').value.trim();
      const role = $('#a_role').value.trim() || 'Operative';
      const threat = Number($('#a_threat').value) || 3;
      const clearance = Number($('#a_clearance').value) || 3;
      const secret = $('#a_secret').value.trim();
      let agents = loadAgentsLocal();
      const idx = agents.findIndex(x=>x.id === codename);
      if(idx >= 0){
        agents[idx] = Object.assign(agents[idx], { codename, real, role, threat, clearance });
        if(secret) agents[idx].secret = btoa(secret);
        audit('agent:update', codename);
        showBanner('Agent updated');
      } else {
        const newAgent = { id: codename, codename, real, role, threat, clearance, lastSeen:'Unknown', avatar: avatarDataURL(codename), secret: btoa(secret||Math.random().toString(36).slice(2,8)) };
        agents.push(newAgent);
        audit('agent:create', codename);
        showBanner('Agent created');
      }
      saveAgents(agents);
      window.showAdminPane('agents');
    });

    list.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        const act = ev.currentTarget.dataset.act;
        const id = ev.currentTarget.dataset.id;
        if(act === 'edit'){
          const ag = loadAgentsLocal().find(x=>x.id===id);
          if(ag){
            $('#a_codename').value = ag.codename;
            $('#a_real').value = ag.real;
            $('#a_role').value = ag.role;
            $('#a_threat').value = ag.threat;
            $('#a_clearance').value = ag.clearance;
            $('#a_secret').value = '';
            showBanner('Loaded for edit');
          }
        } else if(act === 'del'){
          if(!confirm('Delete agent?')) return;
          let arr = loadAgentsLocal().filter(x=>x.id !== id);
          saveAgents(arr);
          audit('agent:delete', id);
          showBanner('Agent deleted');
          window.showAdminPane('agents');
        } else if(act === 'pw'){
          const np = prompt('Enter new secret for '+id);
          if(np === null) return;
          let arr = loadAgentsLocal();
          const ix = arr.findIndex(x=>x.id===id);
          if(ix>=0){ arr[ix].secret = btoa(np); saveAgents(arr); audit('agent:pw', id); showBanner('Secret changed'); }
        }
      });
    });
  }

  /* Tasks pane */
  function renderTasksPane(){
    const agents = loadAgentsLocal();
    const tasks = loadTasksLocal();
    const wrap = el('div');
    wrap.appendChild(el('div',{cls:'panel'},`
      <h4>Assign Task</h4>
      <div class="field"><label class="label">Agent</label><select id="task_agent_select" class="input">${agents.map(a=>`<option value="${a.id}">${a.codename}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Task Title</label><input id="task_title" class="input"></div>
      <div class="field"><label class="label">Details</label><input id="task_details" class="input"></div>
      <div style="display:flex;gap:8px;margin-top:8px"><button id="assignTaskBtn" class="btn primary">Assign</button><button id="taskClearBtn" class="btn btn-ghost">Clear</button></div>
    `));
    const list = el('div',{cls:'panel'},'<h4>Active Tasks</h4>');
    tasks.forEach(t=>{
      const agent = agents.find(a=>a.id===t.agentId);
      list.appendChild(el('div',{},`
        <strong>${t.title}</strong>
        <div class="muted">Assigned to: ${agent?agent.codename:'Unknown'} • ${t.status || 'assigned'} • ${t.createdAt}</div>
        <div style="margin-top:8px">${t.details || ''}</div>
        <div style="margin-top:8px"><button class="btn small" data-task="${t.id}" data-act="done">Mark Done</button> <button class="btn small" data-task="${t.id}" data-act="del">Delete</button></div>
      `));
    });
    wrap.appendChild(list);
    $('#paneContent').appendChild(wrap);

    $('#assignTaskBtn').addEventListener('click', ()=>{
      const aid = $('#task_agent_select').value; const title = $('#task_title').value.trim(); const details = $('#task_details').value.trim();
      if(!aid || !title){ showBanner('Select agent and title', {danger:true}); return; }
      const t = { id: 'T'+Math.random().toString(36).slice(2,8), agentId: aid, title, details, status:'assigned', createdAt: nowISO() };
      const tasks = loadTasksLocal(); tasks.unshift(t); saveTasksLocal(tasks); audit('task:create', `${t.id} -> ${aid}`); showBanner('Task assigned'); window.showAdminPane('tasks');
    });

    list.querySelectorAll('button[data-act]').forEach(b=>{
      b.addEventListener('click', (ev)=>{
        const tid = ev.currentTarget.dataset.task; const act = ev.currentTarget.dataset.act;
        let tasks = loadTasksLocal(); const idx = tasks.findIndex(x=>x.id===tid); if(idx === -1) return;
        if(act === 'done'){ tasks[idx].status = 'complete'; saveTasksLocal(tasks); audit('task:complete', tid); showBanner('Task marked complete'); window.showAdminPane('tasks'); }
        if(act === 'del'){ tasks.splice(idx,1); saveTasksLocal(tasks); audit('task:delete', tid); showBanner('Task deleted'); window.showAdminPane('tasks'); }
      });
    });
  }

  /* Monitor pane */
  function renderMonitorPane(){
    const agents = loadAgentsLocal();
    const wrap = el('div',{cls:'panel'},'<h4>Agent Monitor</h4>');
    const grid = el('div',{cls:'agent-grid'});
    agents.forEach(a=>{
      const status = Math.random() > 0.4 ? 'online' : 'offline';
      grid.appendChild(el('div',{cls:'agent-card'},`<strong>${a.codename}</strong><div class="muted">${a.role} • ${a.lastSeen}</div><div style="margin-top:8px">Status: <strong>${status}</strong></div><div style="margin-top:8px"><button class="btn small" data-id="${a.id}" data-act="ping">Ping</button></div>`));
    });
    wrap.appendChild(grid);
    $('#paneContent').appendChild(wrap);
    grid.querySelectorAll('button[data-act]').forEach(b=> b.addEventListener('click', ev=> { showBanner('Ping sent'); audit('monitor:ping', ev.currentTarget.dataset.id); }));
  }

  /* Audit pane */
  function renderAuditPane(){
    const list = loadAudit();
    const wrap = el('div',{cls:'panel'});
    if(list.length === 0) wrap.innerHTML = '<div class="muted">No audit events</div>';
    else wrap.innerHTML = list.map(it => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)"><div class="muted">${it.at}</div><div>${it.action}${it.details ? ' — ' + it.details : ''}</div></div>`).join('');
    $('#paneContent').appendChild(wrap);
  }

  /* Settings pane */
  function renderSettingsPane(){
    const admin = loadAdminCreds();
    const wrap = el('div',{cls:'panel'},`
      <h4>Admin Settings</h4>
      <div class="field"><label class="label">Current Admin</label><div class="muted">${admin.username||'—'}</div></div>
      <div class="field"><label class="label">Rotate admin password</label><input id="newAdminPass" class="input" placeholder="New password"></div>
      <div style="display:flex;gap:8px;margin-top:8px"><button id="saveAdminPass" class="btn">Save</button><button id="resetDefaults" class="btn btn-ghost">Reset to Demo</button></div>
    `);
    $('#paneContent').appendChild(wrap);
    $('#saveAdminPass').addEventListener('click', ()=> {
      const p = $('#newAdminPass').value.trim(); if(!p){ showBanner('Enter a new password', {danger:true}); return; }
      const cur = loadAdminCreds(); cur.passHash = btoa(p); saveAdminCreds(cur); audit('admin:passwd','rotated'); showBanner('Admin password updated'); $('#newAdminPass').value = '';
    });
    $('#resetDefaults').addEventListener('click', ()=> { saveAdminCreds({ username:'director_admin', passHash:btoa('JUNE!R8pQ2') }); audit('admin:reset','defaults'); showBanner('Admin reset to demo creds'); });
  }

  // default pane
  window.showAdminPane('agents');
})(); // end adminDashboardBindings

/* ---------------- Hidden keyboard admin trigger (global) ---------------- */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) location.href = 'admin-login.html';
});
