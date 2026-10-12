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
const DOWN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* =====================  Dados  ===================== */
const KEY = 'vo_data', CFGKEY = 'vo_cfg', NTKEY = 'vo_nt';
const DEF = () => ({
  v: 1, updatedAt: 0,
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
  for (const k in def) {
    if (isObj(def[k])) {
      def[k] = Object.keys(def[k]).length ? merge(def[k], obj[k]) : (isObj(obj[k]) ? obj[k] : def[k]);
    } else if (k in obj && obj[k] != null) def[k] = obj[k];
  }
  return def;
}
function load() { try { return merge(DEF(), JSON.parse(localStorage.getItem(KEY))); } catch { return DEF(); } }
let D = load();

let cfg = Object.assign({ clientId: '', connected: false, auto: true, fileId: '', lastAt: 0, dirty: false },
  (() => { try { return JSON.parse(localStorage.getItem(CFGKEY)) || {}; } catch { return {}; } })());
if (!cfg.clientId) cfg.clientId = window.VO_CLIENT_ID || '';
const saveCfg = () => localStorage.setItem(CFGKEY, JSON.stringify(cfg));

function save() {
  D.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(D));
  markDirty();
}
function mutate(fn, opt = {}) { fn(D); save(); if (opt.render !== false) render(); }
function setPath(obj, path, val) {
  const p = path.split('.'); let o = obj;
  while (p.length > 1) o = o[p.shift()];
  o[p[0]] = val;
}

/* =====================  Estado de tela  ===================== */
let view = 'hoje', sel = today(), calM = new Date(), shopF = 'todos';
const NAV = [
  ['hoje', '🏠', 'Hoje'], ['ciclo', '🌸', 'Ciclo'], ['habitos', '✅', 'Hábitos'], ['estudos', '📚', 'Estudos'],
  ['treino', '💪', 'Treino'], ['comida', '🥗', 'Alimentação'], ['compras', '🛒', 'Compras'],
  ['agenda', '📅', 'Agenda'], ['diario', '📓', 'Diário'], ['backup', '☁️', 'Backup']
];

/* =====================  Rotinas (hábitos, treino, dieta)  ===================== */
const RT = {
  habits: { title: 'Hábitos do dia', ph: 'Ex.: Beber água ao acordar', reps: false, empty: 'Nenhum hábito para este dia. Adicione abaixo!' },
  exercises: { title: 'Exercícios do dia', ph: 'Ex.: Agachamento', reps: true, empty: 'Nenhum exercício para este dia. Adicione abaixo!' },
  diet: { title: 'Plano da dieta', ph: 'Ex.: Café da manhã: ovos + fruta', reps: false, empty: 'Nenhum item no plano para este dia.' }
};
const dueOn = (r, date) => r.days.includes(parse(date).getDay());
function rtProg(k, date) {
  const items = D.routines[k].filter(r => dueOn(r, date)), done = D.rlog[k][date] || [];
  return { n: items.filter(r => done.includes(r.id)).length, total: items.length };
}
function streak(k, r) {
  let n = 0, d = today();
  const done = x => (D.rlog[k][x] || []).includes(r.id);
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
  const t = RT[k], items = D.routines[k].filter(r => dueOn(r, sel)), done = D.rlog[k][sel] || [];
  const p = rtProg(k, sel);
  const list = items.map(r => `<li class="${done.includes(r.id) ? 'done' : ''}">
      <label><input type="checkbox" ${done.includes(r.id) ? 'checked' : ''} data-chg="rtoggle" data-k="${k}" data-id="${r.id}">
      <span>${esc(r.name)}${r.reps ? ` <small>· ${esc(r.reps)}</small>` : ''}</span></label>
      ${k === 'habits' && streak(k, r) > 1 ? `<span class="badge">🔥 ${streak(k, r)}</span>` : ''}</li>`).join('')
    || `<li class="empty">${t.empty}</li>`;
  const all = D.routines[k].map(r => `<li><span>${esc(r.name)}${r.reps ? ` <small>· ${esc(r.reps)}</small>` : ''}<br>
      <small>${r.days.length === 7 ? 'Todos os dias' : r.days.map(d => DOWN[d]).join(', ')}</small></span>
      <button class="dng" data-act="rdel" data-k="${k}" data-id="${r.id}" aria-label="Excluir">🗑</button></li>`).join('')
    || '<li class="empty">Nada cadastrado ainda.</li>';
  return `<section class="card"><h2>${t.title}</h2>${progress(p.n, p.total)}<ul class="list">${list}</ul></section>
  <details class="card" ${D.routines[k].length ? '' : 'open'}><summary>Adicionar / gerenciar</summary>
    <form data-submit="addRoutine" data-k="${k}">
      <label class="f">Nome</label><input type="text" name="name" placeholder="${t.ph}" required maxlength="120">
      ${t.reps ? '<label class="f">Repetições / séries</label><input type="text" name="reps" placeholder="Ex.: 3 x 12" maxlength="40">' : ''}
      <label class="f">Em quais dias?</label>${daysPicker()}
      <button class="pri" style="margin-top:.5rem">Adicionar</button>
    </form>
    <h2 style="margin-top:1rem">Cadastrados</h2><ul class="list">${all}</ul>
  </details>`;
}
const dateBar = () => `<div class="datebar"><button data-act="day" data-n="-1" aria-label="Dia anterior">‹</button>
  <input type="date" value="${sel}" data-chg="setdate"><button data-act="day" data-n="1" aria-label="Próximo dia">›</button>
  ${sel !== today() ? '<button class="ghost" data-act="todaybtn">Hoje</button>' : ''}</div>`;

