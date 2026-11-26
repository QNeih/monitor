// Datenquelle: KVB-Fahrplanauskunft (HAFAS-Webapp), eingebettet als iframe.
// KVB bettet sie selbst so ein (kvb.koeln/qr/<id>/) und bietet dafür einen Widget-Generator.
// Eine offene Abfahrts-API gibt es nicht mehr (transport.rest abgeschaltet, VRS-Abfahrten nur mit Token).
export const BOARD = (name) => `https://auskunft.kvb.koeln/?P=SQ&input=${encodeURIComponent(name)}&start=1`;

// Vorbelegte Haltestellen (Namen wie in der KVB-Auskunft).
export const DEFAULT_STOPS = ['Grünstr.', 'Mülheim Berliner Str.'];

// iframe neu laden, damit die Tafel auch ohne Interaktion aktuell bleibt.
export const RELOAD_MS = 120000;
