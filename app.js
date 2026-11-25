import { API, REFRESH_MS, DEPARTURES } from './config.js';

const $ = (s) => document.querySelector(s);
const q = $('#q'), results = $('#results'), pinsEl = $('#pins'), statusEl = $('#status'), empty = $('#empty');

const load = () => { try { return JSON.parse(localStorage.getItem('pins')) || []; } catch { return []; } };
const save = (p) => { try { localStorage.setItem('pins', JSON.stringify(p)); } catch {} };
let pins = load();

const get = async (path) => {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

// ---- Suche ----
let timer, seq = 0;
q.addEventListener('input', () => {
  clearTimeout(timer);
  const v = q.value.trim();
  if (v.length < 2) { results.hidden = true; return; }
  timer = setTimeout(() => search(v), 300);
});

async function search(v) {
  const n = ++seq;
  try {
    const data = await get(`/locations?query=${encodeURIComponent(v + ' Köln')}&results=8&stops=true&addresses=false&poi=false`);
    if (n !== seq) return;
    const stops = data.filter((s) => s.type === 'stop' || s.type === 'station');
    results.replaceChildren(...stops.map(resultRow));
    results.hidden = !stops.length;
  } catch (e) { setStatus('Suche fehlgeschlagen: ' + e.message); }
}

function resultRow(s) {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = s.name;
  const b = document.createElement('button');
  const render = () => { const on = pins.some((p) => p.id === s.id); b.textContent = on ? 'Gepinnt' : 'Pinnen'; b.className = on ? 'on' : ''; };
  b.onclick = () => { toggle(s); render(); };
  render();
  li.append(name, b);
  return li;
}

function toggle(s) {
  pins = pins.some((p) => p.id === s.id) ? pins.filter((p) => p.id !== s.id) : [...pins, { id: s.id, name: s.name }];
  save(pins);
  draw();
  refresh();
}

// ---- Anzeige ----
function draw() {
  empty.hidden = pins.length > 0;
  pinsEl.replaceChildren(...pins.map((p) => {
    const sec = document.createElement('div');
    sec.className = 'stop';
    sec.id = 'stop-' + p.id;
    const h = document.createElement('h2');
    const t = document.createElement('span');
    t.textContent = p.name;
    const x = document.createElement('button');
    x.textContent = 'Entfernen';
    x.onclick = () => toggle(p);
    h.append(t, x);
    const list = document.createElement('div');
    list.className = 'deps';
    list.textContent = '…';
    list.classList.add('dim');
    sec.append(h, list);
    return sec;
  }));
}

function depRow(d) {
  const when = new Date(d.when || d.plannedWhen);
  const min = Math.max(0, Math.round((when - Date.now()) / 60000));
  const delay = Math.round((d.delay || 0) / 60);
  const row = document.createElement('div');
  row.className = 'dep' + (d.cancelled ? ' cancel' : '');
  const l = document.createElement('span'); l.className = 'line'; l.textContent = d.line?.name || '?';
  const dir = document.createElement('span'); dir.className = 'dir'; dir.textContent = d.direction || '';
  const m = document.createElement('span'); m.className = 'min' + (delay > 0 ? ' late' : '');
  m.textContent = d.cancelled ? 'entfällt' : min === 0 ? 'jetzt' : min + ' min';
  row.append(l, dir, m);
  return row;
}

async function refresh() {
  if (!pins.length) { setStatus(''); return; }
  let failed = 0;
  await Promise.all(pins.map(async (p) => {
    const box = document.getElementById('stop-' + p.id)?.querySelector('.deps');
    if (!box) return;
    try {
      const data = await get(`/stops/${encodeURIComponent(p.id)}/departures?duration=90&results=12&remarks=false`);
      const deps = (data.departures || data).filter((d) => d.when || d.plannedWhen).slice(0, DEPARTURES);
      box.classList.remove('dim');
      box.replaceChildren(...(deps.length ? deps.map(depRow) : [Object.assign(document.createElement('span'), { textContent: 'Keine Abfahrten' })]));
    } catch { failed++; }
  }));
  setStatus(failed ? 'Aktualisierung fehlgeschlagen (' + failed + ')' : 'Stand ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
}

const setStatus = (t) => { statusEl.textContent = t; };

draw();
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