/* =====================  Ciclo e pílula  ===================== */
function cycleData() {
  const ps = [...D.cycle.periods].sort((a, b) => a.start.localeCompare(b.start));
  let avg = D.cycle.cycleLen, gaps = [];
  for (let i = 1; i < ps.length; i++) gaps.push(diff(ps[i].start, ps[i - 1].start));
  gaps = gaps.filter(g => g >= 15 && g <= 60).slice(-6);
  if (gaps.length) avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const irregular = gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > 7;
  const last = ps.length ? ps[ps.length - 1] : null;
  const cycles = [];
  if (last) for (let i = 1; i <= 4; i++) {
    const s = addDays(last.start, avg * i);
    cycles.push({ start: s, end: addDays(s, D.cycle.periodLen - 1), ov: addDays(s, -14), fs: addDays(s, -19), fe: addDays(s, -13) });
  }
  return { ps, avg, irregular, last, cycles };
}
const periodEnd = p => p.end || addDays(p.start, D.cycle.periodLen - 1);
function dayClass(s, cd) {
  for (const p of cd.ps) if (s >= p.start && s <= periodEnd(p)) return 'p';
  for (const c of cd.cycles) {
    if (s >= c.start && s <= c.end) return 'pp';
    if (s === c.ov) return 'o';
    if (s >= c.fs && s <= c.fe) return 'f';
  }
  return '';
}
function cycleLine() {
  const cd = cycleData(), t = today();
  if (!cd.last) return { val: '—', sub: 'Registre a 1ª menstruação' };
  const cls = dayClass(t, cd);
  const day = diff(t, cd.last.start) + 1;
  if (cls === 'p') return { val: `Dia ${day}`, sub: 'Menstruação' };
  const nx = cd.cycles.find(c => c.start >= t) || cd.cycles[0];
  const dn = diff(nx.start, t);
  if (cls === 'o') return { val: 'Ovulação', sub: 'prevista para hoje' };
  if (cls === 'f') return { val: 'Janela fértil', sub: `menstruação em ${dn} dias` };
  if (dn >= 0) return { val: dn === 0 ? 'Hoje' : `${dn} dia${dn > 1 ? 's' : ''}`, sub: 'p/ prox. menstruação' };
  return { val: 'Atrasada?', sub: `previsão era ${fmtShort(nx.start)}` };
}
function pillStatus(date) {
  const p = D.pill;
  if (!p.on || !p.start) return null;
  const d = diff(date, p.start);
  if (d < 0) return null;
  const len = p.active + p.pause, pos = len ? d % len : 0;
  return { pos: pos + 1, take: p.pause === 0 || pos < p.active, len, nextStart: addDays(date, len - pos) };
}
function calHTML() {
  const y = calM.getFullYear(), m = calM.getMonth(), cd = cycleData(), t = today();
  const off = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
  let cells = DOW.map(l => `<div class="dow">${l}</div>`).join('') + '<div></div>'.repeat(off);
  for (let d = 1; d <= n; d++) {
    const s = iso(new Date(y, m, d)), c = dayClass(s, cd);
    cells += `<div class="d ${c} ${s === t ? 't' : ''}">${d}${D.pill.taken[s] ? '<span class="pill"></span>' : ''}</div>`;
  }
  return `<div class="calhead"><button class="ico" data-act="cal" data-n="-1" aria-label="Mês anterior">‹</button>
    <b>${calM.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b>
    <button class="ico" data-act="cal" data-n="1" aria-label="Próximo mês">›</button></div><div class="cal">${cells}</div>
    <div class="legend"><span><i style="background:var(--rose)"></i>Menstruação</span>
    <span><i style="border:2px dashed var(--rose)"></i>Prevista</span>
    <span><i style="background:var(--fertile)"></i>Período fértil</span>
    <span><i style="background:var(--fertile);box-shadow:inset 0 0 0 2px #1e7a55"></i>Ovulação</span>
    <span><i style="background:var(--accent);border-radius:50%"></i>Pílula tomada</span></div>`;
}

/* =====================  Views  ===================== */
const views = {};

