// dossier.js — robust dossier viewer logic (works with admin.js / script.js localStorage keys)

// Helper: safe parse
function safeParse(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch(e){ return fallback; } }

// Sample fallback dataset if no agents present
const SAMPLE_AGENTS = [
  { id:'SHADOW-1', codename:'SHADOW-1', real:'A. Keating', role:'Field Operative', threat:3, clearance:3, lastSeen:'Sector 7', avatar:'', notes:'Operative specialising in close-quarters infiltration and signal interception.' },
  { id:'ECHO-7', codename:'ECHO-7', real:'M. Lin', role:'Recon Specialist', threat:2, clearance:2, lastSeen:'Sector 12', avatar:'', notes:'Long-range reconnaissance and overwatch.' },
  { id:'VIPER-3', codename:'VIPER-3', real:'R. Zhou', role:'Cyber Warfare', threat:4, clearance:4, lastSeen:'Sector 3', avatar:'', notes:'Rapid response cyber operator.' }
];

// Keys used by the site
const AGENTS_KEY = 'june_agents_v1';   // where admin.js stores agents
const SELECT_KEY = 'june_selected';    // selected agent id

// DOM references
const elAgentList = document.getElementById('d_agentList');
const elAvatar = document.getElementById('dAvatar');
const elCodename = document.getElementById('dCodename');
const elRole = document.getElementById('dRole');
const elLast = document.getElementById('dLast');
const elThreat = document.getElementById('dThreat');
const elReport = document.getElementById('dReport');
const elStatus = document.getElementById('dStatus');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnBack = document.getElementById('backBtn');
const btnReplay = document.getElementById('replayBtn');
const btnDownload = document.getElementById('downloadBtn');

let agents = [];
let currentIndex = 0;
let typingTimer = null;

// Utility: avatar generator (SVG data URL)
function avatarDataURL(name, size=128){
  const initials = (name||'AA').split(/[^A-Za-z0-9]+/).map(s=>s[0]).slice(0,2).join('').toUpperCase() || 'AA';
  const colors = ['#12b886','#06b6d4','#0ea5a3','#a78bfa','#f97316'];
  let h=0; for(let i=0;i<name.length;i++) h=(h<<5)-h+name.charCodeAt(i);
  const bg = colors[Math.abs(h) % colors.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><rect width='100%' height='100%' fill='${bg}' rx='12'/><text x='50%' y='55%' font-family='monospace' font-size='${Math.floor(size*0.42)}' fill='#02121a' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Load agents from localStorage (admin.js uses june_agents_v1)
function loadAgents(){
  const loaded = safeParse(AGENTS_KEY, null);
  agents = Array.isArray(loaded) ? loaded.slice() : SAMPLE_AGENTS.slice();
  // ensure avatar exists
  agents.forEach(a => { if(!a.avatar) a.avatar = avatarDataURL(a.codename || a.id || 'AA'); });
  // if june_selected present use it
  const sel = localStorage.getItem(SELECT_KEY);
  if(sel){
    const idx = agents.findIndex(x => x.id === sel || x.codename === sel);
    currentIndex = idx >= 0 ? idx : 0;
  } else currentIndex = 0;
}

// Render left agent list
function renderAgentList(){
  if(!elAgentList) return;
  elAgentList.innerHTML = '';
  agents.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = 'admin-box';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '10px';
    btn.innerHTML = `<div style="width:40px;height:40px;border-radius:8px;overflow:hidden"><img src="${a.avatar}" style="width:100%;height:100%;object-fit:cover" alt=""></div><div style="flex:1;text-align:left"><strong style="display:block;font-size:13px">${a.codename}</strong><span class="muted" style="font-size:12px">${a.role}</span></div>`;
    btn.addEventListener('click', ()=> { currentIndex = i; selectAgent(i); });
    elAgentList.appendChild(btn);
  });
}

// Select and display agent by index
function selectAgent(idx){
  if(idx < 0) idx = 0;
  if(idx >= agents.length) idx = agents.length -1;
  currentIndex = idx;
  const a = agents[idx];
  if(!a) return;
  // store selection so other pages know
  try { localStorage.setItem(SELECT_KEY, a.id || a.codename); } catch(e){}
  elAvatar.src = a.avatar || avatarDataURL(a.codename || a.id);
  elCodename.textContent = a.codename || a.id || '—';
  elRole.textContent = `${a.role || '—'} • Clearance: ${a.clearance || '—'}`;
  elLast.textContent = `Last seen: ${a.lastSeen || 'Unknown'}`;
  elThreat.textContent = `Threat: ${'★'.repeat(a.threat || 0)}`;
  // build report text
  const report = `Codename: ${a.codename}\nReal name: ${a.real || '—'}\nRole: ${a.role || '—'}\nThreat level: ${a.threat || 0}\nLast seen: ${a.lastSeen || 'Unknown'}\n\nBio:\n${a.notes || a.bio || 'No further data.'}\n\n(End of report)`;
  showReport(report);
  elStatus.textContent = `Loaded: ${new Date().toLocaleString()}`;
}

// Show full report immediately (stop any typing)
function showReport(text){
  if(!elReport) return;
  clearTyping();
  elReport.textContent = text;
}

// Typewriter replay
function replayReport(){
  if(!elReport) return;
  const a = agents[currentIndex];
  const text = elReport.textContent || `Codename: ${a.codename}\nNo report.`;
  elReport.textContent = '';
  let i = 0;
  clearTyping();
  typingTimer = setInterval(()=>{
    elReport.textContent += text[i++] || '';
    elReport.parentElement.scrollTop = elReport.parentElement.scrollHeight;
    if(i >= text.length) { clearTyping(); }
  }, 12);
}

function clearTyping(){ if(typingTimer) { clearInterval(typingTimer); typingTimer = null; } }

// download report as text file
function downloadReport(){
  const text = elReport.textContent || '';
  const a = agents[currentIndex];
  const name = (a && (a.codename || a.id)) ? `${a.codename || a.id}_report.txt` : 'dossier.txt';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click();
  link.remove(); URL.revokeObjectURL(url);
}

// Prev / Next handlers
function prevAgent(){ if(agents.length === 0) return; currentIndex = (currentIndex -1 + agents.length) % agents.length; selectAgent(currentIndex); }
function nextAgent(){ if(agents.length === 0) return; currentIndex = (currentIndex +1) % agents.length; selectAgent(currentIndex); }

// On load
document.addEventListener('DOMContentLoaded', ()=>{
  loadAgents();
  renderAgentList();
  selectAgent(currentIndex);

  if(btnPrev) btnPrev.addEventListener('click', prevAgent);
  if(btnNext) btnNext.addEventListener('click', nextAgent);
  if(btnBack) btnBack.addEventListener('click', ()=> location.href = 'index.html');
  if(btnReplay) btnReplay.addEventListener('click', replayReport);
  if(btnDownload) btnDownload.addEventListener('click', downloadReport);
});
