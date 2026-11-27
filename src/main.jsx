import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home.jsx';
import Jump, { TRIP_TTL } from './Jump.jsx';
import Settings from './Settings.jsx';
import { GearCat, HomeCat, JumpCat } from './icons.jsx';
import { nowS, useStored } from './lib.js';
import './styles.css';

function App() {
  const [tab, setTab] = useStored('tab', 'home');
  const [trip, setTripRaw] = useStored('trip', null);
  const [settings, setSettings] = useStored('settings', { accent: 'green', dark: false });
  const [, force] = useState(0);

  // Sprung nach 48 h verwerfen (auch beim Start, falls die App so lange zu war).
  const expired = trip && nowS() - trip.selectedAt > TRIP_TTL;
  useEffect(() => { if (expired) setTripRaw(null); }, [expired, setTripRaw]);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 60000); return () => clearInterval(i); }, []);

  useEffect(() => {
    const r = document.documentElement;
    r.classList.toggle('dark', !!settings.dark);
    r.dataset.accent = settings.accent || 'green';
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(r).getPropertyValue('--bg').trim();
  }, [settings]);

  const pickTrip = ({ stop, dep }) => {
    setTripRaw({ stopId: stop.id, stopName: stop.name, line: dep.line, direction: dep.direction, platform: dep.platform, plan: dep.plan, ts: dep.ts, selectedAt: Math.floor(nowS()), dest: null });
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