views.hoje = () => {
  const t = today(), ps = pillStatus(t), cl = cycleLine();
  const h = rtProg('habits', t), e = rtProg('exercises', t), di = rtProg('diet', t);
  const min = D.study.log[t] || 0, wat = D.water.log[t] || 0;
  const ag = D.agenda.filter(a => a.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const stat = (go, icon, title, val, sub, pct) => `<button class="stat" data-act="go" data-v="${go}"><span>${icon}</span><b>${title}</b><em>${val}</em><small>${sub || ''}</small>${pct != null ? `<div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}</button>`;
  const pct = (n, t2) => t2 ? Math.round(n / t2 * 100) : 0;
  const j = D.journal[t];
  return `<p class="date">${fmtLong(t)}</p>
  ${ps && ps.take && !D.pill.taken[t] ? `<section class="card alert"><b>💊 Pílula de hoje (${esc(D.pill.time)})</b>
     <p style="margin:.3rem 0 .6rem">Dia ${ps.pos} da cartela.</p><button class="pri" data-act="pilltake">Já tomei</button></section>` : ''}
  ${ps && !ps.take ? `<section class="card"><b>💊 Pausa da cartela</b><br><small>Nova cartela em ${fmtShort(ps.nextStart)}.</small></section>` : ''}
  ${ag.length ? `<section class="card"><h2>📅 Compromissos de hoje</h2><ul class="list">${ag.map(a => `<li><span><b>${esc(a.time || 'Dia todo')}</b> ${esc(a.title)}</span></li>`).join('')}</ul></section>` : ''}
  <div class="grid">
    ${stat('habitos', '✅', 'Hábitos', `${h.n}/${h.total}`, '', pct(h.n, h.total))}
    ${stat('treino', '💪', 'Treino', `${e.n}/${e.total}`, '', pct(e.n, e.total))}
    ${stat('estudos', '📚', 'Estudos', `${min} min`, `meta ${D.study.goal} min`, pct(min, D.study.goal))}
    ${stat('comida', '💧', 'Água', `${wat}/${D.water.goal}`, 'copos', pct(wat, D.water.goal))}
    ${stat('comida', '🥗', 'Dieta', `${di.n}/${di.total}`, '', pct(di.n, di.total))}
    ${stat('ciclo', '🌸', 'Ciclo', cl.val, cl.sub)}
    ${stat('diario', '📓', 'Diário', j && (j.text || j.reflect) ? 'Escrito ✓' : 'Escrever', j && j.mood ? ['', '😞', '😕', '😐', '🙂', '😄'][j.mood] : '')}
    ${stat('compras', '🛒', 'Compras', D.shop.filter(i => !i.done).length, 'itens na lista')}
  </div>`;
};

views.habitos = () => dateBar() + routineHTML('habits');
views.treino = () => dateBar() + routineHTML('exercises');

views.estudos = () => {
  const min = D.study.log[sel] || 0, g = D.study.goal;
  const days = [...Array(7)].map((_, i) => addDays(sel, i - 6)), vals = days.map(d => D.study.log[d] || 0);
  const mx = Math.max(g, ...vals, 1);
  if (P.left == null) P.left = pTotal();
  return dateBar() + `
  <section class="card"><h2>Meta diária de estudo</h2>
    <div class="status">${min} min <small>de ${g} min</small>${min >= g ? ' <span class="ok">🎉 meta batida!</span>' : ''}</div>
    <div class="bar"><i style="width:${Math.min(100, Math.round(min / g * 100))}%"></i></div>
    <div class="week">${days.map((d, i) => `<div class="${vals[i] >= g ? 'hit' : ''}"><i style="height:${Math.round(vals[i] / mx * 80)}px"></i>${DOW[parse(d).getDay()]}</div>`).join('')}</div>
    <form class="row" data-submit="addMin" style="margin-top:.8rem"><input type="number" name="min" min="1" max="1440" placeholder="Minutos estudados (manual)" required>
      <button class="ghost">Somar</button></form>
  </section>
  <section class="card"><h2>🍅 Método Pomodoro</h2>
    <div class="phase" id="pomoPhase"></div><div class="clock" id="pomoClock"></div>
    <div class="row" style="justify-content:center;margin-top:.6rem">
      <button class="pri" data-act="pstart" id="pStartBtn"></button>
      <button class="ghost" data-act="pskip">Pular fase</button>
      <button class="ghost" data-act="preset2">Zerar</button></div>
    <p class="note" style="text-align:center">Cada foco completo soma automaticamente à meta de hoje.</p>
    <div class="two" style="margin-top:.6rem"><div><label class="f">Foco (min)</label><input type="number" min="1" max="120" value="${D.study.focus}" data-chg="set" data-path="study.focus" data-type="num"></div>
    <div><label class="f">Pausa (min)</label><input type="number" min="1" max="60" value="${D.study.rest}" data-chg="set" data-path="study.rest" data-type="num"></div></div>
    <label class="f">Meta diária (min)</label><input type="number" min="5" max="1440" value="${g}" data-chg="set" data-path="study.goal" data-type="num">
  </section>`;
};

views.comida = () => {
  const w = D.water.log[sel] || 0, goal = D.water.goal;
  const entries = D.food.filter(f => f.date === sel).sort((a, b) => a.time.localeCompare(b.time));
  return dateBar() + routineHTML('diet') + `
  <section class="card"><h2>💧 Água</h2>
    <div class="water">${'💧'.repeat(Math.min(w, 30)) || '<small>Nenhum copo ainda</small>'}</div>
    <div class="row"><button class="ico" data-act="water" data-n="-1">−</button><b>${w} / ${goal} copos</b><button class="pri" data-act="water" data-n="1">+ 1 copo</button></div>
    <label class="f">Meta de copos por dia</label><input type="number" min="1" max="30" value="${goal}" data-chg="set" data-path="water.goal" data-type="num">
  </section>
  <section class="card"><h2>🍽 Diário de comida</h2>
    <form data-submit="addFood">
      <div class="two"><select name="type">${['Café da manhã', 'Lanche', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Outro'].map(o => `<option>${o}</option>`).join('')}</select>
      <input type="time" name="time" value="${nowHM()}"></div>
      <input type="text" name="text" placeholder="O que você comeu?" required style="margin-top:.5rem" maxlength="300">
      <button class="pri" style="margin-top:.5rem">Registrar</button></form>
    <ul class="list" style="margin-top:.6rem">${entries.map(f => `<li><span><b>${esc(f.time)}</b> · ${esc(f.type)}<br>${esc(f.text)}</span>
      <button class="dng" data-act="fdel" data-id="${f.id}" aria-label="Excluir">🗑</button></li>`).join('') || '<li class="empty">Nada registrado neste dia.</li>'}</ul>
  </section>`;
};

views.compras = () => {
  const f = { todos: () => true, necessidade: i => i.kind === 'necessidade', desejo: i => i.kind === 'desejo', comprados: i => i.done };
  const items = D.shop.filter(f[shopF]).sort((a, b) => a.done - b.done);
  const total = items.filter(i => !i.done).reduce((s, i) => s + (i.price || 0), 0);
  return `<section class="card"><h2>Lista de compras</h2>
    <div class="chips">${[['todos', 'Todos'], ['necessidade', 'Necessidades'], ['desejo', 'Desejos'], ['comprados', 'Comprados']].map(([k, l]) => `<button class="${shopF === k ? 'on' : ''}" data-act="shopf" data-v="${k}">${l}</button>`).join('')}</div>
    <ul class="list">${items.map(i => `<li class="${i.done ? 'done' : ''}"><label><input type="checkbox" ${i.done ? 'checked' : ''} data-chg="stoggle" data-id="${i.id}">
      <span>${esc(i.name)} <span class="tag ${i.kind === 'necessidade' ? 'need' : ''}">${i.kind}</span>${i.price ? ` <small>· ${money(i.price)}</small>` : ''}</span></label>
      <button class="dng" data-act="sdel" data-id="${i.id}" aria-label="Excluir">🗑</button></li>`).join('') || '<li class="empty">Lista vazia.</li>'}</ul>
    ${total ? `<p class="status" style="margin-top:.6rem">Estimado a comprar: ${money(total)}</p>` : ''}
    ${D.shop.some(i => i.done) ? '<button class="ghost sm" data-act="sclear">Limpar comprados</button>' : ''}
  </section>
  <section class="card"><h2>Adicionar item</h2>
    <form data-submit="addShop"><input type="text" name="name" placeholder="O que você quer comprar?" required maxlength="120">
      <div class="two" style="margin-top:.5rem"><select name="kind"><option value="necessidade">Necessidade</option><option value="desejo">Desejo</option></select>
      <input type="number" name="price" min="0" step="0.01" placeholder="Preço (opcional)"></div>
      <button class="pri" style="margin-top:.5rem">Adicionar</button></form></section>`;
};

views.agenda = () => {
  const t = today(), by = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
  const up = D.agenda.filter(a => a.date >= t).sort(by), past = D.agenda.filter(a => a.date < t).sort((a, b) => by(b, a));
  const row = a => `<li><span><b>${a.date === t ? 'Hoje' : fmtShort(a.date)}</b>${a.time ? ' · ' + esc(a.time) : ''} — ${esc(a.title)}${a.notes ? `<br><small>${esc(a.notes)}</small>` : ''}</span>
    <span><button class="ico sm" data-act="ics" data-id="${a.id}" title="Adicionar ao calendário do aparelho">📆</button><button class="dng" data-act="adel" data-id="${a.id}" aria-label="Excluir">🗑</button></span></li>`;
  return `<section class="card"><h2>Novo compromisso</h2>
    <form data-submit="addAgenda"><input type="text" name="title" placeholder="Ex.: Consulta, prova, reunião" required maxlength="120">
      <div class="two" style="margin-top:.5rem"><input type="date" name="date" value="${sel < t ? t : sel}" required><input type="time" name="time"></div>
      <input type="text" name="notes" placeholder="Observações (opcional)" style="margin-top:.5rem" maxlength="300">
      <button class="pri" style="margin-top:.5rem">Salvar</button></form></section>
  <section class="card"><h2>Próximos</h2><ul class="list">${up.map(row).join('') || '<li class="empty">Nada agendado.</li>'}</ul></section>
  ${past.length ? `<details class="card"><summary>Passados (${past.length})</summary><ul class="list">${past.slice(0, 30).map(row).join('')}</ul></details>` : ''}`;
};

views.diario = () => {
  const j = D.journal[sel] || {};
  const recent = Object.keys(D.journal).filter(d => d !== sel && (D.journal[d].text || D.journal[d].reflect)).sort().reverse().slice(0, 12);
  return dateBar() + `<section class="card"><h2>Como foi o dia?</h2>
    <div class="moods">${['😞', '😕', '😐', '🙂', '😄'].map((m, i) => `<button class="${j.mood === i + 1 ? 'on' : ''}" data-act="mood" data-v="${i + 1}">${m}</button>`).join('')}</div>
    <label class="f">Diário</label><textarea data-inp="text" placeholder="Escreva sobre o seu dia…">${esc(j.text || '')}</textarea>
    <label class="f">Reflexão / gratidão</label><textarea data-inp="reflect" placeholder="O que aprendi? Pelo que sou grata?">${esc(j.reflect || '')}</textarea>
    <p class="note">Salvo automaticamente.</p></section>
  ${recent.length ? `<section class="card"><h2>Entradas recentes</h2><ul class="list">${recent.map(d => `<li><button class="ghost sm" data-act="gotodate" data-v="${d}" style="text-align:left;flex:1">
    <b>${fmtShort(d)}</b> ${['', '😞', '😕', '😐', '🙂', '😄'][D.journal[d].mood || 0]} <small>${esc((D.journal[d].text || D.journal[d].reflect || '').slice(0, 60))}…</small></button></li>`).join('')}</ul></section>` : ''}`;
};

views.ciclo = () => {
  const cd = cycleData(), t = today(), ps = pillStatus(t), c = D.pill;
  const nx = cd.cycles.find(x => x.start >= t) || cd.cycles[0];
  const hist = [...cd.ps].reverse().map(p => `<li><span>${fmtFull(p.start)} → ${p.end ? fmtFull(p.end) : '<small>em andamento</small>'}</span><span>
    ${p.end ? '' : `<button class="ico sm" data-act="pend" data-id="${p.start}">Terminou hoje</button>`}
    <button class="dng" data-act="pdel" data-id="${p.start}" aria-label="Excluir">🗑</button></span></li>`).join('') || '<li class="empty">Nenhum registro ainda.</li>';
  const last7 = [...Array(7)].map((_, i) => addDays(t, i - 6));
  return `<section class="card">${calHTML()}
    ${nx ? `<p class="status" style="margin-top:.8rem">Próxima menstruação: ${fmtShort(nx.start)} <small>(em ${diff(nx.start, t)} dias)</small><br>
    Período fértil: ${fmtShort(nx.fs)} a ${fmtShort(nx.fe)} · Ovulação: ${fmtShort(nx.ov)}</p>
    <p class="note">Ciclo médio considerado: ${cd.avg} dias.${cd.irregular ? ' ⚠️ Seus ciclos variam bastante; a previsão é menos confiável.' : ''}</p>` : '<p class="note">Registre o início da última menstruação para ver as previsões.</p>'}
    <p class="note">As datas são estimativas calculadas e <b>não servem como método contraceptivo</b>.</p></section>
  <section class="card"><h2>Registrar menstruação</h2>
    <form data-submit="addPeriod" class="row"><div><label class="f">Primeiro dia</label><input type="date" name="start" value="${t}" required></div>
    <div><label class="f">Último dia (se já terminou)</label><input type="date" name="end"></div><button class="pri">Salvar</button></form>
    <ul class="list" style="margin-top:.6rem">${hist}</ul>
    <details style="margin-top:.6rem"><summary>Ajustes de previsão</summary>
      <div class="two"><div><label class="f">Ciclo padrão (dias)</label><input type="number" min="21" max="45" value="${D.cycle.cycleLen}" data-chg="set" data-path="cycle.cycleLen" data-type="num"></div>
      <div><label class="f">Duração (dias)</label><input type="number" min="1" max="10" value="${D.cycle.periodLen}" data-chg="set" data-path="cycle.periodLen" data-type="num"></div></div>
      <p class="note">Com 2 ou mais registros, o app usa a média dos seus ciclos.</p></details></section>
  <section class="card"><h2>💊 Anticoncepcional</h2>
    <label style="display:flex;gap:.6rem;align-items:center"><input type="checkbox" ${c.on ? 'checked' : ''} data-chg="set" data-path="pill.on" data-type="bool"> Ativar controle e lembrete</label>
    ${c.on ? `
    <div class="row" style="margin:.6rem 0"><button class="ghost sm" data-act="pillpreset" data-a="21" data-p="7">21 + 7 pausa</button>
      <button class="ghost sm" data-act="pillpreset" data-a="24" data-p="4">24 + 4 pausa</button>
      <button class="ghost sm" data-act="pillpreset" data-a="28" data-p="0">Contínuo (sem pausa)</button></div>
    <div class="two"><div><label class="f">Dias com pílula</label><input type="number" min="1" max="90" value="${c.active}" data-chg="set" data-path="pill.active" data-type="num"></div>
    <div><label class="f">Dias de pausa (0 = sem)</label><input type="number" min="0" max="14" value="${c.pause}" data-chg="set" data-path="pill.pause" data-type="num"></div>
    <div><label class="f">1º dia da cartela</label><input type="date" value="${c.start}" data-chg="set" data-path="pill.start"></div>
    <div><label class="f">Horário</label><input type="time" value="${c.time}" data-chg="set" data-path="pill.time"></div></div>
    <button class="ghost sm" style="margin-top:.5rem" data-act="newpack">Começar nova cartela hoje</button>
    ${ps ? `<p class="status" style="margin-top:.8rem">${ps.take ? `Hoje: tomar a pílula (dia ${ps.pos}).` : `Hoje: dia de pausa. Nova cartela em ${fmtShort(ps.nextStart)}.`}</p>
      ${ps.take ? `<label style="display:flex;gap:.6rem;align-items:center"><input type="checkbox" ${c.taken[t] ? 'checked' : ''} data-chg="pilltaken"> Já tomei hoje</label>` : ''}` : '<p class="note">Informe o 1º dia da cartela para começar.</p>'}
    <div class="row" style="margin-top:.6rem">${last7.map(d => `<span title="${fmtShort(d)}" style="text-align:center;font-size:.7rem;color:var(--muted)">${DOW[parse(d).getDay()]}<br>${c.taken[d] ? '✅' : (pillStatus(d) && pillStatus(d).take && d < t ? '⚠️' : '·')}</span>`).join('')}</div>
    <button class="ghost sm" style="margin-top:.6rem" data-act="notif">🔔 Ativar avisos neste aparelho</button>
    <p class="note">Os avisos só aparecem com o app aberto (ou em segundo plano). Para garantir, crie também um alarme no relógio do celular.</p>` : ''}
  </section>`;
};

views.backup = () => {
  const st = B.state, last = cfg.lastAt ? new Date(cfg.lastAt).toLocaleString('pt-BR') : '—';
  return `<section class="card"><h2>☁️ Backup no Google Drive</h2>
    <p class="status ${st === 'ok' ? 'ok' : st === 'off' ? '' : 'warn'}">${esc(B.msg)}</p>
    <p class="note">Último backup: ${last}</p>
    ${cfg.clientId ? `<div class="row" style="margin-top:.6rem">
      ${cfg.connected ? '' : '<button class="pri" data-act="connect">Entrar com Google e ativar</button>'}
      ${cfg.connected ? '<button class="pri" data-act="backupnow">Fazer backup agora</button><button class="ghost" data-act="restore">Restaurar do Drive</button><button class="ghost" data-act="disconnect">Desconectar</button>' : ''}</div>
      ${cfg.connected ? `<label style="display:flex;gap:.6rem;align-items:center;margin-top:.6rem"><input type="checkbox" ${cfg.auto ? 'checked' : ''} data-chg="autobk"> Backup automático a cada alteração</label>` : ''}`
      : '<p>Falta configurar o ID do cliente Google (uma vez só). Veja o passo a passo abaixo.</p>'}
    <p class="note">O backup fica numa pasta privada do app no seu Drive. Ao abrir o app em outro aparelho com a mesma conta, os dados mais novos são puxados automaticamente.</p>
  </section>
  <details class="card" ${cfg.clientId ? '' : 'open'}><summary>Configuração do Google (uma vez só)</summary>
    <ol class="steps">
      <li>Acesse <code>console.cloud.google.com</code> → crie um projeto (ex.: “Vida em Ordem”).</li>
      <li>Em <b>APIs e serviços → Biblioteca</b>, ative a <b>Google Drive API</b>.</li>
      <li>Em <b>Tela de permissão OAuth</b>: tipo <i>Externo</i>, preencha o nome do app e seu e-mail; adicione seu e-mail em <b>Usuários de teste</b>.</li>
      <li>Em <b>Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web</b>. Em <b>Origens JavaScript autorizadas</b> coloque: <code>${esc(location.origin)}</code></li>
      <li>Copie o <b>ID do cliente</b> e cole abaixo.</li></ol>
    <label class="f">ID do cliente OAuth</label>
    <form class="row" data-submit="saveClient"><input type="text" name="cid" value="${esc(cfg.clientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com"><button class="pri">Salvar</button></form>
  </details>
  <section class="card"><h2>Arquivo de segurança</h2><p class="note" style="margin-top:0">Cópia manual, caso queira guardar por conta própria.</p>
    <div class="row"><button class="ghost" data-act="export">Baixar backup (.json)</button>
    <label class="ghost" style="border:1px solid var(--accent);border-radius:12px;padding:.55rem .95rem;cursor:pointer;color:var(--accent)">Importar<input type="file" accept=".json,application/json" data-chg="import" hidden></label></div></section>`;
};

/* =====================  Render e navegação  ===================== */
function renderNav() {
  $('#nav').innerHTML = NAV.map(([k, ic, l]) => `<button class="${view === k ? 'on' : ''}" data-act="go" data-v="${k}"><span>${ic}</span>${l}</button>`).join('');
}
function render() {
  $('#main').innerHTML = views[view]();
  renderNav(); renderCloud();
  if (view === 'estudos') updateClock();
}
function go(v) { view = v; render(); window.scrollTo(0, 0); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }

/* =====================  Pomodoro  ===================== */
const P = { phase: 'focus', left: null, running: false, end: 0, cycles: 0, t: null };
const pTotal = () => (P.phase === 'focus' ? D.study.focus : (P.cycles > 0 && P.cycles % 4 === 0 ? 15 : D.study.rest)) * 60;
function updateClock() {
  const c = $('#pomoClock'); if (!c) return;
  const txt = `${pad(Math.floor(P.left / 60))}:${pad(P.left % 60)}`;
  c.textContent = txt;
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
    navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icons/icon-192.png', tag })).catch(() => { });
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
  const t = today(), hm = nowHM(), ps = pillStatus(t);
  if (ps && ps.take && !D.pill.taken[t] && hm >= D.pill.time) notifyOnce('pill' + t, '💊 Hora da pílula', 'Marque como tomada no app.');
  D.agenda.filter(a => a.date === t && a.time && hm >= a.time).forEach(a => {
    const mins = (+hm.slice(0, 2) * 60 + +hm.slice(3)) - (+a.time.slice(0, 2) * 60 + +a.time.slice(3));
    if (mins <= 60) notifyOnce('ag' + t + a.id, '📅 ' + a.title, 'Compromisso agora (' + a.time + ').');
  });
}

/* =====================  Backup no Google Drive  ===================== */
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata', FN = 'vida-em-ordem-backup.json';
const B = { state: 'off', msg: 'Backup desligado' };
function setB(state, msg) {
  B.state = state;
  B.msg = msg || ({ off: 'Backup desligado', saving: 'Salvando no Drive…', ok: 'Tudo salvo no Drive ✓', pending: 'Alterações aguardando backup…', needlogin: 'Toque em qualquer botão para renovar o login do Google' }[state] || '');
  renderCloud(); if (view === 'backup') render();
}
function renderCloud() {
  const c = $('#cloud'); if (!c) return;
  const t = { off: '☁️ Backup off', saving: '☁️ Salvando…', ok: '☁️ Salvo ' + (cfg.lastAt ? new Date(cfg.lastAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''), pending: '☁️ Pendente', needlogin: '☁️ Reconectar' }[B.state];
  c.textContent = t;
}
let tokenClient = null, token = '', tokenExp = 0, waiter = null;
function initGoogle() {
  if (tokenClient) return true;
  if (!cfg.clientId || !(window.google && google.accounts && google.accounts.oauth2)) return false;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cfg.clientId, scope: SCOPE,
    callback: r => {
      const w = waiter; waiter = null;
      if (r.error) { w && w.rej(Object.assign(new Error(r.error), { auth: true })); return; }
      token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
      cfg.connected = true; saveCfg(); w && w.res(token);
    },
    error_callback: e => { const w = waiter; waiter = null; w && w.rej(Object.assign(new Error(e.type || 'popup'), { auth: true })); }
  });
  return true;
}
function getToken() {
  if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
  if (!initGoogle()) return Promise.reject(Object.assign(new Error('Google indisponível'), { offline: true }));
  return new Promise((res, rej) => { waiter = { res, rej }; tokenClient.requestAccessToken({ prompt: cfg.connected ? '' : 'consent' }); });
}
async function api(url, opt, t) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + t, ...((opt && opt.headers) || {}) } });
  if (!r.ok) { const e = new Error('Drive ' + r.status); e.status = r.status; throw e; }
  return r;
}
async function findFile(t) {
  const r = await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)&q=${encodeURIComponent(`name='${FN}'`)}`, {}, t);
  return ((await r.json()).files || [])[0]?.id || '';
}
async function createFile(t, body) {
  const b = 'vo' + uid(), meta = JSON.stringify({ name: FN, parents: ['appDataFolder'] });
  const payload = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: payload }, t);
  return (await r.json()).id;
}
const updateFile = (t, id, body) => api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
  { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }, t);

