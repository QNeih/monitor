// Cloudflare Worker für die Monitor-App: liest die offene VRS-Fahrplanauskunft und gibt JSON mit CORS-Freigabe zurück,
// verwaltet Konten (Google-Login), Kontakte und Push-Abos und schickt per Cron jede Minute die Reise-Benachrichtigungen.
//
// Fahrplan (offen):
//   GET /stops?q=<Text>[&koeln=1]          Haltestellensuche (VRS), optional nur Köln
//   GET /departures?stop=<IFOPT>           bis zu 50 nächste Abfahrten einer Haltestelle (eigener VRS-Abfahrtsmonitor je Haltestelle)
//   GET /route?from=<IFOPT>&to=<IFOPT>&t=<Unix-Sekunden>[&arr=1]
//                                          Verbindungen mit Zwischenhalten und Echtzeit (aus dem HTML der VRS-Auskunft)
//   GET /?i=<Monitor-ID>                   alt: einer der zwei festen Monitore (für die alte App-Version)
// Konto (Authorization: Bearer <Sitzungstoken>):
//   POST /auth/google {credential}         Google-ID-Token prüfen → Sitzungstoken (180 Tage)
//   GET  /me                               Konto, Kontakte, VAPID-Schlüssel
//   POST /contacts {email} · DELETE /contacts?email=
//   POST /push {subscription} · DELETE /push {endpoint} · POST /push/test
//   GET|PUT|DELETE /trip                   laufender Sprung (für die Benachrichtigungen)
//
// Bindings: DB (D1), VAPID_PRIVATE (JWK, geheim), VAPID_PUBLIC, SESSION_SECRET (geheim), GOOGLE_CLIENT_ID.
// Jede JSON-Antwort enthält `now` (Serverzeit in Unix-Sekunden), damit die App eine falsch gehende Handyuhr ausgleicht.

const LEGACY = new Set(['c7b9e206e5a96d00ddc7b174b3c8b621', '261a26437a2829b18f972a268b25c598']);
const IFOPT = /^de:\d{5}:\d{1,6}$/;
const KOELN = 'de:05315:';
const VRS = 'https://www.vrs.de';
const EKAP = 'https://ekap-web.vrs.de/index.php';
const UA = { 'User-Agent': 'Mozilla/5.0 (Monitor-App)', 'Accept-Language': 'de' };
const APP = 'https://qneih.github.io/monitor/';
const TRIP_TTL = 48 * 3600;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE' };
const now = () => Math.floor(Date.now() / 1000);
const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify({ ...body, now: now() }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
  });
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const q = url.searchParams;
    const m = request.method;
    try {
      switch (`${m} ${url.pathname}`) {
        case 'GET /stops': return await stops(q.get('q') || '', q.get('koeln') === '1');
        case 'GET /departures': return json(await departures(env, q.get('stop') || ''));
        case 'GET /route': return json({ routes: await route(q.get('from') || '', q.get('to') || '', Number(q.get('t')) || now(), q.get('arr') === '1') });
        case 'GET /': return await legacy(q.get('i') || '');
        case 'POST /auth/google': return await authGoogle(env, await body(request));
        case 'GET /me': return await me(env, await user(env, request));
        case 'POST /contacts': return await addContact(env, await user(env, request), await body(request));
        case 'DELETE /contacts': return await delContact(env, await user(env, request), q.get('email') || '');
        case 'POST /push': return await addSub(env, await user(env, request), await body(request));
        case 'DELETE /push': return await delSub(env, await user(env, request), await body(request));
        case 'POST /push/test': return await testPush(env, await user(env, request));
        case 'GET /trip': return await getTrip(env, await user(env, request));
        case 'PUT /trip': return await putTrip(env, await user(env, request), await body(request));
        case 'DELETE /trip': return await delTrip(env, await user(env, request));
        default: return json({ error: 'not found' }, 404);
      }
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, e instanceof HttpError ? e.status : 502);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
};

