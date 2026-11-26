// Cloudflare Worker: holt die Abfahrten eines VRS-Abfahrtsmonitors und gibt sie mit CORS-Freigabe an die App weiter.
// Der Browser darf vrs.de nicht direkt lesen (kein CORS), ein Server schon.
// Aufruf: GET https://monitor.<subdomain>.workers.dev/?i=<VRS-Monitor-ID>
// Nur die hier eingetragenen Monitore, damit der Worker kein offener Proxy ist.
const ALLOWED = new Set([
  'c7b9e206e5a96d00ddc7b174b3c8b621', // Grünstr., 4 → Schlebusch
  '261a26437a2829b18f972a268b25c598', // Mülheim Berliner Str., 4 → Bocklemünd
]);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
    const id = new URL(request.url).searchParams.get('i') || '';
    if (!ALLOWED.has(id)) return json({ error: 'unknown monitor' }, 404);
    const r = await fetch(`https://www.vrs.de/index.php?eID=tx_vrsinfo_departuremonitor&i=${id}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return json({ error: `vrs ${r.status}` }, 502);
    const data = await r.json();
    // Serverzeit mitgeben, damit die App eine falsch gehende Handyuhr ausgleichen kann.
    return json({ ...data, now: Math.floor(Date.now() / 1000) });
  },
};
