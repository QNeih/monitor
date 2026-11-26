import { DEFAULT_STOPS, KVB_BOARD, STALE_MS } from './config.js';

const $ = (s) => document.querySelector(s);
const tabs = $('#tabs'), frame = $('#board'), editor = $('#editor'), list = $('#list');

const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

// stops3: Haltestellen sind Objekte {name, note?, url?}.
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
    const b = el('button', { className: i === active ? 'on' : '' }, el('b', { textContent: s.name }));
    if (s.note) b.append(el('small', { textContent: s.note }));
    b.onclick = () => { if (i === active) return load(); active = i; set('active', i); draw(); load(); };
    return b;
  }));
  $('#empty').hidden = stops.length > 0;
  frame.hidden = !stops.length;
  list.replaceChildren(...stops.map((s, i) => {
    const x = el('button', { type: 'button', className: 'icon', textContent: '✕' });
    x.setAttribute('aria-label', s.name + ' entfernen');
    x.onclick = () => {
      if (!confirm(`„${s.name}“ entfernen?`)) return;
      stops = stops.filter((_, j) => j !== i);
      if (active >= i && active > 0) active--;
      save();
    };
    return el('li', {}, el('span', {}, s.name, el('small', { textContent: s.note || (s.url ? '' : 'KVB-Tafel, ungefiltert') })), x);
  }));
}

const save = () => { set('stops3', stops); set('active', active); draw(); load(); };

$('#edit').onclick = () => editor.showModal();

// Dunkles Design (Standard: aus). Die Klasse setzt schon ein Inline-Skript im <head>, damit nichts aufblitzt.
const dark = $('#dark'), meta = document.querySelector('meta[name="theme-color"]');
const applyDark = (on) => {
  document.documentElement.classList.toggle('dark', on);
  meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
};
dark.checked = !!get('dark', false);
applyDark(dark.checked);
dark.onchange = () => { set('dark', dark.checked); applyDark(dark.checked); };
editor.addEventListener('click', (e) => { if (e.target === editor) editor.close(); });

$('#f-add').onclick = () => {
  const name = $('#f-name').value.trim(), note = $('#f-note').value.trim(), url = $('#f-url').value.trim();
  const err = $('#f-err');
  err.hidden = true;
  if (!name) { err.textContent = 'Name fehlt.'; err.hidden = false; return; }
  if (url && !/^https:\/\/www\.vrs\.de\/am\/s\/[0-9a-f]+\/?$/.test(url)) { err.textContent = 'Das ist kein VRS-Anzeige-Link (https://www.vrs.de/am/s/…).'; err.hidden = false; return; }
  stops = [...stops, { name, note, url }];
  active = stops.length - 1;
  for (const id of ['#f-name', '#f-note', '#f-url']) $(id).value = '';
  save();
  editor.close();
};

draw();
load();
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - loadedAt > STALE_MS) load(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
