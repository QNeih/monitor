// Einzige Stelle, die von der Datenquelle abhängt.
// HAFAS-REST (transport.rest) mit CORS. Bei Ausfall hier die Basis-URL tauschen
// oder eigenen Proxy eintragen (z. B. Cloudflare Worker).
export const API = 'https://v6.db.transport.rest';
export const REFRESH_MS = 30000;
export const DEPARTURES = 3;
