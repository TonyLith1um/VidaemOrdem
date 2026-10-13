'use strict';
/* =====================  Utilidades  ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const fmtLong = s => parse(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = s => parse(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtFull = s => parse(s).toLocaleDateString('pt-BR');
const money = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* =====================  Dados  ===================== */
const KEY = 'vo_data', NTKEY = 'vo_nt';
const DEF = () => ({
  v: 2, updatedAt: 0,
  themeColor: '#8e4585',
  fontFamily: 'system-ui',
  notifSettings: { agenda: true, checklist: true, ciclo: true, habitos: true },
  checklist: [],
  cycle: { periods: [], cycleLen: 28, periodLen: 5 },
  pill: { on: false, active: 21, pause: 7, start: '', time: '21:00', taken: {} },
  routines: { habits: [], exercises: [], diet: [] },
  rlog: { habits: {}, exercises: {}, diet: {} },
  study: { goal: 120, focus: 25, rest: 5, log: {} },
  water: { goal: 8, log: {} },
  food: [], shop: [], agenda: [], journal: {}
});

function merge(def, obj) {
  if (!isObj(obj)) return def;
  const res = { ...def };
  for (const k in def) {
    if (k in obj && obj[k] != null) {
      if (Array.isArray(def[k])) {
        res[k] = Array.isArray(obj[k]) ? obj[k] : def[k];
      } else if (isObj(def[k])) {
        res[k] = isObj(obj[k]) ? { ...def[k], ...obj[k] } : def[k];
      } else {
        res[k] = obj[k];
      }
    }
  }
  return res;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? merge(DEF(), JSON.parse(raw)) : DEF();
  } catch {
    return DEF();
  }
}

let D = load();

function save() {
  D.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(D));
  scheduleCloudSync();
}

function mutate(fn, opt = {}) {
  fn(D);
  save();
  if (opt.render !== false) render();
}

function setPath(obj, path, val) {
  const p = path.split('.'); let o = obj;
  while (p.length > 1) o = o[p.shift()];
  o[p[0]] = val;
}

/* =====================  Tema e Fontes  ===================== */
const FONTS = {
  'system-ui': { name: 'Padrão do Sistema', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  'inter': { name: 'Inter / Roboto (Moderna)', stack: '"Inter", "Roboto", "Segoe UI", sans-serif' },
  'serif': { name: 'Georgia (Clássica / Serif)', stack: '"Georgia", "Merriweather", "Times New Roman", serif' },
  'rounded': { name: 'Nunito (Amigável)', stack: '"Nunito", "Quicksand", "Segoe UI", cursive, sans-serif' },
  'mono': { name: 'Fira Code (Código)', stack: '"Fira Code", "Consolas", "Courier New", monospace' },
  'trebuchet': { name: 'Trebuchet MS (Humanista)', stack: '"Trebuchet MS", "Lucida Sans", sans-serif' }
};

const PALETTE = [
  { name: 'Violeta Original', color: '#8e4585' },
  { name: 'Rosa Framboesa', color: '#d81b60' },
  { name: 'Roxo Lavanda', color: '#7b1fa2' },
  { name: 'Azul Celeste', color: '#0288d1' },
  { name: 'Verde Esmeralda', color: '#00897b' },
  { name: 'Verde Menta', color: '#2e7d32' },
  { name: 'Pêssego Âmbar', color: '#e65100' },
  { name: 'Caramelo', color: '#a04000' },
  { name: 'Grafite Suave', color: '#37474f' }
];

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function applyTheme(color, persist = true) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) color = '#8e4585';
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-soft', color + '28');
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
  if (persist) {
    D.themeColor = color;
    save();
  }
}

function applyFont(key, persist = true) {
  const font = FONTS[key] || FONTS['system-ui'];
  document.documentElement.style.setProperty('--font-family', font.stack);
  document.body.style.fontFamily = font.stack;
  if (persist) {
    D.fontFamily = key;
    save();
  }
}

function initAppearance() {
  applyTheme(D.themeColor || '#8e4585', false);
  applyFont(D.fontFamily || 'system-ui', false);
}

/* =====================  Estado de tela  ===================== */
let view = 'hoje', sel = today(), calM = new Date(), shopF = 'todos';
let checkF = 'todas'; // 'todas', 'pendentes', 'concluidas', 'hoje'
let checkSearch = '';
let editingChecklistId = null;

const NAV = [
  ['hoje', '🏠', 'Hoje'],
  ['checklist', '📝', 'Checklist'],
  ['ciclo', '🌸', 'Ciclo'],
  ['habitos', '✅', 'Hábitos'],
  ['estudos', '📚', 'Estudos'],
  ['treino', '💪', 'Treino'],
  ['comida', '🥗', 'Alimentação'],
  ['compras', '🛒', 'Compras'],
  ['agenda', '📅', 'Agenda'],
  ['diario', '📓', 'Diário'],
  ['backup', '☁️', 'Nuvem']
];

/* =====================  Rotinas (hábitos, treino, dieta)  ===================== */
const RT = {
  habits: { title: 'Hábitos do dia', ph: 'Ex.: Beber água ao acordar', reps: false, empty: 'Nenhum hábito para este dia. Adicione abaixo!' },
  exercises: { title: 'Exercícios do dia', ph: 'Ex.: Agachamento', reps: true, empty: 'Nenhum exercício para este dia. Adicione abaixo!' },
  diet: { title: 'Plano da dieta', ph: 'Ex.: Café da manhã: ovos + fruta', reps: false, empty: 'Nenhum item no plano para este dia.' }
};
const dueOn = (r, date) => r.days.includes(parse(date).getDay());
function rtProg(k, date) {
  const items = (D.routines[k] || []).filter(r => dueOn(r, date)), done = (D.rlog[k] && D.rlog[k][date]) || [];
  return { n: items.filter(r => done.includes(r.id)).length, total: items.length };
}
function streak(k, r) {
  let n = 0, d = today();
  const done = x => (D.rlog[k] && D.rlog[k][x] || []).includes(r.id);
  if (dueOn(r, d) && !done(d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (!dueOn(r, d)) { d = addDays(d, -1); continue; }
    if (done(d)) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}
const progress = (n, total) => total ? `<div class="bar"><i style="width:${Math.round(n / total * 100)}%"></i></div><small>${n} de ${total} concluídos</small>` : '';
function daysPicker(sel7 = [0, 1, 2, 3, 4, 5, 6]) {
  return `<div class="row" style="margin-top:.4rem">
    <button type="button" class="ghost sm" data-act="preset" data-d="0,1,2,3,4,5,6">Todos os dias</button>
    <button type="button" class="ghost sm" data-act="preset" data-d="1,2,3,4,5">Dias úteis</button>
    <button type="button" class="ghost sm" data-act="preset" data-d="0,6">Fim de semana</button></div>
    <div class="days">${DOW.map((l, i) => `<label>${l}<input type="checkbox" name="d" value="${i}" ${sel7.includes(i) ? 'checked' : ''}></label>`).join('')}</div>`;
}
function routineHTML(k) {
  const meta = RT[k], items = (D.routines[k] || []).filter(r => dueOn(r, sel));
  const done = (D.rlog[k] && D.rlog[k][sel]) || [];
  const prog = rtProg(k, sel);
  return `<section class="card"><h2>${meta.title}</h2>
    ${progress(prog.n, prog.total)}
    <ul class="list" style="margin-top:.6rem">${items.map(r => {
      const isDone = done.includes(r.id), s = streak(k, r);
      return `<li class="${isDone ? 'done' : ''}"><label><input type="checkbox" ${isDone ? 'checked' : ''} data-chg="rtoggle" data-k="${k}" data-id="${r.id}">
        <span>${esc(r.name)}${r.reps ? ` <small>· ${esc(r.reps)}</small>` : ''}${s > 1 ? ` <span class="badge" title="dias seguidos">🔥 ${s}</span>` : ''}</span></label>
        <button class="dng" data-act="rdel" data-k="${k}" data-id="${r.id}" aria-label="Excluir">🗑</button></li>`;
    }).join('') || `<li class="empty">${meta.empty}</li>`}</ul></section>
  <section class="card"><h2>Adicionar ${k === 'diet' ? 'ao plano' : (k === 'exercises' ? 'exercício' : 'hábito')}</h2>
    <form data-submit="addRoutine" data-k="${k}"><input type="text" name="name" placeholder="${meta.ph}" required maxlength="120">
      ${meta.reps ? '<input type="text" name="reps" placeholder="Séries/repetições (ex.: 3x12)" style="margin-top:.5rem" maxlength="60">' : ''}
      <label class="f">Dias da semana:</label>${daysPicker()}
      <button class="pri" style="margin-top:.6rem">Adicionar</button></form></section>`;
}
function dateBar() {
  const isT = sel === today();
  return `<div class="datebar"><button class="ico" data-act="day" data-n="-1">‹</button>
    <input type="date" value="${sel}" data-chg="setdate" style="max-width:180px">
    <button class="ico" data-act="day" data-n="1">›</button>
    ${isT ? '' : '<button class="ghost" data-act="todaybtn">Hoje</button>'}</div>`;
}

/* =====================  Ciclo e Pílula  ===================== */
function cycleData() {
  const ps = [...(D.cycle.periods || [])].sort((a, b) => a.start.localeCompare(b.start));
  let sum = 0, cnt = 0;
  for (let i = 1; i < ps.length; i++) {
    const len = diff(ps[i].start, ps[i - 1].start);
    if (len >= 18 && len <= 60) { sum += len; cnt++; }
  }
  const avg = cnt ? Math.round(sum / cnt) : D.cycle.cycleLen;
  const plen = D.cycle.periodLen;
  const cycles = [];
  if (ps.length) {
    let cur = ps[ps.length - 1].start;
    for (let i = 0; i < 6; i++) {
      const next = i === 0 && ps[ps.length - 1].end && ps[ps.length - 1].end >= today() ? cur : addDays(cur, avg);
      cycles.push({ start: next, fs: addDays(next, -16), fe: addDays(next, -12), ov: addDays(next, -14) });
      cur = next;
    }
  }
  return { ps, avg, plen, cycles, irregular: cnt >= 3 && Math.abs(avg - D.cycle.cycleLen) > 5 };
}

function pillStatus(date) {
  const c = D.pill; if (!c || !c.on || !c.start) return null;
  const days = diff(date, c.start); if (days < 0) return null;
  const cycle = (c.active || 21) + (c.pause || 7); if (!cycle) return null;
  const pos = (days % cycle) + 1;
  const take = pos <= c.active;
  const nextStart = addDays(date, cycle - pos + 1);
  return { pos, take, nextStart };
}

function calHTML() {
  const y = calM.getFullYear(), m = calM.getMonth(), t = today();
  const first = new Date(y, m, 1), startDay = first.getDay(), total = new Date(y, m + 1, 0).getDate();
  const cd = cycleData(), ps = cd.ps;
  const days = [];
  for (let i = 0; i < startDay; i++) days.push('<div class="d"></div>');
  for (let d = 1; d <= total; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const isToday = ds === t;
    const inPeriod = ps.some(p => ds >= p.start && ds <= (p.end || p.start));
    const inFutureP = !inPeriod && cd.cycles.some(c => ds >= c.start && ds <= addDays(c.start, cd.plen - 1));
    const isOv = cd.cycles.some(c => ds === c.ov);
    const inFertile = !isOv && cd.cycles.some(c => ds >= c.fs && ds <= c.fe);
    const cls = ['d', isToday ? 't' : '', inPeriod ? 'p' : '', inFutureP ? 'pp' : '', isOv ? 'o' : '', inFertile ? 'f' : ''].filter(Boolean).join(' ');
    const psPill = pillStatus(ds);
    const pillDot = psPill && psPill.take && D.pill.taken[ds] ? '<i class="pill"></i>' : '';
    days.push(`<div class="${cls}"><span>${d}</span>${pillDot}</div>`);
  }
  return `<div class="calhead"><button class="ico sm" data-act="cal" data-n="-1">‹</button>
    <b>${calM.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b>
    <button class="ico sm" data-act="cal" data-n="1">›</button></div>
    <div class="cal">${DOW.map(w => `<div class="dow">${w}</div>`).join('')}${days.join('')}</div>
    <div class="legend"><span><i style="background:var(--rose)"></i> Menstruação</span>
    <span><i style="border:2px dashed var(--rose)"></i> Previsão</span>
    <span><i style="background:var(--fertile)"></i> Período fértil / ovulação</span></div>`;
}

/* =====================  Pomodoro  ===================== */
const P = { phase: 'focus', left: null, running: false, end: 0, cycles: 0, t: null };
const pTotal = () => (P.phase === 'focus' ? D.study.focus : (P.cycles > 0 && P.cycles % 4 === 0 ? 15 : D.study.rest)) * 60;
function updateClock() {
  const c = $('#pomoClock'); if (!c) return;
  c.textContent = `${pad(Math.floor(P.left / 60))}:${pad(P.left % 60)}`;
  $('#pomoPhase').textContent = (P.phase === 'focus' ? '🎯 Foco' : '☕ Pausa') + ` · ciclos hoje: ${P.cycles}`;
  $('#pStartBtn').textContent = P.running ? 'Pausar' : 'Iniciar';
}
function pTick() {
  P.left = Math.max(0, Math.ceil((P.end - Date.now()) / 1000));
  document.title = P.running ? `${pad(Math.floor(P.left / 60))}:${pad(P.left % 60)} · Vida em Ordem` : 'Vida em Ordem';
  updateClock();
  if (P.left <= 0) pFinish();
}
function pFinish() {
  if (P.phase === 'focus') {
    mutate(d => { d.study.log[today()] = (d.study.log[today()] || 0) + d.study.focus; }, { render: view === 'estudos' });
    P.cycles++; P.phase = 'rest'; notify('🍅 Foco concluído!', `+${D.study.focus} min na meta. Hora da pausa.`, 'pomo');
  } else { P.phase = 'focus'; notify('☕ Pausa terminou', 'Vamos para mais um foco?', 'pomo'); }
  beep(); P.left = pTotal(); P.end = Date.now() + P.left * 1000; updateClock();
}
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); o.stop(a.currentTime + .35);
  } catch { }
  navigator.vibrate && navigator.vibrate([200, 100, 200]);
}

