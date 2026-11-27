# Monitor

PWA für Live-Abfahrten im KVB-Netz (Köln). React + Vite, deployt über GitHub Pages (jeder Push auf `main`).

## Tabs

- **Haltestelle** (Katze mit Dach): eigene Haltestellen in Köln, anfangs leer, im Gerät gespeichert. Daneben der Richtungsumschalter (nach Gleis: Alle → Gleis 1 → Gleis 2 …). Abfahrten als Karten: Echtzeit groß, bei Verspätung die Fahrplanzeit durchgestrichen, Countdown in Minuten und Sekunden. Tippen wählt die Fahrt.
- **Sprung** (springende Katze): Haltestellen der gewählten Fahrt. Ziel antippen oder frei eingeben („Ziel auswählen“, auch mit Umstieg). Bei Ankunft an Umstiegs- und Ausstiegshaltestelle erscheinen die Bahnen zurück zur Starthaltestelle. Setzt sich nach spätestens 48 h selbst zurück.
- **Einstellungen** (Katze mit Zahnrad): Akzentfarbe (Pastell: Rot, Grün, Blau, Lila), dunkles Design (Standard), Google-Login, Benachrichtigungen auf diesem Gerät, Kontakte per E-Mail.

## Benachrichtigungen

Web Push vom Worker (Cron jede Minute), für angemeldete Nutzer mit aktivierten Benachrichtigungen:

- an mich: Countdown bis zur Abfahrt (jede Minute still ersetzt, Zahl auch als App-Badge), Umsteigen, gleich aussteigen (2 min vorher), angekommen mit der nächsten Bahn zurück;
- an eingeladene Kontakte (im Sprung angehakt, müssen die App installiert und sich mit derselben E-Mail angemeldet haben): losgefahren, neue Ankunftszeit (ab 3 min Abweichung), angekommen.

iPhone: nur als installierte App (Zum Home-Bildschirm, ab iOS 16.4).

## Daten

Alles über den Cloudflare Worker `https://monitor.qneih.workers.dev` (Quelle: `worker/worker.js`), der die offene, aber undokumentierte VRS-Fahrplanauskunft liest und mit CORS weitergibt:

| Endpunkt | Quelle |
| --- | --- |
| `/stops?q=…&koeln=1` | VRS-Haltestellensuche (`ekap-web.vrs.de`, `tx_vrsinfo_ass2_objects`) |
| `/departures?stop=<IFOPT>` | eigener VRS-Abfahrtsmonitor je Haltestelle, beim ersten Abruf angelegt (alle Linien, 50 Abfahrten = VRS-Maximum), ID in D1 |
| `/route?from=&to=&t=` | HTML der VRS-Verbindungsauskunft mit Zwischenhalten und Echtzeit, im Worker zu JSON geparst |
| `/?i=<ID>` | alt: die zwei festen Monitore der Vorversion |
| `/auth/google`, `/me`, `/contacts`, `/push`, `/trip` | Konto (Google-ID-Token → Sitzungstoken), Kontakte, Push-Abos, laufender Sprung; D1-Datenbank `monitor` |
| `/contacts/accept`, `/contacts/decline`, `/contacts/act` | Kontaktanfragen beantworten (in der App oder per Knopf in der Benachrichtigung). Kontakte gelten erst, wenn beide Seiten bestätigt haben |
| `POST /tick` | Cron-Schritt sofort ausführen (Test) |

Jede Antwort enthält `now` (Serverzeit), damit die App eine falsch gehende Handyuhr ausgleicht. Der Worker nimmt nur VRS-Haltestellen-IDs an (kein offener Proxy).

Bekannte Eigenheiten: VRS liefert abwechselnd zwei leicht verschiedene Datenstände; die App lässt eine einmal gesehene Echtzeit nicht wieder verschwinden. Ändert VRS sein HTML, bricht `/route` (Parser in `parseRoutes`).

Worker deployen: `worker/worker.js` als Modul-Worker `monitor` hochladen (Cloudflare-Dashboard, Wrangler oder API). Bindings: `DB` (D1 `monitor`), `VAPID_PUBLIC`, `GOOGLE_CLIENT_ID` (Klartext), `VAPID_PRIVATE`, `SESSION_SECRET` (Secrets); Cron `* * * * *`.

## Entwicklung

```
npm install
npm run dev      # http://localhost:5173
npm run build    # nach dist/
```

Service Worker (`public/sw.js`): immer zuerst Netz, Cache nur offline; Abfahrten nie.
