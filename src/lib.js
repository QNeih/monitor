import { useEffect, useRef, useState, useCallback } from 'react';

export const API = 'https://monitor.qneih.workers.dev';

// --- Uhr ---------------------------------------------------------------------------------------
// Der Worker schickt seine Uhrzeit mit (`now`); damit gleichen wir eine falsch gehende Handyuhr aus.
let skew = 0;
export const nowS = () => Date.now() / 1000 + skew;

export const GOOGLE_CLIENT_ID = '831637996840-c5j3gr7dnrerbguae5dl1pf8c72df47b.apps.googleusercontent.com';

// Anmeldung: Sitzungstoken des Workers (180 Tage) im Gerät.
export const getAuth = () => { try { return JSON.parse(localStorage.getItem('auth')); } catch { return null; } };
export const setAuth = (a) => { try { a ? localStorage.setItem('auth', JSON.stringify(a)) : localStorage.removeItem('auth'); } catch {} window.dispatchEvent(new Event('auth')); };

export async function api(path, params = {}, { method = 'GET', body } = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const t0 = Date.now();
  const headers = {};
  const a = getAuth();
  if (a?.token) headers.Authorization = `Bearer ${a.token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(u, { cache: 'no-store', method, headers, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && a?.token) setAuth(null);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  if (d.now) skew = d.now + (Date.now() - t0) / 2000 - Date.now() / 1000;
  return d;
}

const hm = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' });
// Uhrzeit abgeschnitten auf die Minute (wie die Tafel); der Countdown rechnet sekundengenau mit derselben Zahl.
export const hhmm = (ts) => (ts ? hm.format(new Date(Math.floor(ts / 60) * 60000)) : '–');
export const day = (ts) => dayFmt.format(new Date(ts * 1000));

// Countdown bis ts: mit Sekunden (m:ss) nur für die nächste Abfahrt, sonst ganze Minuten.
export function countdown(ts, now, seconds = true) {
  const s = Math.round(ts - now);
  if (s <= 0) return { text: 'jetzt', past: true };
  if (s >= 3600) return { text: `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`, unit: 'min' };
  if (!seconds) return { text: s < 60 ? '<1' : String(Math.floor(s / 60)), unit: 'min' };
  return { text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, unit: 'min' };
}

// Rendert jede Sekunde neu (für Countdowns).
export function useNow(ms = 1000) {
  const [n, set] = useState(nowS);
  useEffect(() => {
    let t;
    const tick = () => { set(nowS()); t = setTimeout(tick, ms - (Date.now() % ms)); };
    tick();
    return () => clearTimeout(t);
  }, [ms]);
  return n;
}

// --- Speicher ----------------------------------------------------------------------------------

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function useStored(key, init) {
  const [v, setV] = useState(() => read(key, init));
  const set = useCallback((next) => setV((old) => { const n = typeof next === 'function' ? next(old) : next; write(key, n); return n; }), [key]);
  return [v, set];
}

// --- Abfragen im Takt --------------------------------------------------------------------------
// Ruft `load` zu festen Sekunden der Minute auf (wie bisher :01 und :31), sofort beim Start,
// und beim Zurückkehren aus dem Hintergrund, wenn die Daten älter als `stale` Sekunden sind.
export function usePoll(load, deps, { at = [1, 31], stale = 30 } = {}) {
  const last = useRef(0);
  const fn = useRef(load);
  fn.current = load;
  useEffect(() => {
    let t, dead = false;
    const run = () => { if (dead) return; last.current = Date.now(); fn.current(); };
    const schedule = () => {
      const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000;
      const next = at.find((x) => x > s) ?? at[0] + 60;
      t = setTimeout(() => { if (!document.hidden) run(); schedule(); }, (next - s) * 1000);
    };
    const vis = () => { if (!document.hidden && Date.now() - last.current > stale * 1000) run(); };
    run();
    schedule();
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; clearTimeout(t); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// --- Abfahrten ---------------------------------------------------------------------------------
// VRS liefert abwechselnd zwei leicht verschiedene Datenstände. Eine einmal gesehene Echtzeit
// verschwindet deshalb nicht wieder, wenn der nächste Stand keine hat.
const seenRt = new Map();

export function normalize(events) {
  return events.map((e) => {
    const dep = e.departure || {}, line = e.line || {};
    const key = `${line.number}|${line.direction}|${dep.day || 0}|${dep.timetable}|${e.stopPoint?.ifopt || ''}`;
    let rt = dep.estimate ? dep.timestamp : null;
    if (rt) seenRt.set(key, rt); else if (seenRt.has(key)) rt = seenRt.get(key);
    const ts = rt ?? dep.timestamp;
    return {
      key,
      line: line.number,
      direction: line.direction,
      product: line.product,
      platform: (e.stopPoint?.name || '').replace(/^.*\((Gleis [^)]+)\).*$/, '$1'),
      plan: dep.timetable,
      ts,
      rt: !!rt,
      delayed: !!rt && hhmm(ts) !== dep.timetable,
    };
  });
}

export const shortName = (n = '') => n.replace(/,\s*Köln.*$/, '');

export function useAuth() {
  const [a, set] = useState(getAuth);
  useEffect(() => { const f = () => set(getAuth()); window.addEventListener('auth', f); return () => window.removeEventListener('auth', f); }, []);
  return a;
}

// --- Push --------------------------------------------------------------------------------------

const VAPID = 'BEPM96CDxwUZTivXrMAjDQgb2yzs2DqGc5utaOlTLoJ7lPAlu_nw3cdqSyFP3kNS08M9VFxpvWPFqaq5Tja7XIc';
const key = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'on' : 'off';
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Dieses Gerät kann keine Web-Push-Nachrichten (iPhone: erst „Zum Home-Bildschirm“).');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Benachrichtigungen nicht erlaubt.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID) }));
  await api('/push', {}, { method: 'POST', body: { subscription: sub.toJSON() } });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await api('/push', {}, { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

// Laufenden Sprung an den Worker melden (für die Benachrichtigungen). Ohne Anmeldung: nichts.
export function syncTrip(trip) {
  if (!getAuth()?.token) return;
  (trip ? api('/trip', {}, { method: 'PUT', body: { trip } }) : api('/trip', {}, { method: 'DELETE' })).catch(() => {});
}
