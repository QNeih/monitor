// Datenquelle: VRS-Abfahrtsmonitor (vrs.de/fahrplanauskunft/abfahrtsmonitor), eingebettet als iframe.
// Je Haltestelle ein Monitor, dort gefiltert auf Linie + Richtung und Anzahl Abfahrten.
// Bearbeiten: Admin-Link öffnen, Änderungen speichern sich sofort, der Anzeige-Link bleibt gleich.
// Eine offene Abfahrts-API gibt es nicht (transport.rest abgeschaltet, VRS-Abfahrten nur mit Token).
export const DEFAULT_STOPS = [
  {
    name: 'Grünstr.',
    note: '4 → Schlebusch',
    url: 'https://www.vrs.de/am/s/9865a3a3afc66021c2e8f1d4b080927a',
    admin: 'https://www.vrs.de/am/admin/593dc3b32e0522889a0d4c39a51fa2ae',
  },
  {
    name: 'Mülheim Berliner Str.',
    note: '4 → Bocklemünd',
    url: 'https://www.vrs.de/am/s/7a69ed2351848f55a167481f6bb37076',
    admin: 'https://www.vrs.de/am/admin/4b6dcb90a119803c40dd989e0cc94ec6',
  },
];

// Ohne eigenen VRS-Monitor: ungefilterte KVB-Tafel (nur Stadtbahn, 5 Abfahrten).
export const KVB_BOARD = (name) => `https://auskunft.kvb.koeln/?P=SQ&input=${encodeURIComponent(name)}&products=2&maxJourneys=5&start=1`;

// Die Monitore aktualisieren sich selbst (60 s). Nach so langer Zeit im Hintergrund beim Zurückkehren neu laden:
export const STALE_MS = 60000;