let bTimer, busy = false, again = false;
function markDirty() {
  cfg.dirty = true; saveCfg();
  if (cfg.connected && cfg.auto) { clearTimeout(bTimer); bTimer = setTimeout(() => runBackup(), 2500); if (B.state !== 'needlogin') setB('pending'); }
}
async function runBackup() {
  if (!cfg.clientId || !cfg.connected) return;
  if (busy) { again = true; return; }
  busy = true;
  const ver = D.updatedAt;
  try {
    const p = getToken(); setB('saving');
    const t = await p, body = JSON.stringify(D);
    let id = cfg.fileId || await findFile(t);
    if (id) { try { await updateFile(t, id, body); } catch (e) { if (e.status === 404) id = ''; else throw e; } }
    if (!id) id = await createFile(t, body);
    cfg.fileId = id; cfg.lastAt = Date.now();
    if (D.updatedAt === ver) cfg.dirty = false; else again = true;
    saveCfg(); setB('ok');
  } catch (e) {
    console.warn('backup', e);
    if (e.status === 401) token = '';
    if (e.auth || e.status === 401) setB('needlogin');
    else setB('pending', navigator.onLine ? 'Não consegui salvar agora. Vou tentar de novo.' : 'Sem internet — o backup sai quando voltar a conexão.');
  } finally {
    busy = false;
    if (again) { again = false; clearTimeout(bTimer); bTimer = setTimeout(runBackup, 1500); }
  }
}
async function pullRemote() {
  const t = await getToken();
  const id = cfg.fileId || await findFile(t);
  if (!id) return null;
  cfg.fileId = id; saveCfg();
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {}, t);
  return r.json();
}
function applyRemote(data) { D = merge(DEF(), data); localStorage.setItem(KEY, JSON.stringify(D)); cfg.dirty = false; saveCfg(); P.left = null; render(); }
async function syncCheck() {
  if (!cfg.connected || busy) return;
  try {
    const rem = await pullRemote();
    if (!rem) { if (D.updatedAt) runBackup(); else setB('ok'); return; }
    if ((rem.updatedAt || 0) > D.updatedAt) {
      if (!cfg.dirty) { applyRemote(rem); toast('Dados atualizados com o Drive'); setB('ok'); }
      else if (confirm('Há um backup mais recente no Google Drive (de outro aparelho). Restaurar e descartar as alterações locais ainda não salvas?')) { applyRemote(rem); setB('ok'); }
      else runBackup();
    } else if (cfg.dirty) runBackup(); else setB('ok');
  } catch (e) { if (e.auth) setB('needlogin'); }
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
window.__gis = () => { if (cfg.connected) { initGoogle(); syncCheck(); } else if (view === 'backup') render(); };

/* =====================  Ações (cliques)  ===================== */
const A = {
  go: el => go(el.dataset.v),
  day: el => { sel = addDays(sel, +el.dataset.n); render(); },
  todaybtn: () => { sel = today(); render(); },
  gotodate: el => { sel = el.dataset.v; render(); window.scrollTo(0, 0); },
  preset: el => { const ds = el.dataset.d.split(',').map(Number); $$('input[name=d]', el.closest('form')).forEach(c => c.checked = ds.includes(+c.value)); },
  rdel: el => { if (confirm('Excluir este item?')) mutate(d => { d.routines[el.dataset.k] = d.routines[el.dataset.k].filter(r => r.id !== el.dataset.id); }); },
  water: el => mutate(d => { d.water.log[sel] = Math.max(0, (d.water.log[sel] || 0) + +el.dataset.n); }),
  fdel: el => mutate(d => { d.food = d.food.filter(f => f.id !== el.dataset.id); }),
  shopf: el => { shopF = el.dataset.v; render(); },
  sdel: el => mutate(d => { d.shop = d.shop.filter(i => i.id !== el.dataset.id); }),
  sclear: () => mutate(d => { d.shop = d.shop.filter(i => !i.done); }),
  adel: el => { if (confirm('Excluir compromisso?')) mutate(d => { d.agenda = d.agenda.filter(a => a.id !== el.dataset.id); }); },
  ics: el => {
    const a = D.agenda.find(x => x.id === el.dataset.id); if (!a) return;
    const dt = a.date.replace(/-/g, ''), tm = (a.time || '').replace(':', '');
    const start = a.time ? `DTSTART:${dt}T${tm}00` : `DTSTART;VALUE=DATE:${dt}`;
    const endD = a.time ? `DTEND:${dt}T${pad(Math.min(23, +a.time.slice(0, 2) + 1))}${a.time.slice(3)}00` : `DTEND;VALUE=DATE:${addDays(a.date, 1).replace(/-/g, '')}`;
    download('compromisso.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vida em Ordem//PT', 'BEGIN:VEVENT', 'UID:' + a.id + '@vidaemordem', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', start, endD, 'SUMMARY:' + a.title.replace(/[,;\n]/g, ' '), a.notes ? 'DESCRIPTION:' + a.notes.replace(/[,;\n]/g, ' ') : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n'), 'text/calendar');
  },
  mood: el => mutate(d => { const j = d.journal[sel] || (d.journal[sel] = {}); j.mood = j.mood === +el.dataset.v ? 0 : +el.dataset.v; }),
  cal: el => { calM = new Date(calM.getFullYear(), calM.getMonth() + +el.dataset.n, 1); render(); },
  pend: el => mutate(d => { const p = d.cycle.periods.find(x => x.start === el.dataset.id); if (p) p.end = today() < p.start ? p.start : today(); }),
  pdel: el => { if (confirm('Excluir este registro?')) mutate(d => { d.cycle.periods = d.cycle.periods.filter(p => p.start !== el.dataset.id); }); },
  pillpreset: el => mutate(d => { d.pill.active = +el.dataset.a; d.pill.pause = +el.dataset.p; }),
  newpack: () => mutate(d => { d.pill.start = today(); }),
  pilltake: () => mutate(d => { d.pill.taken[today()] = true; }),
  notif: async () => {
    if (!('Notification' in window)) return toast('Este navegador não suporta avisos.');
    const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Avisos ativados ✓' : 'Permissão negada.');
  },
  pstart: () => {
    if (P.left == null) P.left = pTotal();
    if (P.running) { P.running = false; clearInterval(P.t); pTick(); document.title = 'Vida em Ordem'; }
    else { P.running = true; P.end = Date.now() + P.left * 1000; P.t = setInterval(pTick, 250); }
    updateClock();
  },
  pskip: () => { P.phase = P.phase === 'focus' ? 'rest' : 'focus'; P.left = pTotal(); if (P.running) P.end = Date.now() + P.left * 1000; updateClock(); },
  preset2: () => { P.running = false; clearInterval(P.t); P.phase = 'focus'; P.left = pTotal(); document.title = 'Vida em Ordem'; updateClock(); },
  cloud: () => { if (cfg.connected && (B.state === 'needlogin' || B.state === 'pending')) runBackup(); else go('backup'); },
  connect: async () => {
    try { setB('saving', 'Aguardando login do Google…'); await getToken(); toast('Conectado ✓'); await syncCheck(); if (B.state !== 'ok') await runBackup(); }
    catch (e) { setB('off', e.offline ? 'Não consegui carregar o login do Google. Verifique a internet.' : 'Login cancelado ou bloqueado. Tente de novo.'); }
  },
  backupnow: () => runBackup(),
  restore: async () => {
    if (!confirm('Substituir os dados deste aparelho pelo backup do Drive?')) return;
    try { const rem = await pullRemote(); if (!rem) return toast('Nenhum backup encontrado no Drive.'); applyRemote(rem); setB('ok'); toast('Backup restaurado ✓'); }
    catch (e) { toast('Não foi possível restaurar: ' + e.message); }
  },
  disconnect: () => {
    if (!confirm('Desconectar do Google? Seus dados continuam no aparelho e no Drive.')) return;
    try { token && google.accounts.oauth2.revoke(token); } catch { }
    token = ''; cfg.connected = false; cfg.fileId = ''; saveCfg(); setB('off'); render();
  },
  export: () => download(`vida-em-ordem-${today()}.json`, JSON.stringify(D, null, 1), 'application/json'),
  install: async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; } }
};

