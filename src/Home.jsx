import { useMemo, useState } from 'react';
import { api, countdown, hhmm, normalize, nowS, shortName, useNow, usePoll, useStored } from './lib.js';
import { Arrow, Chevron, Down, Swap } from './icons.jsx';
import StopSearch from './StopSearch.jsx';

// Haus: eigene Haltestellen (anfangs leer, gespeichert im Gerät), Richtungsumschalter, Abfahrten als Karten.
export default function Home({ onPickTrip }) {
  const [stops, setStops] = useStored('stops', []);
  const [active, setActive] = useStored('activeStop', null);
  const [dirs, setDirs] = useStored('dirs', {}); // Haltestelle → Gleis-Filter ('all' oder 'Gleis 1' …)
  const [sheet, setSheet] = useState(false);
  const stop = stops.find((s) => s.id === active) || stops[0];

  const add = (s) => {
    setStops((l) => (l.some((x) => x.id === s.id) ? l : [...l, { id: s.id, name: s.name }]));
    setActive(s.id);
    setSheet(false);
  };
  const remove = (id) => {
    setStops((l) => l.filter((x) => x.id !== id));
    if (active === id) setActive(null);
  };

  if (!stops.length) {
    return (
      <section className="page">
        <h1>Deine Haltestelle</h1>
        <p className="hint">Einmal einstellen, danach merkt sich die App deine Haltestellen. Weitere kannst du jederzeit hinzufügen.</p>
        <StopSearch koeln autoFocus placeholder="z. B. Neumarkt" onPick={add} />
      </section>
    );
  }

  return (
    <section className="page">
      <Board key={stop.id} stop={stop} filter={dirs[stop.id] || 'all'} setFilter={(f) => setDirs((d) => ({ ...d, [stop.id]: f }))}
        onOpenStops={() => setSheet(true)} onPickTrip={onPickTrip} />
      {sheet && (
        <Sheet title="Haltestellen" onClose={() => setSheet(false)}>
          <ul className="stoplist">
            {stops.map((s) => (
              <li key={s.id} className={s.id === stop.id ? 'on' : ''}>
                <button type="button" className="grow" onClick={() => { setActive(s.id); setSheet(false); }}>{shortName(s.name)}</button>
                <button type="button" className="x" aria-label={`${s.name} entfernen`} onClick={() => confirm(`„${shortName(s.name)}“ entfernen?`) && remove(s.id)}>✕</button>
              </li>
            ))}
          </ul>
          <StopSearch koeln label="Hinzufügen" placeholder="Haltestelle in Köln" onPick={add} />
        </Sheet>
      )}
    </section>
  );
}

function Board({ stop, filter, setFilter, onOpenStops, onPickTrip }) {
  const [deps, setDeps] = useState(null);
  const [okAt, setOkAt] = useState(0);
  const [err, setErr] = useState('');
  const now = useNow();

  usePoll(() => {
    api('/departures', { stop: stop.id })
      .then((d) => { setDeps(normalize(d.events)); setOkAt(nowS()); setErr(''); })
      .catch((e) => setErr(e.message));
  }, [stop.id]);

  // Richtungen = Gleise; Beschriftung = die Ziele, die dort abfahren.
  const options = useMemo(() => {
    const m = new Map();
    for (const d of deps || []) {
      if (!d.platform) continue;
      if (!m.has(d.platform)) m.set(d.platform, new Map());
      const c = m.get(d.platform);
      c.set(d.direction, (c.get(d.direction) || 0) + 1);
    }
    const list = [...m].sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
      .map(([p, c]) => ({ id: p, label: [...c].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => d).join(' / ') }));
    return [{ id: 'all', label: 'Alle Richtungen' }, ...list];
  }, [deps]);
  const cur = options.find((o) => o.id === filter) || (filter === 'all' ? options[0] : { id: filter, label: filter });
  const next = () => {
    const i = options.findIndex((o) => o.id === cur.id);
    setFilter(options[(i + 1) % options.length].id);
  };

  const SHOW = 8; // immer 8 Bahnen, egal ob eine oder alle Richtungen
  const shown = (deps || []).filter((d) => d.ts > now - 20 && (filter === 'all' || d.platform === filter)).slice(0, SHOW);
  const stale = okAt && now - okAt > 90;

  return (
    <>
      <div className="bar">
        <button type="button" className="stopbtn" onClick={onOpenStops}>
          <b>{shortName(stop.name)}</b><Down />
        </button>
        <button type="button" className="dirbtn" onClick={next} disabled={options.length < 2} title="Fahrtrichtung umstellen">
          {cur.id === 'all' ? <Swap /> : <Arrow />}<span>{cur.label}</span>
        </button>
      </div>
      {stale && <p className="banner">Keine aktuellen Daten seit {hhmm(okAt)} – kein Netz?</p>}
      {err && !deps && <p className="banner">Abfahrten nicht erreichbar ({err}).</p>}
      {!deps && !err && <p className="hint pad">Lade Abfahrten …</p>}
      {deps && !shown.length && <p className="hint pad">Keine Abfahrten in dieser Richtung.</p>}
      <ul className="cards">
        {shown.map((d) => <DepartureCard key={d.key} d={d} now={now} seconds={d === shown.find((x) => x.ts > now)} onClick={() => onPickTrip({ stop, dep: d })} />)}
      </ul>
    </>
  );
}

function DepartureCard({ d, now, seconds, onClick }) {
  const c = countdown(d.ts, now, seconds);
  return (
    <li>
      <button type="button" className={`card${c.past ? ' gone' : ''}`} onClick={onClick}>
        <span className="line">{d.line}</span>
        <span className="what">
          <span className="dir">{d.direction}</span>
          <span className="times">
            <b className={d.delayed ? 'late' : d.rt ? 'rt' : ''}>{hhmm(d.ts)}</b>
            {d.delayed && <s>{d.plan}</s>}
            {!d.rt && <small>Fahrplan</small>}
          </span>
        </span>
        <span className="count">{!c.past && <small>in</small>}<b>{c.text}</b>{c.unit && <small>{c.unit}</small>}</span>
        <Chevron className="chev" />
      </button>
    </li>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-head"><h2>{title}</h2><button type="button" className="x" onClick={onClose} aria-label="Schließen">✕</button></div>
        {children}
      </div>
    </div>
  );
}
