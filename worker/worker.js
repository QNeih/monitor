// Cloudflare Worker für die Monitor-App: liest die offene VRS-Fahrplanauskunft und gibt JSON mit CORS-Freigabe zurück.
// Der Browser darf vrs.de nicht direkt lesen (kein CORS), ein Server schon.
//
//   GET /stops?q=<Text>[&koeln=1]          Haltestellensuche (VRS), optional nur Köln
//   GET /departures?stop=<IFOPT>           nächste Abfahrten einer Haltestelle (VRS-Abfahrtsmonitor der Haltestellenseite)
//   GET /route?from=<IFOPT>&to=<IFOPT>&t=<Unix-Sekunden>[&arr=1]
//                                          Verbindungen mit Zwischenhalten und Echtzeit (aus dem HTML der VRS-Auskunft)
//   GET /?i=<Monitor-ID>                   alt: einer der zwei festen Monitore (für die alte App-Version)
//
// Jede Antwort enthält `now` (Serverzeit in Unix-Sekunden), damit die App eine falsch gehende Handyuhr ausgleicht.
// Nur VRS-Haltestellen-IDs (IFOPT de:<Kreis>:<Nr>) werden angenommen, damit der Worker kein offener Proxy ist.

const LEGACY = new Set(['c7b9e206e5a96d00ddc7b174b3c8b621', '261a26437a2829b18f972a268b25c598']);
const IFOPT = /^de:\d{5}:\d{1,6}$/;
const KOELN = 'de:05315:';
const VRS = 'https://www.vrs.de';
const EKAP = 'https://ekap-web.vrs.de/index.php';
const UA = { 'User-Agent': 'Mozilla/5.0 (Monitor-App)', 'Accept-Language': 'de' };

const CORS = { 'Access-Control-Allow-Origin': '*' };
const now = () => Math.floor(Date.now() / 1000);
const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify({ ...body, now: now() }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
  });

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
    const url = new URL(request.url);
    const q = url.searchParams;
    try {
      switch (url.pathname) {
        case '/stops': return await stops(q.get('q') || '', q.get('koeln') === '1');
        case '/departures': return await departures(q.get('stop') || '', ctx);
        case '/route': return await route(q.get('from') || '', q.get('to') || '', Number(q.get('t')) || now(), q.get('arr') === '1');
        case '/': return await legacy(q.get('i') || '');
        default: return json({ error: 'not found' }, 404);
      }
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 502);
    }
  },
};

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
// Jede VRS-Haltestellenseite (/his/haltestelle/<IFOPT>) bettet einen Abfahrtsmonitor für alle Linien ein.
// Dessen ID wird einmal gelesen und 30 Tage im Cache gehalten.

async function departures(stop, ctx) {
  if (!IFOPT.test(stop)) return json({ error: 'bad stop' }, 400);
  const id = await monitorId(stop, ctx);
  if (!id) return json({ error: 'no departure board for this stop' }, 404);
  const d = await monitor(id);
  return json({ updated: d.updated, events: d.events || [] });
}

async function monitorId(stop, ctx) {
  const key = new Request(`https://monitor-cache/id/${stop}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit.text();
  const r = await fetch(`${VRS}/his/haltestelle/${stop}`, { headers: UA });
  if (!r.ok) return null;
  const m = (await r.text()).match(/\/am\/s\/([0-9a-f]{32})/);
  if (!m) return null;
  ctx.waitUntil(cache.put(key, new Response(m[1], { headers: { 'Cache-Control': 'max-age=2592000' } })));
  return m[1];
}

// --- Verbindungen ------------------------------------------------------------------------------

async function route(from, to, t, arr) {
  if (!IFOPT.test(from) || !IFOPT.test(to)) return json({ error: 'bad stop' }, 400);
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
  return json({ routes: parseRoutes(await r.text(), date) });
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