const C = {
  setdate: el => { if (el.value) { sel = el.value; render(); } },
  rtoggle: el => mutate(d => {
    const log = d.rlog[el.dataset.k], a = log[sel] || (log[sel] = []);
    const i = a.indexOf(el.dataset.id); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.id);
  }),
  stoggle: el => mutate(d => { const i = d.shop.find(x => x.id === el.dataset.id); if (i) i.done = el.checked; }),
  pilltaken: el => mutate(d => { d.pill.taken[today()] = el.checked; }),
  set: el => {
    const t = el.dataset.type; let v = el.value;
    if (t === 'num') { v = Number(v); if (!isFinite(v) || (el.min !== '' && v < +el.min)) return render(); }
    if (t === 'bool') v = el.checked;
    mutate(d => setPath(d, el.dataset.path, v));
    if (el.dataset.path.startsWith('study.')) { if (!P.running) P.left = null; }
  },
  autobk: el => { cfg.auto = el.checked; saveCfg(); if (cfg.auto && cfg.dirty) runBackup(); },
  import: el => {
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const d = JSON.parse(r.result); if (!isObj(d)) throw 0; if (!confirm('Substituir os dados atuais pelo arquivo?')) return; D = merge(DEF(), d); save(); render(); toast('Importado ✓'); }
      catch { toast('Arquivo inválido.'); }
    };
    r.readAsText(f);
  }
};