const body = async (r) => { try { return await r.json(); } catch { throw new HttpError(400, 'bad json'); } };

async function legacy(id) {
  if (!LEGACY.has(id)) return json({ error: 'unknown monitor' }, 404);
  return json(await monitor(id));
}

async function monitor(id) {
  const r = await fetch(`${VRS}/index.php?eID=tx_vrsinfo_departuremonitor&i=${id}`, { headers: { ...UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`vrs ${r.status}`);
  return r.json();
}

// --- Haltestellensuche -------------------------------------------------------------------------

async function stops(text, koeln) {
  text = text.trim().slice(0, 80);
  if (text.length < 2) return json({ stops: [] });
  const p = new URLSearchParams({ eID: 'tx_vrsinfo_ass2_objects', srv: 'web', ta: 'vrs', sc: '15', ac: '0', pc: '0', f: 'f', t: 's', cs: 'gk2', q: koeln && !/köln|koeln/i.test(text) ? `${text} Köln` : text });
  const r = await fetch(`${EKAP}?${p}`, { headers: UA });
  if (!r.ok) throw new Error(`vrs ${r.status}`);
  const d = await r.json();
  let list = (d.stops || []).filter((s) => IFOPT.test(s.ifopt || '')).map((s) => ({ id: s.ifopt, name: s.fullName }));
  if (koeln) list = list.filter((s) => s.id.startsWith(KOELN));
  return json({ stops: list }, 200, 3600);
}

// --- Abfahrten einer Haltestelle ---------------------------------------------------------------
// Je Haltestelle legt der Worker einmal einen eigenen VRS-Abfahrtsmonitor an (alle Linien, 50 Abfahrten = VRS-Maximum)
// und merkt sich dessen ID in D1. Geht das schief: der Monitor der VRS-Haltestellenseite (10 Abfahrten).

async function departures(env, stop) {
  if (!IFOPT.test(stop)) throw new HttpError(400, 'bad stop');
  const id = await monitorId(env, stop);
  if (!id) throw new HttpError(404, 'no departure board for this stop');
  const d = await monitor(id);
  return { updated: d.updated, events: d.events || [] };
}

async function monitorId(env, stop) {
  const row = await env.DB.prepare('SELECT id FROM monitors WHERE stop = ?').bind(stop).first();
  if (row) return row.id;
  let id = await createMonitor(stop).catch(() => null);
  if (!id) {
    const r = await fetch(`${VRS}/his/haltestelle/${stop}`, { headers: UA });
    const m = r.ok && (await r.text()).match(/\/am\/s\/([0-9a-f]{32})/);
    if (!m) return null;
    return m[1]; // nicht speichern: beim nächsten Mal erneut versuchen, einen eigenen anzulegen
  }
  await env.DB.prepare('INSERT OR REPLACE INTO monitors(stop, id, created) VALUES (?, ?, ?)').bind(stop, id, now()).run();
  return id;
}

const formOf = (html, marker) => {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const f = html.slice(html.lastIndexOf('<form', i), html.indexOf('</form>', i));
  const action = decode((f.match(/action="([^"]*)"/) || [])[1] || '');
  const fields = [];
  for (const [tag] of f.matchAll(/<input[^>]*>/g)) {
    const n = tag.match(/name="([^"]*)"/), v = tag.match(/value="([^"]*)"/), ty = tag.match(/type="([^"]*)"/);
    if (!n) continue;
    if (ty && /^(radio|checkbox)$/.test(ty[1]) && !/checked/.test(tag)) continue;
    fields.push([decode(n[1]), v ? decode(v[1]) : '']);
  }
  return { action, fields };
};

async function createMonitor(stop) {
  const page = await (await fetch(`${VRS}/fahrplanauskunft/abfahrtsmonitor`, { headers: UA })).text();
  const create = formOf(page, '/am/admin?');
  if (!create) throw new Error('no create form');
  const r1 = await fetch(VRS + create.action, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(create.fields), redirect: 'manual' });
  const admin = r1.headers.get('location');
  if (!admin || !/\/am\/admin\/[0-9a-f]{32}/.test(admin)) throw new Error('no admin url');
  const adminHtml = await (await fetch(new URL(admin, VRS), { headers: UA })).text();
  const show = (adminHtml.match(/id="showUrl"[^>]*value="[^"]*\/am\/s\/([0-9a-f]{32})"/) || [])[1];
  const save = formOf(adminHtml, 'id="departuremonitor"');
  if (!show || !save) throw new Error('no save form');
  const fields = save.fields.map(([n, v]) => [n, n === 'tx_vrsinfo[origin1Id]' ? stop : n === 'tx_vrsinfo[events]' ? '50' : v]);
  const r2 = await fetch(VRS + save.action, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams(fields) });
  if (!r2.ok) throw new Error(`save ${r2.status}`);
  const d = await monitor(show);
  if (!d.events) throw new Error('monitor empty');
  return show;
}

// --- Verbindungen ------------------------------------------------------------------------------

async function route(from, to, t, arr) {
  if (!IFOPT.test(from) || !IFOPT.test(to)) throw new HttpError(400, 'bad stop');
  const { date, time } = berlinDateTime(t);
  const P = 'tx_vrsinfo_pi_connection';
  const p = new URLSearchParams({
    [`${P}[request]`]: 'result',
    [`${P}[originId]`]: from, [`${P}[originType]`]: 'stop',
    [`${P}[destinationId]`]: to, [`${P}[destinationType]`]: 'stop',
    [`${P}[date]`]: date, [`${P}[time]`]: time,
    [`${P}[departureArrival]`]: arr ? 'arrival' : 'departure',
    [`${P}[showIntermediates]`]: '1',
  });
  const r = await fetch(`${VRS}/fahrplanauskunft?${p}`, { headers: UA });
  if (!r.ok) throw new Error(`vrs ${r.status}`);
  return parseRoutes(await r.text(), date);
}

// Zerlegt das HTML der VRS-Verbindungsauskunft. Aufbau je Verbindung:
// <div id="route-details-N"> … <div class="route-segments"> je Teilstrecke (Fahrt oder Fußweg) …
// Segmente: origin (ab), line (Linie + Richtung), intermediates (ab), destination (an).
export function parseRoutes(html, date) {
  const routes = [];
  const parts = html.split(/<div id="route-details-\d+"/).slice(1);
  for (const part of parts) {
    const body = part.split('class="links btn-toolbar"')[0];
    const legs = [];
    let prev = null; // für Tageswechsel
    const ts = (hhmm) => {
      let v = berlinTs(date, hhmm);
      if (prev !== null) while (v < prev - 12 * 3600) v += 86400;
      prev = v;
      return v;
    };
    for (const seg of body.split('<div class="route-segments').slice(1)) {
      const line = seg.match(/Linie ([^<]+)<\/a>\s*<\/strong>\s*Richtung:\s*([^<]+)</);
      const stops = [];
      for (const s of seg.split(/<div class="segment[ "]/).slice(1)) {
        const id = s.match(/href="\/his\/haltestelle\/([^"]+)"/);
        if (!id || !/class="times"/.test(s)) continue;
        const name = (s.match(/<strong>([^<]+)<\/strong>([^<]*)<\/a>/) || []);
        const time = s.match(/<span class="([^"]*)" title="([^"]*)">(\d\d:\d\d)<\/span>/);
        const sched = s.match(/class="scheduled-time"[^>]*>\((\d\d:\d\d)\)/);
        if (!time) continue;
        const shown = ts(time[3]);
        const hasRt = time[1] === 'punctual' || time[1] === 'delayed' || time[2] === 'pünktlich' || time[2] === 'verspätet';
        const plan = sched ? ts(sched[1]) : shown;
        const [, rawName = '', place = ''] = name;
        const pm = rawName.match(/^(.*?)\s*\(Gleis ([^)]+)\)$/);
        stops.push({
          id: id[1].split(':').slice(0, 3).join(':'),
          name: decode(pm ? pm[1] : rawName).trim(),
          place: decode(place.replace(/^,\s*/, '')).trim(),
          platform: pm ? pm[2] : null,
          plan,
          rt: hasRt ? shown : null,
        });
      }
      if (line) {
        const product = (seg.match(/<div class="line-image">\s*<img [^>]*alt="([^"]*)"/) || [])[1] || '';
        legs.push({ type: 'ride', line: decode(line[1]).trim(), direction: decode(line[2]).trim(), product: decode(product), stops });
      } else {
        const min = seg.match(/Fußweg[^<]*?(\d+)\s*min/);
        legs.push({ type: 'walk', minutes: min ? Number(min[1]) : null, stops });
      }
    }
    if (legs.some((l) => l.type === 'ride')) routes.push({ legs });
  }
  return routes;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#039': "'", apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e] ?? m;
});

