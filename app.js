import { DEFAULT_STOPS, KVB_BOARD, STALE_MS } from './config.js';

const $ = (s) => document.querySelector(s);
const tabs = $('#tabs'), frame = $('#board'), add = $('#add'), del = $('#del');

const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// stops3: Haltestellen sind Objekte {name, note?, url}. Alte Einträge (nur Namen) werden verworfen.
let stops = get('stops3', DEFAULT_STOPS);
let active = Math.max(0, Math.min(get('active', 0), stops.length - 1));
let loadedAt = 0;

function load() {
  if (!stops.length) { frame.removeAttribute('src'); return; }
  const s = stops[active];
  frame.src = s.url || KVB_BOARD(s.name);
  loadedAt = Date.now();
}

function draw() {
  tabs.replaceChildren(...stops.map((s, i) => {
    const b = document.createElement('button');
    b.className = i === active ? 'on' : '';
    b.append(s.name);
    if (s.note) { const n = document.createElement('small'); n.textContent = s.note; b.append(n); }
    b.onclick = () => { if (i === active) return load(); active = i; set('active', i); draw(); load(); };
    return b;
  }));
  del.hidden = !stops.length;
  $('#empty').hidden = stops.length > 0;
  frame.hidden = !stops.length;
}

const save = () => { set('stops3', stops); set('active', active); draw(); load(); };

add.onclick = () => {
  const name = prompt('Haltestelle (z. B. "Neumarkt")')?.trim();
  if (!name) return;
  const url = prompt('Link eines VRS-Abfahrtsmonitors (vrs.de/am/s/…), leer = KVB-Tafel')?.trim() || '';
  if (url && !/^https:\/\/www\.vrs\.de\/am\/s\//.test(url)) { alert('Kein VRS-Monitor-Link.'); return; }
  stops = [...stops, { name, url }]; active = stops.length - 1; save();
};

del.onclick = () => {
  if (!confirm(`„${stops[active].name}“ entfernen?`)) return;
  stops = stops.filter((_, i) => i !== active); active = Math.max(0, active - 1); save();
};

draw();
load();
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - loadedAt > STALE_MS) load(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