/* =====================  Notificações  ===================== */
function notify(title, body, tag) {
  toast(title);
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(r => r.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: tag || 'vo_default'
    })).catch(() => { });
  }
}

function notifyOnce(key, title, body) {
  let n = {}; try { n = JSON.parse(localStorage.getItem(NTKEY)) || {}; } catch { }
  if (n[key]) return;
  const t = today(); for (const k in n) if (!k.includes(t)) delete n[k];
  n[key] = 1; localStorage.setItem(NTKEY, JSON.stringify(n));
  notify(title, body, key);
}

function reminderTick() {
  const t = today(), hm = nowHM();
  const notifs = D.notifSettings || { agenda: true, checklist: true, ciclo: true, habitos: true };

  // 1. CICLO (Pílula e Previsão)
  if (notifs.ciclo !== false) {
    const ps = pillStatus(t);
    if (ps && ps.take && !D.pill.taken[t] && hm >= D.pill.time) {
      notifyOnce('pill_' + t, '💊 Hora da Pílula', 'Lembrete do anticoncepcional marcado para ' + D.pill.time + '.');
    }
    const cd = cycleData();
    const nx = cd.cycles.find(x => x.start >= t);
    if (nx && nx.start === t && hm >= '08:00') {
      notifyOnce('cyc_start_' + t, '🌸 Ciclo Menstrual', 'Previsão de início da menstruação para hoje.');
    }
    if (nx && nx.fs === t && hm >= '08:00') {
      notifyOnce('cyc_fertile_' + t, '🌸 Período Fértil', 'Início da sua janela fértil previsto para hoje.');
    }
  }

  // 2. AGENDA (Compromissos)
  if (notifs.agenda !== false) {
    (D.agenda || []).filter(a => a.date === t && a.time).forEach(a => {
      const nowMins = +hm.slice(0, 2) * 60 + +hm.slice(3);
      const evMins = +a.time.slice(0, 2) * 60 + +a.time.slice(3);
      const diffM = nowMins - evMins;
      if (diffM >= 0 && diffM <= 45) {
        notifyOnce('ag_' + t + '_' + a.id, '📅 ' + a.title, 'Compromisso agendado para ' + a.time + (a.notes ? ' · ' + a.notes : ''));
      }
    });
  }

  // 3. CHECKLIST (Tarefas com horário e resumo matinal)
  if (notifs.checklist !== false) {
    const todayTasks = (D.checklist || []).filter(c => !c.done && c.date === t);
    todayTasks.forEach(c => {
      if (c.time) {
        const nowMins = +hm.slice(0, 2) * 60 + +hm.slice(3);
        const taskMins = +c.time.slice(0, 2) * 60 + +c.time.slice(3);
        const diffM = nowMins - taskMins;
        if (diffM >= 0 && diffM <= 45) {
          notifyOnce('chk_' + t + '_' + c.id, '📝 Checklist: ' + c.text, 'Horário marcado: ' + c.time);
        }
      }
    });
    if (todayTasks.length > 0 && hm >= '09:00') {
      notifyOnce('chk_daily_' + t, '📝 Checklist de Hoje', 'Você tem ' + todayTasks.length + ' tarefa(s) pendente(s) na sua checklist hoje.');
    }
  }

  // 4. HÁBITOS (Lembretes diários)
  if (notifs.habitos !== false) {
    const hp = rtProg('habits', t);
    const pend = hp.total - hp.n;
    if (pend > 0) {
      if (hm >= '08:30') {
        notifyOnce('hab_morning_' + t, '✅ Hábitos do Dia', 'Você tem ' + pend + ' hábito(s) programados para hoje. Bom dia!');
      }
      if (hm >= '20:30') {
        notifyOnce('hab_evening_' + t, '✅ Hábitos Pendentes', 'Ainda faltam ' + pend + ' hábito(s) para completar seu dia.');
      }
    }
  }
}

/* =====================  Firebase Cloud Sync & Auth  ===================== */
let currentUser = null;
let syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error'
let syncTimer = null;
let userMenuOpen = false;

function scheduleCloudSync() {
  if (!currentUser || !window.firebaseBridge) return;
  clearTimeout(syncTimer);
  syncStatus = 'syncing';
  updateAccountUI();
  syncTimer = setTimeout(async () => {
    try {
      await window.firebaseBridge.saveUserData(currentUser.uid, D);
      syncStatus = 'synced';
      updateAccountUI();
    } catch (e) {
      console.warn('Erro ao salvar no Firestore:', e);
      syncStatus = 'error';
      updateAccountUI();
    }
  }, 1200);
}

async function forceCloudSync() {
  if (!currentUser || !window.firebaseBridge) {
    return toast('Entre com uma conta Google para sincronizar.');
  }
  syncStatus = 'syncing';
  updateAccountUI();
  try {
    await window.firebaseBridge.saveUserData(currentUser.uid, D);
    syncStatus = 'synced';
    toast('Dados salvos na nuvem Google ✓');
    updateAccountUI();
  } catch (e) {
    syncStatus = 'error';
    updateAccountUI();
    toast('Erro ao sincronizar. Tente novamente.');
  }
}

