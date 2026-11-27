import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home.jsx';
import Jump, { TRIP_TTL } from './Jump.jsx';
import Settings from './Settings.jsx';
import { GearCat, HomeCat, JumpCat } from './icons.jsx';
import { nowS, syncTrip, useStored } from './lib.js';
import './styles.css';

function App() {
  const [tab, setTab] = useStored('tab', 'home');
  const [trip, setTripLocal] = useStored('trip', null);
  const [settings, setSettings] = useStored('settings', { accent: 'green', dark: true, v: 2 });
  // Jede Änderung am Sprung auch an den Worker (Benachrichtigungen), wenn angemeldet.
  const setTripRaw = (next) => setTripLocal((old) => { let n = typeof next === 'function' ? next(old) : next; if (n) n = { ...n, countdown: true }; syncTrip(n); return n; });

  // v2: dunkles Design ist Standard (auch für Geräte, die die alte Voreinstellung gespeichert haben).
  useEffect(() => { if (settings.v !== 2) setSettings((s) => ({ ...s, dark: true, v: 2 })); }, [settings.v, setSettings]);
  // Tab aus einer angetippten Benachrichtigung (?tab=jump oder Nachricht vom Service Worker).
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('tab');
    if (q) { setTab(q); history.replaceState(null, '', location.pathname); }
    const f = (e) => e.data?.tab && setTab(e.data.tab);
    navigator.serviceWorker?.addEventListener('message', f);
    return () => navigator.serviceWorker?.removeEventListener('message', f);
  }, [setTab]);
  const [, force] = useState(0);

  // Sprung nach 48 h verwerfen (auch beim Start, falls die App so lange zu war).
  const expired = trip && nowS() - trip.selectedAt > TRIP_TTL;
  useEffect(() => { if (expired) setTripLocal(null); }, [expired, setTripLocal]);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 60000); return () => clearInterval(i); }, []);

  useEffect(() => {
    const r = document.documentElement;
    r.classList.toggle('dark', !!settings.dark);
    r.dataset.accent = settings.accent || 'green';
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(r).getPropertyValue('--bg').trim();
  }, [settings]);

  const pickTrip = ({ stop, dep }) => {
    setTripRaw({ stopId: stop.id, stopName: stop.name, line: dep.line, direction: dep.direction, platform: dep.platform, plan: dep.plan, ts: dep.ts, selectedAt: Math.floor(nowS()), dest: null, countdown: true, invite: [] });
    setTab('jump');
  };

  const tabs = [
    { id: 'home', label: 'Haltestelle', Icon: HomeCat },
    { id: 'jump', label: 'Sprung', Icon: JumpCat, dot: !!trip && !expired },
    { id: 'settings', label: 'Einstellungen', Icon: GearCat },
  ];
  return (
    <>
      <main>
        {tab === 'home' && <Home onPickTrip={pickTrip} />}
        {tab === 'jump' && <Jump trip={expired ? null : trip} setTrip={setTripRaw} onHome={() => setTab('home')} />}
        {tab === 'settings' && <Settings settings={settings} setSettings={setSettings} />}
      </main>
      <nav className="tabbar">
        {tabs.map(({ id, label, Icon, dot }) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-label={label} aria-current={tab === id ? 'page' : undefined}>
            <span className="ic"><Icon />{dot && <i className="dot" />}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => {});
