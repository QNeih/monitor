# Monitor

Minimalistische PWA für Live-Abfahrten im KVB-Netz (Köln). Ein Tab pro Haltestelle, darin ein VRS-Abfahrtsmonitor, gefiltert auf Linie und Richtung. Vorbelegt: Grünstr. (4 → Schlebusch) und Mülheim Berliner Str. (4 → Bocklemünd), je 4 Abfahrten. Mit + weitere hinzufügen (VRS-Monitor-Link oder ungefilterte KVB-Tafel), mit × entfernen.

- Reines HTML/CSS/JS, kein Build.
- Haltestellen liegen im `localStorage` (Standard in `config.js`, `DEFAULT_STOPS`).
- Filter ändern (Richtung, Anzahl, Farben): privaten Admin-Link des Monitors öffnen (bewusst nicht im Repo); der Anzeige-Link bleibt gleich. Neuer Monitor: vrs.de/fahrplanauskunft/abfahrtsmonitor.
- Service Worker cacht nur die App-Shell, nie Abfahrten.
- Datenquelle: VRS-Abfahrtsmonitor (`vrs.de/am/s/<id>`) als iframe, von der App zu jeder Minute :01 und :31 neu geladen (die Tafel selbst tut es im iframe nicht: ihr Skript bricht beim Zugriff auf `window.parent` ab). Fallback ohne Monitor: KVB-Fahrplanauskunft `auskunft.kvb.koeln` (nur Stadtbahn, 5 Abfahrten, kein Richtungsfilter).
- Warum keine API: `v6.db.transport.rest` ist abgeschaltet (Stand 11/2026), die VRS-Abfahrten (`ekap-web.vrs.de`) verlangen ein Token und senden kein CORS. Die VRS-Haltestellensuche ist offen.

## Deploy

GitHub → Settings → Pages → Source: **GitHub Actions**. Jeder Push auf `main` veröffentlicht die Seite.

## Worker (Datenquelle für die eigene Anzeige)

`worker/worker.js` läuft als Cloudflare Worker `monitor` unter `https://monitor.qneih.workers.dev/?i=<VRS-Monitor-ID>`. Er holt die VRS-Abfahrten (`vrs.de/index.php?eID=tx_vrsinfo_departuremonitor&i=<id>`, offen, aber ohne CORS) und gibt sie mit CORS-Freigabe weiter. Nur die IDs in `ALLOWED`. Neue Haltestelle: ID dort eintragen und neu veröffentlichen.