// --- Zeit in Köln ------------------------------------------------------------------------------

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function berlinParts(ms) {
  const o = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) o[type] = Number(value);
  return o;
}
function berlinDateTime(t) {
  const p = berlinParts(t * 1000), z = (n) => String(n).padStart(2, '0');
  return { date: `${z(p.day)}.${z(p.month)}.${p.year}`, time: `${z(p.hour)}:${z(p.minute)}` };
}
// "27.11.2026" + "11:33" (Ortszeit Köln) → Unix-Sekunden
export function berlinTs(date, hhmm) {
  const [d, m, y] = date.split('.').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = berlinParts(guess);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess;
  return Math.round((guess - offset) / 1000);
}
const hhmm = (t) => berlinDateTime(t).time;

// --- Base64url und Signaturen ------------------------------------------------------------------

const enc = new TextEncoder();
const b64u = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { out.set(x, i); i += x.length; } return out; };

async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

// --- Konten ------------------------------------------------------------------------------------

let googleKeys = null, googleKeysAt = 0;
async function verifyGoogle(env, token) {
  const [h, p, s] = String(token).split('.');
  if (!s) throw new HttpError(401, 'bad token');
  const header = JSON.parse(new TextDecoder().decode(unb64u(h)));
  const claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
  if (!googleKeys || Date.now() - googleKeysAt > 3600e3 || !googleKeys.find((k) => k.kid === header.kid)) {
    googleKeys = (await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys;
    googleKeysAt = Date.now();
  }
  const jwk = googleKeys.find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new HttpError(401, 'bad signature');
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new HttpError(401, 'wrong audience');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new HttpError(401, 'wrong issuer');
  if (claims.exp < now()) throw new HttpError(401, 'expired');
  if (!claims.email || claims.email_verified === false) throw new HttpError(401, 'no verified email');
  return claims;
}

async function authGoogle(env, { credential }) {
  const c = await verifyGoogle(env, credential);
  const email = c.email.toLowerCase();
  await env.DB.prepare('INSERT INTO users(email, name, picture, created) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, picture = excluded.picture')
    .bind(email, c.name || email, c.picture || null, now()).run();
  const payload = b64u(enc.encode(JSON.stringify({ e: email, x: now() + 180 * 86400 })));
  const token = `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
  return json({ token, user: { email, name: c.name || email, picture: c.picture || null } });
}

async function user(env, request) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const [payload, sig] = t.split('.');
  if (!payload || !sig || sig !== await hmac(env.SESSION_SECRET, payload)) throw new HttpError(401, 'not signed in');
  const { e, x } = JSON.parse(new TextDecoder().decode(unb64u(payload)));
  if (x < now()) throw new HttpError(401, 'session expired');
  return e;
}

async function me(env, email) {
  const u = await env.DB.prepare('SELECT email, name, picture FROM users WHERE email = ?').bind(email).first();
  const contacts = (await env.DB.prepare(
    'SELECT c.email, u.name, (SELECT COUNT(*) FROM subs s WHERE s.email = c.email) AS devices FROM contacts c LEFT JOIN users u ON u.email = c.email WHERE c.owner = ? ORDER BY c.email',
  ).bind(email).all()).results;
  const devices = (await env.DB.prepare('SELECT COUNT(*) AS n FROM subs WHERE email = ?').bind(email).first()).n;
  return json({ user: u, contacts, devices, vapid: env.VAPID_PUBLIC });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function addContact(env, owner, { email }) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email === owner) throw new HttpError(400, 'bad email');
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM contacts WHERE owner = ?').bind(owner).first()).n;
  if (n >= 50) throw new HttpError(400, 'too many contacts');
  await env.DB.prepare('INSERT OR IGNORE INTO contacts(owner, email) VALUES (?, ?)').bind(owner, email).run();
  return me(env, owner);
}
async function delContact(env, owner, email) {
  await env.DB.prepare('DELETE FROM contacts WHERE owner = ? AND email = ?').bind(owner, email.toLowerCase()).run();
  return me(env, owner);
}

async function addSub(env, email, { subscription: s }) {
  if (!s || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) throw new HttpError(400, 'bad subscription');
  await env.DB.prepare('INSERT OR REPLACE INTO subs(endpoint, email, p256dh, auth, created) VALUES (?, ?, ?, ?, ?)').bind(s.endpoint, email, s.keys.p256dh, s.keys.auth, now()).run();
  return json({ ok: true });
}
async function delSub(env, email, { endpoint }) {
  await env.DB.prepare('DELETE FROM subs WHERE endpoint = ? AND email = ?').bind(String(endpoint || ''), email).run();
  return json({ ok: true });
}
async function testPush(env, email) {
  const n = await pushTo(env, [email], { title: 'Monitor', body: 'Benachrichtigungen funktionieren.', tag: 'test' });
  return json({ sent: n });
}

// --- Laufender Sprung --------------------------------------------------------------------------

async function getTrip(env, email) {
  const row = await env.DB.prepare('SELECT trip, state FROM trips WHERE owner = ?').bind(email).first();
  return json({ trip: row ? JSON.parse(row.trip) : null, state: row ? JSON.parse(row.state) : null });
}
async function putTrip(env, email, { trip }) {
  if (!trip || !IFOPT.test(trip.stopId || '') || !trip.line || !/^\d\d:\d\d$/.test(trip.plan || '') || !Number(trip.ts)) throw new HttpError(400, 'bad trip');
  const clean = {
    stopId: trip.stopId, stopName: String(trip.stopName || '').slice(0, 120), line: String(trip.line).slice(0, 10), direction: String(trip.direction || '').slice(0, 120),
    plan: trip.plan, ts: Number(trip.ts), selectedAt: Number(trip.selectedAt) || now(),
    dest: trip.dest && IFOPT.test(trip.dest.id || '') ? { id: trip.dest.id, name: String(trip.dest.name || '').slice(0, 120) } : null,
    invite: Array.isArray(trip.invite) ? trip.invite.filter((e) => EMAIL.test(e)).slice(0, 50) : [],
    countdown: trip.countdown !== false,
  };
  const old = await env.DB.prepare('SELECT trip, state FROM trips WHERE owner = ?').bind(email).first();
  let state = {};
  if (old) {
    const o = JSON.parse(old.trip);
    // gleiche Fahrt: Benachrichtigungsstand behalten (nur Ziel oder Einladungen geändert)
    if (o.stopId === clean.stopId && o.line === clean.line && o.plan === clean.plan && o.selectedAt === clean.selectedAt) {
      state = JSON.parse(old.state);
      if ((o.dest && o.dest.id) !== (clean.dest && clean.dest.id)) state = { ...state, arrival: null, transfers: {}, soon: false, arrived: false, done: false };
    }
  }
  await env.DB.prepare('INSERT OR REPLACE INTO trips(owner, trip, state, updated) VALUES (?, ?, ?, ?)').bind(email, JSON.stringify(clean), JSON.stringify(state), now()).run();
  return json({ ok: true });
}
async function delTrip(env, email) {
  const had = await env.DB.prepare('SELECT state FROM trips WHERE owner = ?').bind(email).first();
  await env.DB.prepare('DELETE FROM trips WHERE owner = ?').bind(email).run();
  if (had && !JSON.parse(had.state).departed) await pushTo(env, [email], { close: 'countdown' });
  return json({ ok: true });
}

// --- Cron: Benachrichtigungen ------------------------------------------------------------------

async function tick(env) {
  const rows = (await env.DB.prepare('SELECT owner, trip, state FROM trips').all()).results;
  for (const row of rows) {
    try { await step(env, row.owner, JSON.parse(row.trip), JSON.parse(row.state)); } catch (e) { console.log('trip', row.owner, e && e.message); }
  }
}

const short = (n = '') => n.replace(/,\s*Köln.*$/, '');
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function planTs(trip) {
  let diff = toMin(hhmm(trip.ts)) - toMin(trip.plan);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return Math.floor(trip.ts / 60) * 60 - diff * 60;
}
const t = (s) => s.rt ?? s.plan;

async function step(env, owner, trip, st) {
  const n = now();
  const save = () => env.DB.prepare('UPDATE trips SET state = ?, updated = ? WHERE owner = ?').bind(JSON.stringify(st), n, owner).run();
  if (n - trip.selectedAt > TRIP_TTL) {
    await env.DB.prepare('DELETE FROM trips WHERE owner = ?').bind(owner).run();
    return;
  }
  if (st.done) return;
  const who = (await env.DB.prepare('SELECT name FROM users WHERE email = ?').bind(owner).first())?.name?.split(' ')[0] || owner;
  // Eingeladene, die auch als Kontakt eingetragen sind
  const invited = trip.invite.length
    ? (await env.DB.prepare(`SELECT email FROM contacts WHERE owner = ? AND email IN (${trip.invite.map(() => '?').join(',')})`).bind(owner, ...trip.invite).all()).results.map((r) => r.email)
    : [];

  // 1. Vor der Abfahrt: Countdown in Minuten (Echtzeit aus dem Abfahrtsmonitor)
  if (!st.departed) {
    let dep = st.dep || trip.ts;
    try {
      const d = await departures(env, trip.stopId);
      const e = d.events.find((x) => x.line?.number === trip.line && x.line?.direction === trip.direction && x.departure?.timetable === trip.plan);
      if (e) dep = e.departure.timestamp;
    } catch {}
    st.dep = dep;
    if (n < dep - 20) {
      const min = Math.max(1, Math.round((dep - n) / 60));
      if (trip.countdown && min !== st.lastMin) {
        const late = hhmm(dep) !== trip.plan ? ` (statt ${trip.plan})` : '';
        await pushTo(env, [owner], {
          title: `${trip.line} → ${trip.direction} in ${min} min`,
          body: `ab ${short(trip.stopName)} um ${hhmm(dep)}${late}`,
          tag: 'countdown', silent: true, badge: min, ttl: 60,
        });
        st.lastMin = min;
      }
      await save();
      return;
    }
    st.departed = true;
    if (trip.countdown) await pushTo(env, [owner], { close: 'countdown' });
  }

  // Ohne Ziel: nur „losgefahren“ an die Eingeladenen, dann fertig.
  if (!trip.dest) {
    if (!st.toldDeparture && invited.length) await pushTo(env, invited, { title: `${who} ist losgefahren`, body: `${trip.line} → ${trip.direction} ab ${short(trip.stopName)} um ${hhmm(st.dep)}`, tag: `trip-${owner}` });
    st.toldDeparture = true;
    st.done = true;
    await save();
    return;
  }

  // 2. Unterwegs: Verbindung zum Ziel (Echtzeit an jedem Halt)
  const routes = await route(trip.stopId, trip.dest.id, planTs(trip), false);
  const first = (r) => r.legs.find((l) => l.type === 'ride');
  const r = routes.find((x) => { const l = first(x); return l && l.line === trip.line && l.stops[0]?.id === trip.stopId && hhmm(l.stops[0].plan) === trip.plan; }) || routes[0];
  if (!r) { await save(); return; }
  const rides = r.legs.filter((l) => l.type === 'ride');
  const end = rides.at(-1).stops.at(-1);
  const arr = t(end);
  const dest = short(trip.dest.name);

  if (!st.toldDeparture) {
    if (invited.length) await pushTo(env, invited, { title: `${who} ist losgefahren`, body: `${trip.line} → ${trip.direction}, Ankunft ${dest} um ${hhmm(arr)}`, tag: `trip-${owner}` });
    st.toldDeparture = true;
    st.arrival = arr;
  } else if (st.arrival && Math.abs(arr - st.arrival) >= 180 && n < arr) {
    if (invited.length) await pushTo(env, invited, { title: `${who}: neue Ankunftszeit`, body: `${dest} um ${hhmm(arr)} (${arr > st.arrival ? 'später' : 'früher'} als gemeldet)`, tag: `trip-${owner}` });
    st.arrival = arr;
  }

  // Umstiege
  st.transfers = st.transfers || {};
  for (let i = 0; i < rides.length - 1; i++) {
    const at = rides[i].stops.at(-1), next = rides[i + 1], from = next.stops[0];
    const key = `${at.id}|${i}`;
    if (!st.transfers[key] && n >= t(at) - 60) {
      await pushTo(env, [owner], {
        title: `Umsteigen: ${at.name}`,
        body: `${next.line} → ${next.direction} um ${hhmm(t(from))}${from.platform ? `, Gleis ${from.platform}` : ''}`,
        tag: 'transfer',
      });
      st.transfers[key] = true;
    }
  }

  // Gleich aussteigen
  if (!st.soon && n >= arr - 120 && n < arr) {
    await pushTo(env, [owner], { title: `Gleich aussteigen: ${end.name}`, body: `Ankunft ${hhmm(arr)}`, tag: 'soon' });
    st.soon = true;
  }

  // Angekommen (+ nächste Bahn zurück für mich)
  if (n >= arr) {
    let back = '';
    try {
      const rr = await route(trip.dest.id, trip.stopId, n, false);
      const l = rr.map(first).find((x) => x && t(x.stops[0]) > n);
      if (l) back = `Zurück: ${l.line} → ${l.direction} um ${hhmm(t(l.stops[0]))}${l.stops[0].platform ? `, Gleis ${l.stops[0].platform}` : ''}`;
    } catch {}
    await pushTo(env, [owner], { title: `Angekommen: ${end.name}`, body: back || `Ankunft ${hhmm(arr)}`, tag: 'arrived', url: '?tab=jump' });
    if (invited.length) await pushTo(env, invited, { title: `${who} ist angekommen`, body: `${dest} um ${hhmm(arr)}`, tag: `trip-${owner}` });
    st.arrived = true;
    st.done = true;
  }
  await save();
}

// --- Web Push (VAPID, RFC 8291 aes128gcm) ------------------------------------------------------

async function pushTo(env, emails, msg) {
  if (!emails.length) return 0;
  const subs = (await env.DB.prepare(`SELECT endpoint, p256dh, auth FROM subs WHERE email IN (${emails.map(() => '?').join(',')})`).bind(...emails).all()).results;
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendPush(env, s, JSON.stringify(msg), msg.ttl || 3600);
      if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(s.endpoint).run();
      else if (r.ok) sent++;
      else console.log('push', r.status, await r.text());
    } catch (e) { console.log('push error', e && e.message); }
  }
  return sent;
}

let vapidKey = null;
async function vapidAuth(env, endpoint) {
  if (!vapidKey) vapidKey = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: now() + 12 * 3600, sub: APP })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

const hkdf = async (salt, ikm, info, bytes) => {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
};

export async function encryptPush(p256dh, auth, payload) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

async function sendPush(env, sub, payload, ttl) {
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(env, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'high' },
    body: await encryptPush(sub.p256dh, sub.auth, payload),
  });
}
