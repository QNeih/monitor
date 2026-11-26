import { BOARD, DEFAULT_STOPS, RELOAD_MS } from './config.js';

const $ = (s) => document.querySelector(s);
const tabs = $('#tabs'), frame = $('#board'), add = $('#add'), del = $('#del');

const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let stops = get('stops', DEFAULT_STOPS);
let active = Math.max(0, Math.min(get('active', 0), stops.length - 1));
let loadedAt = 0;

function load() {
  if (!stops.length) { frame.removeAttribute('src'); return; }
  frame.src = BOARD(stops[active]);
  loadedAt = Date.now();
}

function draw() {
  tabs.replaceChildren(...stops.map((name, i) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.className = i === active ? 'on' : '';
    b.onclick = () => { if (i === active) return load(); active = i; set('active', i); draw(); load(); };
    return b;
  }));
  del.hidden = !stops.length;
  $('#empty').hidden = stops.length > 0;
  frame.hidden = !stops.length;
}

add.onclick = () => {
  const name = prompt('Haltestelle (Name wie in der KVB-Auskunft, z. B. "Neumarkt")')?.trim();
  if (!name) return;
  stops = [...stops, name]; active = stops.length - 1;
  set('stops', stops); set('active', active); draw(); load();
};

del.onclick = () => {
  if (!confirm(`„${stops[active]}“ entfernen?`)) return;
  stops = stops.filter((_, i) => i !== active); active = Math.max(0, active - 1);
  set('stops', stops); set('active', active); draw(); load();
};

draw();
load();
setInterval(() => { if (!document.hidden) load(); }, RELOAD_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - loadedAt > 30000) load(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
