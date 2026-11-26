// Datenquelle: VRS-Abfahrtsmonitor (vrs.de/fahrplanauskunft/abfahrtsmonitor), eingebettet als iframe.
// Je Haltestelle ein Monitor, dort gefiltert auf Linie + Richtung und Anzahl Abfahrten.
// Bearbeiten: über den privaten Admin-Link (nicht im Repo). Der Anzeige-Link bleibt dabei gleich.
// Eine offene Abfahrts-API gibt es nicht (transport.rest abgeschaltet, VRS-Abfahrten nur mit Token).
export const DEFAULT_STOPS = [
  {
    name: 'Grünstr.',
    note: '4 → Schlebusch',
    url: 'https://www.vrs.de/am/s/c7b9e206e5a96d00ddc7b174b3c8b621',
  },
  {
    name: 'Mülheim Berliner Str.',
    note: '4 → Bocklemünd',
    url: 'https://www.vrs.de/am/s/261a26437a2829b18f972a268b25c598',
  },
];

// Ohne eigenen VRS-Monitor: ungefilterte KVB-Tafel (nur Stadtbahn, 5 Abfahrten).
export const KVB_BOARD = (name) => `https://auskunft.kvb.koeln/?P=SQ&input=${encodeURIComponent(name)}&products=2&maxJourneys=5&start=1`;

// Die App lädt die Tafel selbst neu (die VRS-Tafel tut es im iframe nicht), immer zu diesen Sekunden jeder Minute:
export const RELOAD_AT = [1, 31];
// Beim Zurückkehren aus dem Hintergrund sofort neu laden, wenn die Tafel älter ist als:
export const STALE_MS = 30000;
