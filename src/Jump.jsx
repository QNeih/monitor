import { useEffect, useState } from 'react';
import { api, countdown, day, hhmm, shortName, useAuth, useNow, usePoll } from './lib.js';
import StopSearch from './StopSearch.jsx';

export const TRIP_TTL = 48 * 3600; // Sprung setzt sich spätestens nach 48 h selbst zurück

const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
// Fahrplanzeit (HH:MM) als Zeitstempel in der Nähe der Echtzeit-Abfahrt.
export function planTs(trip) {
  let diff = toMin(hhmm(trip.ts)) - toMin(trip.plan);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return Math.floor(trip.ts / 60) * 60 - diff * 60;
}
// Suchzeit für Verbindungen: etwas vor Plan/Echtzeit, sonst fehlt die Fahrt, wenn sie früh abfährt.
const searchTs = (trip) => Math.min(planTs(trip), trip.ts) - 300;

// Die Verbindung, die mit der gewählten Fahrt beginnt (gleiche Linie, Haltestelle, Fahrplanzeit).
function match(routes, trip) {
  const first = (r) => r.legs.find((l) => l.type === 'ride');
  return routes.find((r) => {
    const l = first(r);
    return l && l.line === trip.line && l.stops[0]?.id === trip.stopId && hhmm(l.stops[0].plan) === trip.plan;
  }) || null;
}

const t = (s) => s.rt ?? s.plan;

export default function Jump({ trip, setTrip, onHome }) {
  const now = useNow();
  if (!trip) {
    return (
      <section className="page empty">
        <h1>Sprung</h1>
        <p className="hint">Wähle im Haus eine Fahrt aus. Hier siehst du dann ihre Haltestellen, wählst dein Ziel und bekommst bei Ankunft die Bahnen für den Rückweg.</p>
        <button type="button" className="primary" onClick={onHome}>Zu den Abfahrten</button>
      </section>
    );
  }
  const c = countdown(trip.ts, now);
  return (
    <section className="page">
      <div className="tripcard">
        <span className="line">{trip.line}</span>
        <span className="what">
          <span className="dir">{trip.direction}</span>
          <span className="sub">ab {shortName(trip.stopName)} · {hhmm(trip.ts)}{hhmm(trip.ts) !== trip.plan && <s> {trip.plan}</s>}</span>
        </span>
        {!c.past && <span className="count"><small>in</small><b>{c.text}</b><small>{c.unit}</small></span>}
      </div>

      {!trip.dest && <StopSearch label="Ziel auswählen" placeholder="Wohin? (auch mit Umstieg)" onPick={(s) => setTrip({ ...trip, dest: { id: s.id, name: s.name } })} />}

      {trip.dest
        ? <Journey key={trip.dest.id} trip={trip} now={now} onClear={() => setTrip({ ...trip, dest: null })} />
        : <TripStops trip={trip} now={now} onPick={(s) => setTrip({ ...trip, dest: { id: s.id, name: s.name } })} />}

      <Notify trip={trip} setTrip={setTrip} />

      <p className="hint small">Setzt sich automatisch zurück am {day(trip.selectedAt + TRIP_TTL)}, {hhmm(trip.selectedAt + TRIP_TTL)}.</p>
      <button type="button" className="ghost" onClick={() => setTrip(null)}>Sprung beenden</button>
    </section>
  );
}

// Haltestellen der gewählten Fahrt: Verbindung bis zur Endhaltestelle (= Richtung) abfragen.
function TripStops({ trip, now, onPick }) {
  const [leg, setLeg] = useState(null);
  const [err, setErr] = useState('');
  usePoll(async () => {
    try {
      const term = (await api('/stops', { q: trip.direction })).stops[0];
      if (!term) throw new Error('Endhaltestelle unbekannt');
      const d = await api('/route', { from: trip.stopId, to: term.id, t: searchTs(trip) });
      const r = match(d.routes, trip);
      const l = r && r.legs.find((x) => x.type === 'ride');
      if (!l) throw new Error('Fahrt nicht gefunden');
      setLeg(l); setErr('');
    } catch (e) { setErr(e.message); }
  }, [trip.stopId, trip.line, trip.plan], { at: [7], stale: 60 });

  if (err && !leg) return <p className="banner">Haltestellen nicht verfügbar ({err}). Gib dein Ziel oben ein.</p>;
  if (!leg) return <p className="hint pad">Lade Haltestellen …</p>;
  return (
    <>
      <h2 className="sec">Haltestellen – tippe dein Ziel</h2>
      <StopList stops={leg.stops} now={now} onPick={(s, i) => i > 0 && onPick(s)} mark={(i) => (i === 0 ? 'Start' : null)} />
    </>
  );
}

