# Monitor

Minimalistische PWA für Live-Abfahrten im KVB-Netz (Köln). Ein Tab pro Haltestelle, darin die Abfahrtstafel der KVB-Fahrplanauskunft. Vorbelegt: Grünstr. und Mülheim Berliner Str.; mit + weitere hinzufügen, mit × entfernen. Lädt alle 2 min neu.

- Reines HTML/CSS/JS, kein Build.
- Haltestellen liegen im `localStorage` (Standard in `config.js`, `DEFAULT_STOPS`).
- Service Worker cacht nur die App-Shell, nie Abfahrten.
- Datenquelle: KVB-Fahrplanauskunft `auskunft.kvb.koeln` als iframe (`config.js`, `BOARD`), so wie KVB sie selbst auf `kvb.koeln/qr/<id>/` einbettet.
- Warum keine API: `v6.db.transport.rest` ist abgeschaltet (Stand 11/2026), die VRS-Abfahrten (`ekap-web.vrs.de`) verlangen ein Token und senden kein CORS. Die VRS-Haltestellensuche ist offen.

## Deploy

GitHub → Settings → Pages → Source: **GitHub Actions**. Jeder Push auf `main` veröffentlicht die Seite.