function updateAccountUI() {
  const btn = $('#userBtn');
  const dropdown = $('#userDropdown');
  if (!btn) return;

  if (currentUser) {
    const photo = currentUser.photoURL;
    const name = currentUser.displayName || currentUser.email || 'Usuário';
    const initial = name.charAt(0).toUpperCase();

    btn.innerHTML = photo
      ? `<img src="${esc(photo)}" class="user-avatar-img" alt="${esc(name)}" referrerpolicy="no-referrer">`
      : `<span class="user-avatar-initial">${esc(initial)}</span>`;

    btn.title = `Conectado como ${name}`;

    if (dropdown) {
      const syncLabel = syncStatus === 'syncing' ? '⏳ Sincronizando com a nuvem…' : (syncStatus === 'error' ? '⚠️ Erro ao salvar' : '☁️ Nuvem Google atualizada ✓');
      dropdown.innerHTML = `
        <div class="user-dropdown-header">
          ${photo
            ? `<img src="${esc(photo)}" class="user-avatar-img" style="width:36px;height:36px" alt="${esc(name)}" referrerpolicy="no-referrer">`
            : `<span class="user-avatar-initial" style="width:36px;height:36px;font-size:1.1rem">${esc(initial)}</span>`}
          <div class="user-dropdown-info">
            <b>${esc(name)}</b>
            <small>${esc(currentUser.email || '')}</small>
          </div>
        </div>
        <div class="user-dropdown-sync">${syncLabel}</div>
        <div class="user-dropdown-actions">
          <button type="button" data-act="openSettings">⚙️ Configurações (Tema, Fontes, Avisos)</button>
          <button type="button" data-act="openapkguide">📱 Instalar App / Gerar APK</button>
          <button type="button" data-act="forcesync">🔄 Sincronizar agora</button>
          <button type="button" data-act="logout">🚪 Sair da conta</button>
        </div>`;
    }
  } else {
    btn.innerHTML = `<span class="user-btn-content">👤 Entrar</span>`;
    btn.title = 'Entrar com Google';
    if (dropdown) {
      dropdown.innerHTML = `
        <div class="user-dropdown-header">
          <span class="user-avatar-initial" style="width:36px;height:36px">👤</span>
          <div class="user-dropdown-info">
            <b>Nenhuma conta conectada</b>
            <small>Dados salvos localmente</small>
          </div>
        </div>
        <div class="user-dropdown-actions">
          <button type="button" class="pri" data-act="login" style="background:var(--accent);color:#fff">🔑 Entrar com Google</button>
          <button type="button" data-act="openapkguide">📱 Instalar App / Gerar APK</button>
          <button type="button" data-act="openSettings">⚙️ Configurações (Tema, Fontes, Avisos)</button>
        </div>`;
    }
  }
}

function initFirebaseAuth() {
  if (!window.firebaseBridge) return;
  window.firebaseBridge.onAuthChange(async (user) => {
    currentUser = user;
    updateAccountUI();

    if (user) {
      closeModal();
      try {
        const remote = await window.firebaseBridge.loadUserData(user.uid);
        if (remote && (remote.updatedAt || 0) > (D.updatedAt || 0)) {
          D = merge(DEF(), remote);
          localStorage.setItem(KEY, JSON.stringify(D));
          initAppearance();
          render();
          toast('Dados sincronizados com sua conta Google ✓');
        } else {
          await window.firebaseBridge.saveUserData(user.uid, D);
          toast(`Conectado como ${user.displayName || user.email} ✓`);
        }
        syncStatus = 'synced';
        updateAccountUI();
      } catch (err) {
        console.warn('Erro ao carregar dados do usuário:', err);
      }
    } else {
      const dismissed = localStorage.getItem('vo_welcome_dismissed');
      if (!dismissed) {
        showWelcomeModal();
      }
    }
  });
}

/* =====================  Modais (Login, Configurações e APK)  ===================== */
function renderGsiButton(containerId) {
  if (window.google && google.accounts && google.accounts.id && window.firebaseBridge?.clientId) {
    try {
      google.accounts.id.initialize({
        client_id: window.firebaseBridge.clientId,
        callback: async (resp) => {
          if (resp && resp.credential) {
            try {
              toast('Autenticando...');
              await window.firebaseBridge.loginWithIdToken(resp.credential);
              closeModal();
              toast('Conectado com sucesso pelo Google ✓');
            } catch (err) {
              toast('Erro ao validar token Google: ' + err.message);
            }
          }
        }
      });
      const el = document.getElementById(containerId);
      if (el) {
        google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 280,
          shape: 'pill'
        });
      }
    } catch (e) {
      console.warn('GSI renderButton error:', e);
    }
  }
}

function showOpenExternalLoginModal() {
  const container = $('#modalContainer');
  if (!container) return;
  const targetUrl = window.location.href;
  container.innerHTML = `
    <div class="modal-backdrop" data-act="backdropClose">
      <div class="modal" style="text-align:center">
        <div class="modal-head">
          <h2 style="font-size:1.15rem">🔑 Conectar Conta Google</h2>
          <button type="button" class="modal-close" data-act="closeModal" aria-label="Fechar">✕</button>
        </div>
        <p style="font-size:.92rem;color:var(--muted);margin:.6rem 0">O navegador bloqueou a janela pop-up de login dentro do quadro.</p>
        <p style="font-size:.88rem">Você pode fazer login abrindo o aplicativo diretamente em uma nova aba do navegador:</p>
        <div style="margin:1.2rem 0">
          <a href="${esc(targetUrl)}" target="_blank" rel="noopener noreferrer" class="pri"
            style="display:inline-block;text-decoration:none;padding:.7rem 1.4rem;border-radius:14px;color:#fff;background:var(--accent);font-weight:600">
            ↗ Abrir em Nova Aba para Conectar
          </a>
        </div>
        <button type="button" class="ghost sm" data-act="closeModal">Fechar</button>
      </div>
    </div>`;
}

