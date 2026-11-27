import { useEffect, useRef, useState } from 'react';
import { api, disablePush, enablePush, GOOGLE_CLIENT_ID, pushState, setAuth, useAuth } from './lib.js';

export const ACCENTS = [
  { id: 'red', label: 'Rot' },
  { id: 'green', label: 'Grün' },
  { id: 'blue', label: 'Blau' },
  { id: 'purple', label: 'Lila' },
];

export default function Settings({ settings, setSettings }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const auth = useAuth();
  return (
    <section className="page">
      <div className="head">
        <h1>Einstellungen</h1>
        {auth && (
          <span className="me">
            {auth.user.picture && <img src={auth.user.picture} alt={auth.user.name} title={auth.user.email} referrerPolicy="no-referrer" />}
            <button type="button" className="link" onClick={() => { disablePush().catch(() => {}); setAuth(null); }}>Abmelden</button>
          </span>
        )}
      </div>

      <h2 className="sec">Akzentfarbe</h2>
      <div className="swatches" role="radiogroup" aria-label="Akzentfarbe">
        {ACCENTS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={settings.accent === a.id} data-accent={a.id}
            className={`swatch${settings.accent === a.id ? ' on' : ''}`} onClick={() => set('accent', a.id)}>
            <i /><span>{a.label}</span>
          </button>
        ))}
      </div>

      <h2 className="sec">Darstellung</h2>
      <label className="switch">Dunkles Design
        <input type="checkbox" role="switch" checked={!!settings.dark} onChange={(e) => set('dark', e.target.checked)} />
      </label>

      {auth ? <Account /> : <><h2 className="sec">Konto</h2><GoogleLogin /></>}

      <p className="hint small">Daten: VRS-Fahrplanauskunft (inoffiziell, über monitor.qneih.workers.dev). Haltestellen und Einstellungen liegen nur auf diesem Gerät; Konto, Kontakte und der laufende Sprung beim Worker.</p>
    </section>
  );
}

// Google Identity Services: Knopf rendern, ID-Token beim Worker gegen ein Sitzungstoken tauschen.
function GoogleLogin() {
  const box = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false;
    const init = () => {
      if (dead || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const d = await api('/auth/google', {}, { method: 'POST', body: { credential } });
            setAuth({ token: d.token, user: d.user });
          } catch (e) { setErr(`Anmeldung fehlgeschlagen: ${e.message}`); }
        },
      });
      window.google.accounts.id.renderButton(box.current, { theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'de' });
    };
    if (window.google?.accounts?.id) init();
    else {
      let s = document.getElementById('gsi');
      if (!s) { s = Object.assign(document.createElement('script'), { id: 'gsi', src: 'https://accounts.google.com/gsi/client', async: true }); document.head.append(s); }
      s.addEventListener('load', init);
      s.addEventListener('error', () => setErr('Google-Anmeldung nicht erreichbar.'));
    }
    return () => { dead = true; };
  }, []);
  return (
    <div className="box">
      <p>Mit Google anmelden, um Benachrichtigungen zu bekommen und Kontakte zu deinen Reisen einzuladen. Kontakte melden sich in ihrer App mit derselben E-Mail an.</p>
      <div ref={box} className="gsi" />
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function Account() {
  const [me, setMe] = useState(null);
  const [push, setPush] = useState('…');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api('/me').then(setMe).catch((e) => setMsg(e.message));
  useEffect(() => { load(); pushState().then(setPush); }, []);

  const togglePush = async () => {
    setMsg('');
    try {
      if (push === 'on') await disablePush(); else await enablePush();
      setPush(await pushState());
      load();
    } catch (e) { setMsg(e.message); }
  };
  const add = async (e) => {
    e.preventDefault();
    setMsg('');
    try { setMe(await api('/contacts', {}, { method: 'POST', body: { email } })); setEmail(''); } catch (e2) { setMsg(e2.message === 'bad email' ? 'Ungültige E-Mail.' : e2.message); }
  };
  const remove = async (c) => { if (confirm(`${c.email} entfernen?`)) setMe(await api('/contacts', { email: c.email }, { method: 'DELETE' })); };
  const test = async () => { const d = await api('/push/test', {}, { method: 'POST' }); setMsg(d.sent ? 'Test gesendet.' : 'Kein Gerät angemeldet.'); };

  return (
    <>
      <h2 className="sec">Benachrichtigungen</h2>
      <div className="box">
        <label className="switch flat">Auf diesem Gerät
          <input type="checkbox" role="switch" checked={push === 'on'} disabled={push === 'unsupported' || push === '…'} onChange={togglePush} />
        </label>
        {push === 'denied' && <p className="hint">In den Systemeinstellungen blockiert.</p>}
        {push === 'unsupported' && <p className="hint">Nicht verfügbar. Auf dem iPhone: Teilen → „Zum Home-Bildschirm“, dann aus der installierten App aktivieren.</p>}
        <p className="hint">Countdown bis zur Abfahrt (jede Minute), Umstieg, gleich aussteigen, Ankunft mit Bahn zurück. Kontakte erfahren Abfahrt, Verspätung und Ankunft.</p>
        {push === 'on' && <button type="button" className="ghost" onClick={test}>Test-Benachrichtigung</button>}
      </div>

      <h2 className="sec">Kontakte</h2>
      <ul className="stoplist">
        {(me?.contacts || []).map((c) => (
          <li key={c.email}>
            <span className="grow contact"><b>{c.name || c.email}</b><small>{c.name ? `${c.email} · ` : ''}{c.devices ? 'App eingerichtet' : 'noch nicht angemeldet'}</small></span>
            <button type="button" className="x" aria-label={`${c.email} entfernen`} onClick={() => remove(c)}>✕</button>
          </li>
        ))}
      </ul>
      <form className="addrow" onSubmit={add}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail hinzufügen" autoComplete="email" />
        <button type="submit" className="primary small" disabled={!email}>Hinzufügen</button>
      </form>
      {msg && <p className="hint">{msg}</p>}
    </>
  );
}