// Haltestellen als Stepper: bereits befahrene oben gestapelt (antippen zum Aufklappen), danach die folgenden.
function StopList({ stops, now, onPick, mark }) {
  const [open, setOpen] = useState(false);
  const passed = (s) => t(s) < now - 30;
  let n = 0;
  while (n < stops.length - 1 && passed(stops[n])) n++; // letzte Haltestelle nie wegklappen
  const row = (s, i) => (
    <StopRow key={s.id + s.plan} s={s} now={now} passed={i < n} mark={mark?.(i)}
      onClick={onPick && i >= n && i > 0 ? () => onPick(s, i) : undefined} />
  );
  return (
    <ol className="stepper">
      {n > 0 && (open
        ? <>{stops.slice(0, n).map(row)}<li className="fold"><button type="button" onClick={() => setOpen(false)}>Gefahrene Haltestellen einklappen</button></li></>
        : (
          <li className="stack">
            <i />{n > 1 && <i />}
            <button type="button" onClick={() => setOpen(true)} aria-expanded="false">
              <span><b>{n}</b> {n === 1 ? 'Haltestelle' : 'Haltestellen'} gefahren · bis {stops[n - 1].name}</span>
            </button>
          </li>
        ))}
      {stops.slice(n).map((s, j) => row(s, n + j))}
    </ol>
  );
}

function StopRow({ s, onClick, mark, passed }) {
  const late = s.rt && hhmm(s.rt) !== hhmm(s.plan);
  const Tag = onClick ? 'button' : 'div';
  return (
    <li className={`step${passed ? ' passed' : ''}${mark ? ' mark' : ''}`}>
      <Tag type={onClick ? 'button' : undefined} className="stoprow" onClick={onClick} disabled={passed || undefined}>
        <span className="tm"><b className={late ? 'late' : s.rt ? 'rt' : ''}>{hhmm(t(s))}</b>{late && <s>{hhmm(s.plan)}</s>}</span>
        <span className="nm">{s.name}{s.platform && <small> · Gleis {s.platform}</small>}</span>
        {mark && <span className="tag">{mark}</span>}
      </Tag>
    </li>
  );
}

function Journey({ trip, now, onClear }) {
  const [route, setRoute] = useState(null);
  const [showLegs, setShowLegs] = useState(false);
  const [err, setErr] = useState('');
  usePoll(() => {
    api('/route', { from: trip.stopId, to: trip.dest.id, t: searchTs(trip) })
      .then((d) => {
        const m = match(d.routes, trip), r = m || d.routes.find((x) => t(x.legs.find((l) => l.type === 'ride').stops[0]) >= trip.ts - 60) || d.routes[0];
        if (!r) throw new Error('keine Verbindung');
        setRoute({ ...r, matched: !!m }); setErr('');
      })
      .catch((e) => setErr(e.message));
  }, [trip.stopId, trip.dest.id, trip.plan], { at: [5, 35] });

  if (err && !route) return <p className="banner">Keine Verbindung gefunden ({err}).</p>;
  if (!route) return <p className="hint pad">Suche Verbindung nach {shortName(trip.dest.name)} …</p>;

  const rides = route.legs.filter((l) => l.type === 'ride');
  const arrival = rides.at(-1).stops.at(-1);
  const arrived = now >= t(arrival);
  return (
    <>
      <div className="dest">
        <span>Ziel <b>{shortName(trip.dest.name)}</b> · {arrived ? 'angekommen' : 'an'} {hhmm(t(arrival))}{rides.length > 1 && ` · ${rides.length - 1}× umsteigen`}</span>
        <button type="button" className="x" onClick={onClear} aria-label="Ziel entfernen">✕</button>
      </div>
      {!route.matched && !arrived && <p className="banner">{shortName(trip.dest.name)} erreichst du nicht mit der gewählten Fahrt ({trip.line} → {trip.direction}, {trip.plan}). Das ist die nächste passende Verbindung.</p>}
      {arrived ? (
        <>
          <h2 className="sec">Zurück nach {shortName(trip.stopName)}</h2>
          {rides.slice().reverse().map((l, i) => <ReturnList key={i} from={l.stops.at(-1)} home={trip.stopId} now={now} arr={t(l.stops.at(-1))} />)}
          <button type="button" className="ghost" onClick={() => setShowLegs((x) => !x)}>{showLegs ? 'Verlauf ausblenden' : 'Verlauf anzeigen'}</button>
          {showLegs && <Legs route={route} rides={rides} now={now} />}
        </>
      ) : <Legs route={route} rides={rides} now={now} />}
    </>
  );
}