const S = {
  addRoutine: (fd, f) => {
    const days = fd.getAll('d').map(Number), name = fd.get('name').trim(); if (!name) return;
    mutate(d => d.routines[f.dataset.k].push({ id: uid(), name, reps: (fd.get('reps') || '').trim(), days: days.length ? days : [0, 1, 2, 3, 4, 5, 6] }));
  },
  addMin: fd => mutate(d => { d.study.log[sel] = (d.study.log[sel] || 0) + Math.round(+fd.get('min')); }),
  addFood: fd => mutate(d => d.food.push({ id: uid(), date: sel, time: fd.get('time') || nowHM(), type: fd.get('type'), text: fd.get('text').trim() })),
  addShop: fd => mutate(d => d.shop.push({ id: uid(), name: fd.get('name').trim(), kind: fd.get('kind'), price: +fd.get('price') || 0, done: false })),
  addAgenda: fd => mutate(d => d.agenda.push({ id: uid(), title: fd.get('title').trim(), date: fd.get('date'), time: fd.get('time') || '', notes: (fd.get('notes') || '').trim() })),
  addPeriod: fd => {
    const start = fd.get('start'), end = fd.get('end') || '';
    if (end && end < start) return toast('O último dia não pode ser antes do primeiro.');
    mutate(d => { d.cycle.periods = d.cycle.periods.filter(p => p.start !== start); d.cycle.periods.push(end ? { start, end } : { start }); });
    calM = parse(start);
  },
  saveClient: fd => { cfg.clientId = fd.get('cid').trim(); cfg.connected = false; cfg.fileId = ''; tokenClient = null; token = ''; saveCfg(); setB('off'); render(); toast('ID salvo. Agora toque em “Entrar com Google”.'); }
};