function showWelcomeModal() {
  const container = $('#modalContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="modal-backdrop" data-act="backdropClose">
      <div class="modal welcome-card">
        <div class="welcome-icon">✨</div>
        <h2>Vida em Ordem</h2>
        <p>Sua rotina, checklist, ciclo, estudos e hábitos organizados em um só lugar. Entre com sua conta Google para salvar tudo na nuvem e receber seus avisos!</p>
        
        <div id="gsiWelcomeContainer" style="display:flex;justify-content:center;margin:.8rem 0"></div>

        <div style="margin:.8rem 0">
          <button type="button" class="google-login-btn" data-act="login">
            <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Entrar com Google
          </button>
        </div>
        <button type="button" class="ghost sm" data-act="dismissWelcome" style="margin-top:.4rem">Continuar sem login por enquanto</button>
      </div>
    </div>`;

  setTimeout(() => renderGsiButton('gsiWelcomeContainer'), 100);
}

function openSettingsModal() {
  userMenuOpen = false;
  const dropdown = $('#userDropdown');
  if (dropdown) dropdown.hidden = true;

  const container = $('#modalContainer');
  if (!container) return;

  const curColor = D.themeColor || '#8e4585';
  const rgb = hexToRgb(curColor);
  const curFont = D.fontFamily || 'system-ui';
  const notifs = D.notifSettings || { agenda: true, checklist: true, ciclo: true, habitos: true };
  const permGranted = ('Notification' in window) && Notification.permission === 'granted';

  container.innerHTML = `
    <div class="modal-backdrop" data-act="backdropClose">
      <div class="modal">
        <div class="modal-head">
          <h2>⚙️ Configurações</h2>
          <button type="button" class="modal-close" data-act="closeModal" aria-label="Fechar">✕</button>
        </div>

        <!-- 1. NOTIFICAÇÕES -->
        <section style="margin-bottom:1.4rem">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <h3 style="font-size:1rem;margin:0">🔔 Notificações e Avisos</h3>
            <span class="badge ${permGranted ? 'ok' : ''}">${permGranted ? 'Ativadas ✓' : 'Aguardando permissão'}</span>
          </div>
          <p class="note" style="margin:.3rem 0 .6rem">Receba alertas de compromissos, tarefas com horário, pílula e hábitos no seu aparelho.</p>

          <div class="row" style="margin-bottom:.6rem">
            ${permGranted ? '' : '<button type="button" class="pri sm" data-act="reqnotif">🔔 Permitir Notificações no Sistema</button>'}
            <button type="button" class="ghost sm" data-act="testnotif">🧪 Testar Notificação Agora</button>
          </div>

          <div class="notif-settings-box">
            <div class="notif-toggle-row">
              <label>
                <input type="checkbox" ${notifs.agenda !== false ? 'checked' : ''} data-chg="notiftoggle" data-k="agenda">
                <span>📅 <b>Agenda:</b> Lembretes de compromissos no horário</span>
              </label>
            </div>
            <div class="notif-toggle-row">
              <label>
                <input type="checkbox" ${notifs.checklist !== false ? 'checked' : ''} data-chg="notiftoggle" data-k="checklist">
                <span>📝 <b>Checklist:</b> Alerta de tarefas agendadas e resumo matinal</span>
              </label>
            </div>
            <div class="notif-toggle-row">
              <label>
                <input type="checkbox" ${notifs.ciclo !== false ? 'checked' : ''} data-chg="notiftoggle" data-k="ciclo">
                <span>🌸 <b>Ciclo:</b> Lembrete da pílula e previsão de menstruação/fértil</span>
              </label>
            </div>
            <div class="notif-toggle-row">
              <label>
                <input type="checkbox" ${notifs.habitos !== false ? 'checked' : ''} data-chg="notiftoggle" data-k="habitos">
                <span>✅ <b>Hábitos:</b> Lembretes matinal e noturno de rotinas pendentes</span>
              </label>
            </div>
          </div>
        </section>

        <!-- 2. INSTALAÇÃO / APK -->
        <section style="margin-bottom:1.4rem">
          <h3 style="font-size:1rem;margin-bottom:.4rem">📱 Aplicativo APK e Android</h3>
          <p class="note" style="margin-top:0">Transforme este app em um aplicativo no seu Android.</p>
          <div class="row">
            <button type="button" class="pri sm" data-act="installFromSettings">⬇ Instalar no Dispositivo</button>
            <button type="button" class="ghost sm" data-act="openapkguide">📖 Passo a passo do arquivo .APK</button>
          </div>
        </section>

        <!-- 3. COR DO TEMA -->
        <section style="margin-bottom:1.4rem">
          <h3 style="font-size:1rem;margin-bottom:.4rem">🎨 Cor do Tema (Roda RGB)</h3>
          <p class="note" style="margin-top:0;margin-bottom:.8rem">Escolha pela roda de cores, pelos sliders RGB ou selecione uma paleta pronta:</p>
          
          <div class="color-picker-box">
            <div class="color-picker-row">
              <input type="color" id="themeColorInput" class="color-circle-input" value="${curColor}" title="Clique para abrir a roda RGB">
              <div style="flex:1">
                <b id="themeHexDisplay" style="font-size:1.1rem;font-family:monospace">${curColor.toUpperCase()}</b>
                <small class="muted" style="display:block">Toque no círculo para abrir a roda de cores</small>
              </div>
            </div>

            <div class="rgb-sliders">
              <div class="rgb-slider-row">
                <span style="color:#e53935;font-weight:700">R</span>
                <input type="range" id="sliderR" min="0" max="255" value="${rgb.r}">
                <span id="valR">${rgb.r}</span>
              </div>
              <div class="rgb-slider-row">
                <span style="color:#43a047;font-weight:700">G</span>
                <input type="range" id="sliderG" min="0" max="255" value="${rgb.g}">
                <span id="valG">${rgb.g}</span>
              </div>
              <div class="rgb-slider-row">
                <span style="color:#1e88e5;font-weight:700">B</span>
                <input type="range" id="sliderB" min="0" max="255" value="${rgb.b}">
                <span id="valB">${rgb.b}</span>
              </div>
            </div>

            <div>
              <small class="muted" style="font-weight:600">Paletas recomendadas:</small>
              <div class="palette-swatches">
                ${PALETTE.map(p => `
                  <button type="button" class="swatch-btn ${p.color.toLowerCase() === curColor.toLowerCase() ? 'on' : ''}"
                    style="background:${p.color}" title="${p.name}" data-act="pickPalette" data-c="${p.color}"></button>
                `).join('')}
              </div>
            </div>
          </div>
        </section>

        <!-- 4. FONTE DO TEXTO -->
        <section style="margin-bottom:1.4rem">
          <h3 style="font-size:1rem;margin-bottom:.4rem">🔤 Fonte do Texto</h3>
          <p class="note" style="margin-top:0;margin-bottom:.6rem">Selecione o estilo de tipografia preferido:</p>
          <div class="font-list">
            ${Object.entries(FONTS).map(([k, f]) => `
              <div class="font-option ${curFont === k ? 'on' : ''}" data-act="pickFont" data-f="${k}" style="font-family:${f.stack}">
                <span>${f.name}</span>
                <span>${curFont === k ? '✓' : ''}</span>
              </div>
            `).join('')}
          </div>
          <div class="font-preview-quote" id="fontPreviewBox">
            "A organização traz leveza para a rotina e clareza para a mente."
          </div>
        </section>

        <div class="row" style="justify-content:flex-end">
          <button type="button" class="ghost sm" data-act="resetAppearance">Restaurar Padrões</button>
          <button type="button" class="pri sm" data-act="closeModal">Concluir</button>
        </div>
      </div>
    </div>`;

  setupSettingsListeners();
}

function showApkGuideModal() {
  const container = $('#modalContainer');
  if (!container) return;
  const appUrl = window.location.origin;

  container.innerHTML = `
    <div class="modal-backdrop" data-act="backdropClose">
      <div class="modal">
        <div class="modal-head">
          <h2>📱 Aplicativo APK e Android</h2>
          <button type="button" class="modal-close" data-act="closeModal" aria-label="Fechar">✕</button>
        </div>

        <div class="apk-card">
          <h4>📱 Opção 1: Instalação Direta no Celular (Recomendado)</h4>
          <p style="font-size:.88rem;color:var(--muted);margin-bottom:.5rem">O app já possui manifesto PWA completo e Service Worker ativo:</p>
          <ol class="apk-steps">
            <li>No navegador Chrome do Android, clique no botão <b>"⬇ Instalar"</b> no topo do app (ou no menu ⋮ do Chrome).</li>
            <li>Toque em <b>"Instalar aplicativo"</b> ou <b>"Adicionar à tela inicial"</b>.</li>
            <li>O aplicativo será instalado como app nativo com ícone independente, tela cheia e notificações!</li>
          </ol>
          ${deferred ? '<button type="button" class="pri sm" data-act="install">Instalar Agora no Android</button>' : ''}
        </div>

        <div class="apk-card" style="margin-top:.8rem">
          <h4>📦 Opção 2: Gerar arquivo .APK Standalone (PWABuilder / TWA)</h4>
          <p style="font-size:.88rem;color:var(--muted);margin-bottom:.5rem">Para compilar um arquivo <code>.apk</code> ou pacote para a Google Play Store:</p>
          <ol class="apk-steps">
            <li>Acesse a ferramenta gratuita oficial da Microsoft/Google: <br>
              <a href="https://www.pwabuilder.com/" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:600">pwabuilder.com</a>
            </li>
            <li>Cole o endereço deste aplicativo: <br>
              <code style="display:inline-block;margin:.3rem 0;user-select:all">${esc(appUrl)}</code>
            </li>
            <li>Clique em <b>"Start"</b> e depois em <b>"Package for Android"</b>.</li>
            <li>Baixe o seu arquivo <b>.apk assinado</b> pronto para instalar em qualquer smartphone Android!</li>
          </ol>
        </div>

        <div class="row" style="justify-content:flex-end;margin-top:1rem">
          <button type="button" class="pri sm" data-act="closeModal">Entendi</button>
        </div>
      </div>
    </div>`;
}

function setupSettingsListeners() {
  const colorInput = $('#themeColorInput');
  const sliderR = $('#sliderR');
  const sliderG = $('#sliderG');
  const sliderB = $('#sliderB');
  const valR = $('#valR');
  const valG = $('#valG');
  const valB = $('#valB');
  const hexDisplay = $('#themeHexDisplay');

  function updateFromRgb(r, g, b) {
    const hex = rgbToHex(r, g, b);
    if (colorInput) colorInput.value = hex;
    if (valR) valR.textContent = r;
    if (valG) valG.textContent = g;
    if (valB) valB.textContent = b;
    if (hexDisplay) hexDisplay.textContent = hex.toUpperCase();
    applyTheme(hex, true);
  }

  if (colorInput) {
    colorInput.addEventListener('input', e => {
      const hex = e.target.value;
      const rgb = hexToRgb(hex);
      if (sliderR) sliderR.value = rgb.r;
      if (sliderG) sliderG.value = rgb.g;
      if (sliderB) sliderB.value = rgb.b;
      if (valR) valR.textContent = rgb.r;
      if (valG) valG.textContent = rgb.g;
      if (valB) valB.textContent = rgb.b;
      if (hexDisplay) hexDisplay.textContent = hex.toUpperCase();
      applyTheme(hex, true);
    });
  }

  [sliderR, sliderG, sliderB].forEach(slider => {
    if (slider) {
      slider.addEventListener('input', () => {
        const r = +sliderR.value;
        const g = +sliderG.value;
        const b = +sliderB.value;
        updateFromRgb(r, g, b);
      });
    }
  });
}

function closeModal() {
  const container = $('#modalContainer');
  if (container) container.innerHTML = '';
}

/* =====================  Vistas da Aplicação  ===================== */
const views = {};

// Vista HOJE
views.hoje = () => {
  const t = today();
  const h = rtProg('habits', t), e = rtProg('exercises', t), di = rtProg('diet', t);
  const min = (D.study.log && D.study.log[t]) || 0, wat = (D.water.log && D.water.log[t]) || 0;
  const ps = pillStatus(t), cl = (() => {
    const c = cycleData();
    const nx = c.cycles.find(x => x.start >= t) || c.cycles[0];
    if (!nx) return { val: '—', sub: 'Sem registro' };
    const d = diff(nx.start, t);
    return { val: `em ${d}d`, sub: `Mestruação: ${fmtShort(nx.start)}` };
  })();
  const ag = (D.agenda || []).filter(a => a.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const chList = D.checklist || [];
  const chToday = chList.filter(c => c.date === t || !c.done);
  const chDone = chList.filter(c => c.done).length;
  const chTotal = chList.length;

  const stat = (go, icon, title, val, sub, pct) => `<button type="button" class="stat" data-act="go" data-v="${go}"><span>${icon}</span><b>${title}</b><em>${val}</em><small>${sub || ''}</small>${pct != null ? `<div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}</button>`;
  const pct = (n, t2) => t2 ? Math.round(n / t2 * 100) : 0;
  const j = D.journal && D.journal[t];

  return `<p class="date">${fmtLong(t)}</p>
  ${ps && ps.take && !D.pill.taken[t] ? `<section class="card alert"><b>💊 Pílula de hoje (${esc(D.pill.time)})</b>
     <p style="margin:.3rem 0 .6rem">Dia ${ps.pos} da cartela.</p><button type="button" class="pri" data-act="pilltake">Já tomei</button></section>` : ''}
  ${ps && !ps.take ? `<section class="card"><b>💊 Pausa da cartela</b><br><small>Nova cartela em ${fmtShort(ps.nextStart)}.</small></section>` : ''}
  ${ag.length ? `<section class="card"><h2>📅 Compromissos de hoje</h2><ul class="list">${ag.map(a => `<li><span><b>${esc(a.time || 'Dia todo')}</b> ${esc(a.title)}</span></li>`).join('')}</ul></section>` : ''}
  
  <div class="grid">
    ${stat('checklist', '📝', 'Checklist', `${chDone}/${chTotal}`, 'concluídas', pct(chDone, chTotal))}
    ${stat('habitos', '✅', 'Hábitos', `${h.n}/${h.total}`, '', pct(h.n, h.total))}
    ${stat('treino', '💪', 'Treino', `${e.n}/${e.total}`, '', pct(e.n, e.total))}
    ${stat('estudos', '📚', 'Estudos', `${min} min`, `meta ${D.study.goal} min`, pct(min, D.study.goal))}
    ${stat('comida', '💧', 'Água', `${wat}/${D.water.goal}`, 'copos', pct(wat, D.water.goal))}
    ${stat('comida', '🥗', 'Dieta', `${di.n}/${di.total}`, '', pct(di.n, di.total))}
    ${stat('ciclo', '🌸', 'Ciclo', cl.val, cl.sub)}
    ${stat('diario', '📓', 'Diário', j && (j.text || j.reflect) ? 'Escrito ✓' : 'Escrever', j && j.mood ? ['', '😞', '😕', '😐', '🙂', '😄'][j.mood] : '')}
    ${stat('compras', '🛒', 'Compras', (D.shop || []).filter(i => !i.done).length, 'itens na lista')}
  </div>
  
  ${chToday.length ? `
    <section class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
        <h2>📝 Checklist rápida</h2>
        <button type="button" class="ghost sm" data-act="go" data-v="checklist">Ver tudo</button>
      </div>
      <ul class="list">${chToday.slice(0, 5).map(c => `
        <li class="${c.done ? 'done' : ''}">
          <label>
            <input type="checkbox" ${c.done ? 'checked' : ''} data-chg="checktoggle" data-id="${c.id}">
            <span>${esc(c.text)} ${c.time ? `<small class="muted">⏰ ${c.time}</small>` : ''}</span>
          </label>
        </li>
      `).join('')}</ul>
    </section>
  ` : ''}`;
};

// Vista: CHECKLIST com Pesquisa por Nome e Data
views.checklist = () => {
  const items = D.checklist || [];
  const t = today();
  
  const filterMap = {
    todas: () => true,
    pendentes: i => !i.done,
    concluidas: i => i.done,
    hoje: i => i.date === t
  };
  
  const filterFn = filterMap[checkF] || filterMap.todas;
  let filtered = items.filter(filterFn);

  // Aplica pesquisa rápida por nome ou data
  if (checkSearch.trim()) {
    const q = checkSearch.trim().toLowerCase();
    filtered = filtered.filter(item => {
      const textMatch = (item.text || '').toLowerCase().includes(q);
      const dateRaw = (item.date || '');
      const dateShort = fmtShort(item.date || t);
      const dateFull = fmtFull(item.date || t);
      const dateMatch = dateRaw.includes(q) || dateShort.includes(q) || dateFull.includes(q);
      const timeMatch = (item.time || '').includes(q);
      return textMatch || dateMatch || timeMatch;
    });
  }

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
  });

  const doneCount = items.filter(i => i.done).length;
  const totalCount = items.length;

  return `
    <section class="card">
      <h2>📝 Minha Checklist</h2>
      ${progress(doneCount, totalCount)}
      
      <!-- Barra de Pesquisa Rápida -->
      <div style="margin-top:.8rem">
        <div class="search-box">
          <span style="font-size:1.1rem;opacity:.7">🔍</span>
          <input type="text" id="checklistSearchInput" placeholder="Pesquisar por nome ou data (ex.: médico, 14/10, 2026-10)..."
            value="${esc(checkSearch)}" data-inp="checksearch" autocomplete="off">
          ${checkSearch ? `<button type="button" class="search-clear" data-act="clearchecksearch" title="Limpar pesquisa">✕</button>` : ''}
        </div>
        ${checkSearch ? `
          <div class="search-feedback">
            <small class="muted">Filtrando por "<b>${esc(checkSearch)}</b>" — <b>${filtered.length}</b> encontrado(s)</small>
          </div>
        ` : ''}
      </div>

      <!-- Abas de Filtros -->
      <div class="chips">
        ${[
          ['todas', 'Todas (' + totalCount + ')'],
          ['pendentes', 'Pendentes (' + (totalCount - doneCount) + ')'],
          ['concluidas', 'Concluídas (' + doneCount + ')'],
          ['hoje', 'Hoje (' + items.filter(i => i.date === t).length + ')']
        ].map(([k, label]) => `
          <button type="button" class="${checkF === k ? 'on' : ''}" data-act="checkfilter" data-v="${k}">${label}</button>
        `).join('')}
      </div>

      <ul class="list" style="margin-top:.8rem">
        ${filtered.map(item => {
          if (editingChecklistId === item.id) {
            return `
              <li class="checklist-item">
                <form data-submit="saveCheckEdit" data-id="${item.id}" class="edit-box">
                  <label class="f" style="margin-top:0">Alterar tarefa:</label>
                  <input type="text" name="text" value="${esc(item.text)}" required maxlength="180">
                  <div class="two" style="margin-top:.4rem">
                    <div><label class="f">Data</label><input type="date" name="date" value="${item.date || t}"></div>
                    <div><label class="f">Horário</label><input type="time" name="time" value="${item.time || ''}"></div>
                  </div>
                  <div class="row" style="margin-top:.6rem">
                    <button type="submit" class="pri sm">Salvar alterações</button>
                    <button type="button" class="ghost sm" data-act="canceledit">Cancelar</button>
                  </div>
                </form>
              </li>`;
          }

          return `
            <li class="checklist-item ${item.done ? 'done' : ''}">
              <div class="checklist-content">
                <input type="checkbox" ${item.done ? 'checked' : ''} data-chg="checktoggle" data-id="${item.id}" title="Marcar como concluído">
                <div class="checklist-text-wrap">
                  <span class="checklist-title">${esc(item.text)}</span>
                  <div class="checklist-meta">
                    ${item.date ? `<span class="tag date-tag">📅 ${fmtShort(item.date)}</span>` : ''}
                    ${item.time ? `<span class="tag time-tag">⏰ ${item.time}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="checklist-actions">
                <button type="button" class="ico sm" data-act="checkedit" data-id="${item.id}" title="Alterar">✏️</button>
                <button type="button" class="dng" data-act="checkdel" data-id="${item.id}" title="Excluir">🗑</button>
              </div>
            </li>`;
        }).join('') || `<li class="empty">${checkSearch ? 'Nenhum resultado encontrado para "' + esc(checkSearch) + '".' : 'Nenhuma tarefa nesta visualização.'}</li>`}
      </ul>

      ${items.some(i => i.done) ? `
        <div style="margin-top:.8rem">
          <button type="button" class="ghost sm" data-act="checkclear">Limpar concluídas</button>
        </div>
      ` : ''}
    </section>

    <section class="card">
      <h2>+ Adicionar Tarefa</h2>
      <form data-submit="addChecklist">
        <input type="text" name="text" placeholder="Ex.: Pagar fatura do cartão, Comprar presente…" required maxlength="180">
        <div class="two" style="margin-top:.5rem">
          <div><label class="f">Data</label><input type="date" name="date" value="${t}"></div>
          <div><label class="f">Horário (opcional)</label><input type="time" name="time" value=""></div>
        </div>
        <button type="submit" class="pri" style="margin-top:.7rem">Adicionar à Checklist</button>
      </form>
    </section>`;
};

views.habitos = () => dateBar() + routineHTML('habits');
views.treino = () => dateBar() + routineHTML('exercises');

views.estudos = () => {
  const min = (D.study.log && D.study.log[sel]) || 0, g = D.study.goal;
  const days = [...Array(7)].map((_, i) => addDays(sel, i - 6)), vals = days.map(d => (D.study.log && D.study.log[d]) || 0);
  const mx = Math.max(g, ...vals, 1);
  if (P.left == null) P.left = pTotal();
  return dateBar() + `
  <section class="card"><h2>Meta diária de estudo</h2>
    <div class="status">${min} min <small>de ${g} min</small>${min >= g ? ' <span class="ok">🎉 meta batida!</span>' : ''}</div>
    <div class="bar"><i style="width:${Math.min(100, Math.round(min / g * 100))}%"></i></div>
    <div class="week">${days.map((d, i) => `<div class="${vals[i] >= g ? 'hit' : ''}"><i style="height:${Math.round(vals[i] / mx * 80)}px"></i>${DOW[parse(d).getDay()]}</div>`).join('')}</div>
    <form class="row" data-submit="addMin" style="margin-top:.8rem"><input type="number" name="min" min="1" max="1440" placeholder="Minutos estudados (manual)" required>
      <button type="submit" class="ghost">Somar</button></form>
  </section>
  <section class="card"><h2>🍅 Método Pomodoro</h2>
    <div class="phase" id="pomoPhase"></div><div class="clock" id="pomoClock"></div>
    <div class="row" style="justify-content:center;margin-top:.6rem">
      <button type="button" class="pri" data-act="pstart" id="pStartBtn"></button>
      <button type="button" class="ghost" data-act="pskip">Pular fase</button>
      <button type="button" class="ghost" data-act="preset2">Zerar</button></div>
    <p class="note" style="text-align:center">Cada foco completo soma automaticamente à meta de hoje.</p>
    <div class="two" style="margin-top:.6rem"><div><label class="f">Foco (min)</label><input type="number" min="1" max="120" value="${D.study.focus}" data-chg="set" data-path="study.focus" data-type="num"></div>
    <div><label class="f">Pausa (min)</label><input type="number" min="1" max="60" value="${D.study.rest}" data-chg="set" data-path="study.rest" data-type="num"></div></div>
    <label class="f">Meta diária (min)</label><input type="number" min="5" max="1440" value="${g}" data-chg="set" data-path="study.goal" data-type="num">
  </section>`;
};

views.comida = () => {
  const w = (D.water.log && D.water.log[sel]) || 0, goal = D.water.goal;
  const entries = (D.food || []).filter(f => f.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  return dateBar() + routineHTML('diet') + `
  <section class="card"><h2>💧 Água</h2>
    <div class="water">${'💧'.repeat(Math.min(w, 30)) || '<small>Nenhum copo ainda</small>'}</div>
    <div class="row"><button type="button" class="ico" data-act="water" data-n="-1">−</button><b>${w} / ${goal} copos</b><button type="button" class="pri" data-act="water" data-n="1">+ 1 copo</button></div>
    <label class="f">Meta de copos por dia</label><input type="number" min="1" max="30" value="${goal}" data-chg="set" data-path="water.goal" data-type="num">
  </section>
  <section class="card"><h2>🍽 Diário de comida</h2>
    <form data-submit="addFood">
      <div class="two"><select name="type">${['Café da manhã', 'Lanche', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Outro'].map(o => `<option>${o}</option>`).join('')}</select>
      <input type="time" name="time" value="${nowHM()}"></div>
      <input type="text" name="text" placeholder="O que você comeu?" required style="margin-top:.5rem" maxlength="300">
      <button type="submit" class="pri" style="margin-top:.5rem">Registrar</button></form>
    <ul class="list" style="margin-top:.6rem">${entries.map(f => `<li><span><b>${esc(f.time)}</b> · ${esc(f.type)}<br>${esc(f.text)}</span>
      <button type="button" class="dng" data-act="fdel" data-id="${f.id}" aria-label="Excluir">🗑</button></li>`).join('') || '<li class="empty">Nada registrado neste dia.</li>'}</ul>
  </section>`;
};

views.compras = () => {
  const f = { todos: () => true, necessidade: i => i.kind === 'necessidade', desejo: i => i.kind === 'desejo', comprados: i => i.done };
  const items = (D.shop || []).filter(f[shopF] || f.todos).sort((a, b) => a.done - b.done);
  const total = items.filter(i => !i.done).reduce((s, i) => s + (i.price || 0), 0);
  return `<section class="card"><h2>Lista de compras</h2>
    <div class="chips">${[['todos', 'Todos'], ['necessidade', 'Necessidades'], ['desejo', 'Desejos'], ['comprados', 'Comprados']].map(([k, l]) => `<button type="button" class="${shopF === k ? 'on' : ''}" data-act="shopf" data-v="${k}">${l}</button>`).join('')}</div>
    <ul class="list">${items.map(i => `<li class="${i.done ? 'done' : ''}"><label><input type="checkbox" ${i.done ? 'checked' : ''} data-chg="stoggle" data-id="${i.id}">
      <span>${esc(i.name)} <span class="tag ${i.kind === 'necessidade' ? 'need' : ''}">${i.kind}</span>${i.price ? ` <small>· ${money(i.price)}</small>` : ''}</span></label>
      <button type="button" class="dng" data-act="sdel" data-id="${i.id}" aria-label="Excluir">🗑</button></li>`).join('') || '<li class="empty">Lista vazia.</li>'}</ul>
    ${total ? `<p class="status" style="margin-top:.6rem">Estimado a comprar: ${money(total)}</p>` : ''}
    ${(D.shop || []).some(i => i.done) ? '<button type="button" class="ghost sm" data-act="sclear">Limpar comprados</button>' : ''}
  </section>
  <section class="card"><h2>Adicionar item</h2>
    <form data-submit="addShop"><input type="text" name="name" placeholder="O que você quer comprar?" required maxlength="120">
      <div class="two" style="margin-top:.5rem"><select name="kind"><option value="necessidade">Necessidade</option><option value="desejo">Desejo</option></select>
      <input type="number" name="price" min="0" step="0.01" placeholder="Preço (opcional)"></div>
      <button type="submit" class="pri" style="margin-top:.5rem">Adicionar</button></form></section>`;
};

views.agenda = () => {
  const t = today(), by = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
  const up = (D.agenda || []).filter(a => a.date >= t).sort(by), past = (D.agenda || []).filter(a => a.date < t).sort((a, b) => by(b, a));
  const row = a => `<li><span><b>${a.date === t ? 'Hoje' : fmtShort(a.date)}</b>${a.time ? ' · ' + esc(a.time) : ''} — ${esc(a.title)}${a.notes ? `<br><small>${esc(a.notes)}</small>` : ''}</span>
    <span><button type="button" class="ico sm" data-act="ics" data-id="${a.id}" title="Adicionar ao calendário do aparelho">📆</button><button type="button" class="dng" data-act="adel" data-id="${a.id}" aria-label="Excluir">🗑</button></span></li>`;
  return `<section class="card"><h2>Novo compromisso</h2>
    <form data-submit="addAgenda"><input type="text" name="title" placeholder="Ex.: Consulta, prova, reunião" required maxlength="120">
      <div class="two" style="margin-top:.5rem"><input type="date" name="date" value="${sel < t ? t : sel}" required><input type="time" name="time"></div>
      <input type="text" name="notes" placeholder="Observações (opcional)" style="margin-top:.5rem" maxlength="300">
      <button type="submit" class="pri" style="margin-top:.5rem">Salvar</button></form></section>
  <section class="card"><h2>Próximos</h2><ul class="list">${up.map(row).join('') || '<li class="empty">Nada agendado.</li>'}</ul></section>
  ${past.length ? `<details class="card"><summary>Passados (${past.length})</summary><ul class="list">${past.slice(0, 30).map(row).join('')}</ul></details>` : ''}`;
};

views.diario = () => {
  const j = (D.journal && D.journal[sel]) || {};
  const recent = Object.keys(D.journal || {}).filter(d => d !== sel && (D.journal[d].text || D.journal[d].reflect)).sort().reverse().slice(0, 12);
  return dateBar() + `<section class="card"><h2>Como foi o dia?</h2>
    <div class="moods">${['😞', '😕', '😐', '🙂', '😄'].map((m, i) => `<button type="button" class="${j.mood === i + 1 ? 'on' : ''}" data-act="mood" data-v="${i + 1}">${m}</button>`).join('')}</div>
    <label class="f">Diário</label><textarea data-inp="text" placeholder="Escreva sobre o seu dia…">${esc(j.text || '')}</textarea>
    <label class="f">Reflexão / gratidão</label><textarea data-inp="reflect" placeholder="O que aprendi? Pelo que sou grata?">${esc(j.reflect || '')}</textarea>
    <p class="note">Salvo automaticamente.</p></section>
  ${recent.length ? `<section class="card"><h2>Entradas recentes</h2><ul class="list">${recent.map(d => `<li><button type="button" class="ghost sm" data-act="gotodate" data-v="${d}" style="text-align:left;flex:1">
    <b>${fmtShort(d)}</b> ${['', '😞', '😕', '😐', '🙂', '😄'][D.journal[d].mood || 0]} <small>${esc((D.journal[d].text || D.journal[d].reflect || '').slice(0, 60))}…</small></button></li>`).join('')}</ul></section>` : ''}`;
};

views.ciclo = () => {
  const cd = cycleData(), t = today(), ps = pillStatus(t), c = D.pill;
  const nx = cd.cycles.find(x => x.start >= t) || cd.cycles[0];
  const hist = [...cd.ps].reverse().map(p => `<li><span>${fmtFull(p.start)} → ${p.end ? fmtFull(p.end) : '<small>em andamento</small>'}</span><span>
    ${p.end ? '' : `<button type="button" class="ico sm" data-act="pend" data-id="${p.start}">Terminou hoje</button>`}
    <button type="button" class="dng" data-act="pdel" data-id="${p.start}" aria-label="Excluir">🗑</button></span></li>`).join('') || '<li class="empty">Nenhum registro ainda.</li>';
  const last7 = [...Array(7)].map((_, i) => addDays(t, i - 6));
  return `<section class="card">${calHTML()}
    ${nx ? `<p class="status" style="margin-top:.8rem">Próxima menstruação: ${fmtShort(nx.start)} <small>(em ${diff(nx.start, t)} dias)</small><br>
    Período fértil: ${fmtShort(nx.fs)} a ${fmtShort(nx.fe)} · Ovulação: ${fmtShort(nx.ov)}</p>
    <p class="note">Ciclo médio considerado: ${cd.avg} dias.${cd.irregular ? ' ⚠️ Seus ciclos variam bastante; a previsão é menos confiável.' : ''}</p>` : '<p class="note">Registre o início da última menstruação para ver as previsões.</p>'}
    <p class="note">As datas são estimativas calculadas e <b>não servem como método contraceptivo</b>.</p></section>
  <section class="card"><h2>Registrar menstruação</h2>
    <form data-submit="addPeriod" class="row"><div><label class="f">Primeiro dia</label><input type="date" name="start" value="${t}" required></div>
    <div><label class="f">Último dia (se já terminou)</label><input type="date" name="end"></div><button type="submit" class="pri">Salvar</button></form>
    <ul class="list" style="margin-top:.6rem">${hist}</ul>
    <details style="margin-top:.6rem"><summary>Ajustes de previsão</summary>
      <div class="two"><div><label class="f">Ciclo padrão (dias)</label><input type="number" min="21" max="45" value="${D.cycle.cycleLen}" data-chg="set" data-path="cycle.cycleLen" data-type="num"></div>
      <div><label class="f">Duração (dias)</label><input type="number" min="1" max="10" value="${D.cycle.periodLen}" data-chg="set" data-path="cycle.periodLen" data-type="num"></div></div>
      <p class="note">Com 2 ou mais registros, o app usa a média dos seus ciclos.</p></details></section>
  <section class="card"><h2>💊 Anticoncepcional</h2>
    <label style="display:flex;gap:.6rem;align-items:center"><input type="checkbox" ${c.on ? 'checked' : ''} data-chg="set" data-path="pill.on" data-type="bool"> Ativar controle e lembrete</label>
    ${c.on ? `
    <div class="row" style="margin:.6rem 0"><button type="button" class="ghost sm" data-act="pillpreset" data-a="21" data-p="7">21 + 7 pausa</button>
      <button type="button" class="ghost sm" data-act="pillpreset" data-a="24" data-p="4">24 + 4 pausa</button>
      <button type="button" class="ghost sm" data-act="pillpreset" data-a="28" data-p="0">Contínuo (sem pausa)</button></div>
    <div class="two"><div><label class="f">Dias com pílula</label><input type="number" min="1" max="90" value="${c.active}" data-chg="set" data-path="pill.active" data-type="num"></div>
    <div><label class="f">Dias de pausa (0 = sem)</label><input type="number" min="0" max="14" value="${c.pause}" data-chg="set" data-path="pill.pause" data-type="num"></div>
    <div><label class="f">1º dia da cartela</label><input type="date" value="${c.start}" data-chg="set" data-path="pill.start"></div>
    <div><label class="f">Horário</label><input type="time" value="${c.time}" data-chg="set" data-path="pill.time"></div></div>
    <button type="button" class="ghost sm" style="margin-top:.5rem" data-act="newpack">Começar nova cartela hoje</button>
    ${ps ? `<p class="status" style="margin-top:.8rem">${ps.take ? `Hoje: tomar a pílula (dia ${ps.pos}).` : `Hoje: dia de pausa. Nova cartela em ${fmtShort(ps.nextStart)}.`}</p>
      ${ps.take ? `<label style="display:flex;gap:.6rem;align-items:center"><input type="checkbox" ${c.taken[t] ? 'checked' : ''} data-chg="pilltaken"> Já tomei hoje</label>` : ''}` : '<p class="note">Informe o 1º dia da cartela para começar.</p>'}
    <div class="row" style="margin-top:.6rem">${last7.map(d => `<span title="${fmtShort(d)}" style="text-align:center;font-size:.7rem;color:var(--muted)">${DOW[parse(d).getDay()]}<br>${c.taken[d] ? '✅' : (pillStatus(d) && pillStatus(d).take && d < t ? '⚠️' : '·')}</span>`).join('')}</div>
    <button type="button" class="ghost sm" style="margin-top:.6rem" data-act="reqnotif">🔔 Ativar avisos neste aparelho</button>
    <p class="note">Os avisos só aparecem com o app aberto ou em segundo plano.</p>` : ''}
  </section>`;
};

views.backup = () => {
  const isLogged = !!currentUser;
  const userEmail = currentUser ? (currentUser.email || currentUser.displayName) : '';
  const lastSyncText = D.updatedAt ? new Date(D.updatedAt).toLocaleString('pt-BR') : 'Nunca';

  return `
    <section class="card">
      <h2>☁️ Backup e Sincronização em Nuvem</h2>
      <div style="margin-bottom:.8rem">
        ${isLogged ? `
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem">
            <span style="font-size:1.6rem">✅</span>
            <div>
              <b>Conectado com Google:</b><br>
              <small>${esc(userEmail)}</small>
            </div>
          </div>
          <p class="note" style="margin-top:0">Seus dados e checklists são sincronizados automaticamente na nuvem Firebase para sua conta Google a cada alteração.</p>
          <p class="status ok">Última atualização: ${lastSyncText}</p>
          <div class="row" style="margin-top:.8rem">
            <button type="button" class="pri sm" data-act="forcesync">Sincronizar agora</button>
            <button type="button" class="ghost sm" data-act="openSettings">Configurações</button>
            <button type="button" class="dng sm" data-act="logout">Desconectar</button>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem">
            <span style="font-size:1.6rem">☁️</span>
            <div>
              <b>Nenhuma conta conectada</b><br>
              <small>Os dados estão salvos apenas neste navegador.</small>
            </div>
          </div>
          <p class="note" style="margin-top:0">Ao entrar com o Google, seus dados e checklists vão diretamente para a sua conta, permitindo acessar de outros aparelhos sem nenhuma configuração manual.</p>
          <div class="row" style="margin-top:.8rem">
            <button type="button" class="pri sm" data-act="login">🔑 Entrar com Google</button>
            <button type="button" class="ghost sm" data-act="openSettings">Configurações</button>
          </div>
        `}
      </div>
    </section>

    <section class="card">
      <h2>📱 Aplicativo APK e Notificações</h2>
      <p class="note" style="margin-top:0">Instale no celular ou compile um arquivo .apk standalone, com notificações automáticas.</p>
      <div class="row">
        <button type="button" class="ghost sm" data-act="openapkguide">📱 Ver Guia do APK</button>
        <button type="button" class="ghost sm" data-act="testnotif">🔔 Testar Notificações</button>
      </div>
    </section>

    <section class="card">
      <h2>🎨 Aparência</h2>
      <p class="note" style="margin-top:0">Personalize a cor da aplicação com a roda RGB e troque a fonte do texto.</p>
      <button type="button" class="ghost sm" data-act="openSettings">Abrir Configurações de Tema e Fonte</button>
    </section>

    <section class="card">
      <h2>💾 Cópia de Segurança Manual</h2>
      <p class="note" style="margin-top:0">Você também pode exportar ou restaurar um arquivo .json dos seus dados a qualquer momento.</p>
      <div class="row">
        <button type="button" class="ghost sm" data-act="export">Baixar backup (.json)</button>
        <label class="ghost sm" style="border:1px solid var(--accent);border-radius:12px;padding:.35rem .75rem;cursor:pointer;color:var(--accent)">
          Importar backup (.json)
          <input type="file" accept=".json,application/json" data-chg="import" hidden>
        </label>
      </div>
    </section>`;
};

/* =====================  Render e navegação  ===================== */
function renderNav() {
  $('#nav').innerHTML = NAV.map(([k, ic, l]) => `<button type="button" class="${view === k ? 'on' : ''}" data-act="go" data-v="${k}"><span>${ic}</span>${l}</button>`).join('');
}

function render() {
  $('#main').innerHTML = views[view] ? views[view]() : views.hoje();
  renderNav();
  updateAccountUI();
  if (view === 'estudos') updateClock();
}

function go(v) {
  view = v;
  render();
  window.scrollTo(0, 0);
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* =====================  Ações (cliques)  ===================== */
const A = {
  go: el => go(el.dataset.v),
  day: el => { sel = addDays(sel, +el.dataset.n); render(); },
  todaybtn: () => { sel = today(); render(); },
  gotodate: el => { sel = el.dataset.v; render(); window.scrollTo(0, 0); },
  preset: el => { const ds = el.dataset.d.split(',').map(Number); $$('input[name=d]', el.closest('form')).forEach(c => c.checked = ds.includes(+c.value)); },
  rdel: el => {
    mutate(d => { d.routines[el.dataset.k] = d.routines[el.dataset.k].filter(r => r.id !== el.dataset.id); });
    toast('Item removido ✓');
  },
  water: el => mutate(d => { d.water.log[sel] = Math.max(0, (d.water.log[sel] || 0) + +el.dataset.n); }),
  fdel: el => mutate(d => { d.food = d.food.filter(f => f.id !== el.dataset.id); }),
  shopf: el => { shopF = el.dataset.v; render(); },
  sdel: el => mutate(d => { d.shop = d.shop.filter(i => i.id !== el.dataset.id); }),
  sclear: () => mutate(d => { d.shop = d.shop.filter(i => !i.done); }),
  adel: el => {
    mutate(d => { d.agenda = d.agenda.filter(a => a.id !== el.dataset.id); });
    toast('Compromisso excluído ✓');
  },
  ics: el => {
    const a = (D.agenda || []).find(x => x.id === el.dataset.id); if (!a) return;
    const dt = a.date.replace(/-/g, ''), tm = (a.time || '').replace(':', '');
    const start = a.time ? `DTSTART:${dt}T${tm}00` : `DTSTART;VALUE=DATE:${dt}`;
    const endD = a.time ? `DTEND:${dt}T${pad(Math.min(23, +a.time.slice(0, 2) + 1))}${a.time.slice(3)}00` : `DTEND;VALUE=DATE:${addDays(a.date, 1).replace(/-/g, '')}`;
    download('compromisso.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vida em Ordem//PT', 'BEGIN:VEVENT', 'UID:' + a.id + '@vidaemordem', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', start, endD, 'SUMMARY:' + a.title.replace(/[,;\n]/g, ' '), a.notes ? 'DESCRIPTION:' + a.notes.replace(/[,;\n]/g, ' ') : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n'), 'text/calendar');
  },
  mood: el => mutate(d => { const j = d.journal[sel] || (d.journal[sel] = {}); j.mood = j.mood === +el.dataset.v ? 0 : +el.dataset.v; }),
  cal: el => { calM = new Date(calM.getFullYear(), calM.getMonth() + +el.dataset.n, 1); render(); },
  pend: el => mutate(d => { const p = d.cycle.periods.find(x => x.start === el.dataset.id); if (p) p.end = today() < p.start ? p.start : today(); }),
  pdel: el => {
    mutate(d => { d.cycle.periods = d.cycle.periods.filter(p => p.start !== el.dataset.id); });
    toast('Registro excluído ✓');
  },
  pillpreset: el => mutate(d => { d.pill.active = +el.dataset.a; d.pill.pause = +el.dataset.p; }),
  newpack: () => mutate(d => { d.pill.start = today(); }),
  pilltake: () => mutate(d => { d.pill.taken[today()] = true; }),
  
  // Notificações
  reqnotif: async () => {
    if (!('Notification' in window)) return toast('Este navegador não suporta notificações.');
    const r = await Notification.requestPermission();
    if (r === 'granted') {
      notify('🔔 Notificações Ativadas!', 'Você receberá avisos sobre agenda, checklist, ciclo e hábitos.', 'init');
      toast('Notificações ativadas com sucesso ✓');
    } else {
      toast('Permissão de notificação negada.');
    }
    openSettingsModal();
  },
  testnotif: async () => {
    if (!('Notification' in window)) return toast('Este navegador não suporta notificações.');
    if (Notification.permission !== 'granted') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') return toast('Permissão de notificação negada.');
    }
    notify('🔔 Notificação de Teste', 'Suas notificações de agenda, checklist, ciclo e hábitos estão ativas!', 'test_' + Date.now());
    toast('Notificação de teste disparada ✓');
  },

  pstart: () => {
    if (P.left == null) P.left = pTotal();
    if (P.running) { P.running = false; clearInterval(P.t); pTick(); document.title = 'Vida em Ordem'; }
    else { P.running = true; P.end = Date.now() + P.left * 1000; P.t = setInterval(pTick, 250); }
    updateClock();
  },
  pskip: () => { P.phase = P.phase === 'focus' ? 'rest' : 'focus'; P.left = pTotal(); if (P.running) P.end = Date.now() + P.left * 1000; updateClock(); },
  preset2: () => { P.running = false; clearInterval(P.t); P.phase = 'focus'; P.left = pTotal(); document.title = 'Vida em Ordem'; updateClock(); },
  export: () => download(`vida-em-ordem-${today()}.json`, JSON.stringify(D, null, 1), 'application/json'),
  
  // Instalação do App / APK
  install: async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      $('#install').hidden = true;
    } else {
      showApkGuideModal();
    }
  },
  installFromSettings: async () => {
    if (deferred) {
      closeModal();
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      $('#install').hidden = true;
    } else {
      showApkGuideModal();
    }
  },
  openapkguide: () => {
    userMenuOpen = false;
    const dropdown = $('#userDropdown');
    if (dropdown) dropdown.hidden = true;
    showApkGuideModal();
  },

  // Ações da Checklist
  checkfilter: el => { checkF = el.dataset.v; render(); },
  clearchecksearch: () => {
    checkSearch = '';
    render();
    const inp = $('#checklistSearchInput');
    if (inp) inp.focus();
  },
  checkedit: el => { editingChecklistId = el.dataset.id; render(); },
  canceledit: () => { editingChecklistId = null; render(); },
  checkdel: el => {
    mutate(d => { d.checklist = (d.checklist || []).filter(c => c.id !== el.dataset.id); });
    toast('Item excluído da checklist ✓');
  },
  checkclear: () => {
    const doneCount = (D.checklist || []).filter(c => c.done).length;
    if (!doneCount) return toast('Nenhuma tarefa concluída para limpar.');
    mutate(d => { d.checklist = (d.checklist || []).filter(c => !c.done); });
    toast('Tarefas concluídas removidas ✓');
  },

  // Ações de Usuário e Configurações
  toggleUserMenu: () => {
    userMenuOpen = !userMenuOpen;
    const dropdown = $('#userDropdown');
    if (dropdown) dropdown.hidden = !userMenuOpen;
  },
  login: async () => {
    if (!window.firebaseBridge) return toast('Firebase não disponível.');
    try {
      toast('Abrindo autenticação do Google...');
      await window.firebaseBridge.loginWithGoogle();
      closeModal();
      userMenuOpen = false;
      const dropdown = $('#userDropdown');
      if (dropdown) dropdown.hidden = true;
    } catch (e) {
      console.error('Falha no login:', e);
      if (e.code === 'auth/popup-blocked') {
        showOpenExternalLoginModal();
      } else if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
        toast('Janela de login fechada.');
      } else if (e.code === 'auth/unauthorized-domain') {
        toast('Domínio precisa ser autorizado no Firebase Console.');
      } else {
        toast(`Erro de login: ${e.code || e.message || 'tente abrir em nova aba'}`);
        showOpenExternalLoginModal();
      }
    }
  },
  logout: async () => {
    try {
      if (window.firebaseBridge) {
        await window.firebaseBridge.logout();
      }
      currentUser = null;
      userMenuOpen = false;
      const dropdown = $('#userDropdown');
      if (dropdown) dropdown.hidden = true;
      updateAccountUI();
      render();
      toast('Desconectado com sucesso ✓');
    } catch (e) {
      toast('Erro ao sair: ' + (e.message || 'desconhecido'));
    }
  },
  openSettings: () => { openSettingsModal(); },
  closeModal: () => { closeModal(); },
  backdropClose: (el, e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  },
  dismissWelcome: () => {
    localStorage.setItem('vo_welcome_dismissed', '1');
    closeModal();
  },
  forcesync: () => { forceCloudSync(); },
  pickPalette: el => {
    const c = el.dataset.c;
    applyTheme(c, true);
    openSettingsModal();
    toast('Cor alterada ✓');
  },
  pickFont: el => {
    const f = el.dataset.f;
    applyFont(f, true);
    openSettingsModal();
    toast('Fonte alterada ✓');
  },
  resetAppearance: () => {
    applyTheme('#8e4585', true);
    applyFont('system-ui', true);
    openSettingsModal();
    toast('Aparência padrão restaurada ✓');
  }
};

/* =====================  Mudanças (Inputs/Selects)  ===================== */
const C = {
  setdate: el => { if (el.value) { sel = el.value; render(); } },
  rtoggle: el => mutate(d => {
    const log = d.rlog[el.dataset.k] || (d.rlog[el.dataset.k] = {}), a = log[sel] || (log[sel] = []);
    const i = a.indexOf(el.dataset.id); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.id);
  }),
  stoggle: el => mutate(d => { const i = (d.shop || []).find(x => x.id === el.dataset.id); if (i) i.done = el.checked; }),
  checktoggle: el => mutate(d => {
    const i = (d.checklist || []).find(x => x.id === el.dataset.id);
    if (i) i.done = el.checked;
  }),
  pilltaken: el => mutate(d => { d.pill.taken[today()] = el.checked; }),
  notiftoggle: el => mutate(d => {
    if (!d.notifSettings) d.notifSettings = { agenda: true, checklist: true, ciclo: true, habitos: true };
    d.notifSettings[el.dataset.k] = el.checked;
    toast('Preferencia de aviso atualizada ✓');
  }, { render: false }),
  set: el => {
    const t = el.dataset.type; let v = el.value;
    if (t === 'num') { v = Number(v); if (!isFinite(v) || (el.min !== '' && v < +el.min)) return render(); }
    if (t === 'bool') v = el.checked;
    mutate(d => setPath(d, el.dataset.path, v));
    if (el.dataset.path && el.dataset.path.startsWith('study.')) { if (!P.running) P.left = null; }
  },
  import: el => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!isObj(d)) throw 0;
        D = merge(DEF(), d);
        save();
        initAppearance();
        render();
        toast('Backup importado com sucesso ✓');
      } catch {
        toast('Arquivo inválido.');
      }
    };
    r.readAsText(f);
  }
};

/* =====================  Submissões de Formulários  ===================== */
const S = {
  addChecklist: fd => {
    const text = (fd.get('text') || '').trim();
    if (!text) return;
    const date = fd.get('date') || today();
    const time = (fd.get('time') || '').trim();
    mutate(d => {
      if (!d.checklist) d.checklist = [];
      d.checklist.push({
        id: uid(),
        text,
        date,
        time,
        done: false,
        createdAt: Date.now()
      });
    });
    toast('Item adicionado à checklist ✓');
  },
  saveCheckEdit: (fd, f) => {
    const id = f.dataset.id;
    const text = (fd.get('text') || '').trim();
    if (!text) return;
    const date = fd.get('date') || today();
    const time = (fd.get('time') || '').trim();
    mutate(d => {
      const item = (d.checklist || []).find(c => c.id === id);
      if (item) {
        item.text = text;
        item.date = date;
        item.time = time;
      }
    });
    editingChecklistId = null;
    render();
    toast('Tarefa alterada ✓');
  },
  addRoutine: (fd, f) => {
    const days = fd.getAll('d').map(Number), name = (fd.get('name') || '').trim(); if (!name) return;
    mutate(d => d.routines[f.dataset.k].push({ id: uid(), name, reps: (fd.get('reps') || '').trim(), days: days.length ? days : [0, 1, 2, 3, 4, 5, 6] }));
  },
  addMin: fd => mutate(d => { d.study.log[sel] = (d.study.log[sel] || 0) + Math.round(+fd.get('min')); }),
  addFood: fd => mutate(d => d.food.push({ id: uid(), date: sel, time: fd.get('time') || nowHM(), type: fd.get('type'), text: (fd.get('text') || '').trim() })),
  addShop: fd => mutate(d => d.shop.push({ id: uid(), name: (fd.get('name') || '').trim(), kind: fd.get('kind'), price: +fd.get('price') || 0, done: false })),
  addAgenda: fd => mutate(d => d.agenda.push({ id: uid(), title: (fd.get('title') || '').trim(), date: fd.get('date'), time: fd.get('time') || '', notes: (fd.get('notes') || '').trim() })),
  addPeriod: fd => {
    const start = fd.get('start'), end = fd.get('end') || '';
    if (end && end < start) return toast('O último dia não pode ser antes do primeiro.');
    mutate(d => { d.cycle.periods = d.cycle.periods.filter(p => p.start !== start); d.cycle.periods.push(end ? { start, end } : { start }); });
    calM = parse(start);
  }
};

/* =====================  Event Listeners Globais  ===================== */
let jT;
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) {
    A[el.dataset.act](el, e);
    return;
  }
  // Fecha dropdown do usuário ao clicar fora
  if (userMenuOpen && !e.target.closest('.user-menu-wrap')) {
    userMenuOpen = false;
    const dropdown = $('#userDropdown');
    if (dropdown) dropdown.hidden = true;
  }
});

document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el && C[el.dataset.chg]) C[el.dataset.chg](el, e);
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  if (S[f.dataset.submit]) S[f.dataset.submit](new FormData(f), f);
});

document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]');
  if (!el) return;

  // Pesquisa na checklist em tempo real com preservação de foco
  if (el.dataset.inp === 'checksearch') {
    checkSearch = el.value;
    render();
    const inp = $('#checklistSearchInput');
    if (inp) {
      inp.focus();
      inp.selectionStart = inp.selectionEnd = inp.value.length;
    }
    return;
  }

  clearTimeout(jT);
  const day = sel, field = el.dataset.inp, val = el.value;
  jT = setTimeout(() => mutate(d => { (d.journal[day] || (d.journal[day] = {}))[field] = val; }, { render: false }), 500);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    reminderTick();
  }
});

let deferred = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
  $('#install').hidden = false;
});
addEventListener('appinstalled', () => {
  $('#install').hidden = true;
  toast('App instalado ✓');
});

/* =====================  Inicialização  ===================== */
initAppearance();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
render();
setInterval(reminderTick, 30000);
reminderTick();
initFirebaseAuth();