function Legs({ route, rides, now }) {
  return route.legs.map((l, i) => l.type === 'walk'
    ? <p key={i} className="walk">Fußweg{l.minutes ? ` ${l.minutes} min` : ''}</p>
    : (
      <div key={i} className="leg">
        <h2 className="sec"><span className="line sm">{l.line}</span> {l.direction}</h2>
        <StopList stops={l.stops} now={now}
          mark={(j) => (j === 0 ? (i === 0 ? 'Start' : 'Einstieg') : j === l.stops.length - 1 ? (l === rides.at(-1) ? 'Ausstieg' : 'Umstieg') : null)} />
      </div>
    ));
}

// Bahnen zurück ab Ausstiegs- und Umstiegshaltestelle (erst nach der Ankunft am Ziel).
function ReturnList({ from, home, now, arr }) {
  const [routes, setRoutes] = useState(null);
  usePoll(() => {
    api('/route', { from: from.id, to: home, t: Math.floor(Math.max(arr, Date.now() / 1000)) })
      .then((d) => setRoutes(d.routes)).catch(() => setRoutes((r) => r || []));
  }, [from.id, home], { at: [10], stale: 60 });
  return <div className="ret"><h3>ab {from.name}</h3><ReturnRows routes={routes} now={now} /></div>;
}

function ReturnRows({ routes, now }) {
  if (!routes) return <p className="hint">Lade Rückfahrten …</p>;
  const list = routes.map((r) => ({ r, l: r.legs.find((x) => x.type === 'ride') })).filter(({ l }) => l && t(l.stops[0]) > now - 20).slice(0, 4);
  if (!list.length) return <p className="hint">Keine Rückfahrt gefunden.</p>;
  return (
    <ul className="cards compact">
      {list.map(({ r, l }, i) => {
        const s = l.stops[0], c = countdown(t(s), now, i === 0), last = r.legs.filter((x) => x.type === 'ride').at(-1).stops.at(-1);
        const late = s.rt && hhmm(s.rt) !== hhmm(s.plan);
        return (
          <li key={i}>
            <div className="card">
              <span className="line">{l.line}</span>
              <span className="what">
                <span className="dir">{l.direction}</span>
                <span className="times"><b className={late ? 'late' : s.rt ? 'rt' : ''}>{hhmm(t(s))}</b>{late && <s>{hhmm(s.plan)}</s>}<small>an {hhmm(t(last))}</small></span>
              </span>
              <span className="count">{!c.past && <small>in</small>}<b>{c.text}</b>{c.unit && <small>{c.unit}</small>}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Benachrichtigungen für diese Reise: Countdown bis zur Abfahrt, Kontakte einladen (nur angemeldet).
function Notify({ trip, setTrip }) {
  const auth = useAuth();
  const [contacts, setContacts] = useState(null);
  useEffect(() => { if (auth) api('/me').then((d) => setContacts(d.contacts)).catch(() => setContacts([])); }, [auth]);
  if (!auth) return <p className="hint small">Für Benachrichtigungen (Countdown, Kontakte) in den Einstellungen mit Google anmelden.</p>;
  const invite = trip.invite || [];
  const toggle = (e) => setTrip({ ...trip, invite: invite.includes(e) ? invite.filter((x) => x !== e) : [...invite, e] });
  return (
    <>
      <h2 className="sec">Benachrichtigungen</h2>
      <div className="box">
        <label className="switch flat">Countdown bis zur Abfahrt
          <input type="checkbox" role="switch" checked={trip.countdown !== false} onChange={(e) => setTrip({ ...trip, countdown: e.target.checked })} />
        </label>
        {contacts?.length > 0 && <p className="hint">Kontakte bekommen Abfahrt, Verspätung und Ankunft:</p>}
        {contacts?.map((c) => (
          <label key={c.email} className="check">
            <input type="checkbox" checked={invite.includes(c.email)} onChange={() => toggle(c.email)} />
            <span>{c.name || c.email}{!c.devices && <small> · noch keine App</small>}</span>
          </label>
        ))}
        {contacts && !contacts.length && <p className="hint">Kontakte fügst du in den Einstellungen hinzu.</p>}
      </div>
    </>
  );
}