let jT;
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (B.state === 'needlogin' && cfg.connected && !busy) runBackup(); // o toque é o "gesto" que o navegador exige p/ renovar o login
  if (el && A[el.dataset.act]) A[el.dataset.act](el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && C[el.dataset.chg]) C[el.dataset.chg](el, e); });
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-submit]'); if (!f) return;
  e.preventDefault(); S[f.dataset.submit](new FormData(f), f);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]'); if (!el) return;
  clearTimeout(jT);
  const day = sel, field = el.dataset.inp, val = el.value;
  jT = setTimeout(() => mutate(d => { (d.journal[day] || (d.journal[day] = {}))[field] = val; }, { render: false }), 500);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (cfg.dirty && cfg.connected && token && Date.now() < tokenExp) { clearTimeout(bTimer); runBackup(); } }
  else { reminderTick(); syncCheck(); }
});
addEventListener('online', () => { if (cfg.dirty) runBackup(); else syncCheck(); });
addEventListener('beforeunload', () => { clearTimeout(jT); });

let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
addEventListener('appinstalled', () => { $('#install').hidden = true; toast('App instalado ✓'); });

/* =====================  Início  ===================== */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
if (cfg.clientId && cfg.connected) setB(cfg.dirty ? 'pending' : 'ok', cfg.dirty ? 'Alterações aguardando backup…' : 'Conectado ao Drive'); else setB('off');
render();
setInterval(reminderTick, 30000); reminderTick();
if (window.google && google.accounts) window.__gis();
