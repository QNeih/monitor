# Monitor

Minimalistische PWA für Live-Abfahrten im KVB-Netz (Köln). Haltestelle suchen, anpinnen, die nächsten 3 Abfahrten sehen. Aktualisiert alle 30 s.

- Reines HTML/CSS/JS, kein Build.
- Pins liegen im `localStorage`.
- Service Worker cacht nur die App-Shell, nie Abfahrten.
- Datenquelle: `config.js` (`API`), standardmäßig `v6.db.transport.rest` (HAFAS, CORS). Fällt sie aus, dort die Basis-URL tauschen.

## Deploy

GitHub → Settings → Pages → Source: **GitHub Actions**. Jeder Push auf `main` veröffentlicht die Seite.
