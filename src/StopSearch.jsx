import { useEffect, useState } from 'react';
import { api } from './lib.js';

// Freitext-Suche nach Haltestellen (VRS). koeln: nur Haltestellen in Köln.
export default function StopSearch({ label, placeholder = 'Haltestelle suchen', koeln = false, onPick, autoFocus }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return; }
    let live = true;
    const t = setTimeout(() => {
      api('/stops', { q, koeln: koeln ? 1 : null })
        .then((d) => { if (live) { setList(d.stops); setErr(d.stops.length ? '' : 'Nichts gefunden.'); } })
        .catch(() => live && setErr('Suche nicht erreichbar.'));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, koeln]);
  return (
    <div className="search">
      <label>
        {label && <span>{label}</span>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off" enterKeyHint="search" />
      </label>
      {list.length > 0 && (
        <ul className="results">
          {list.map((s) => (
            <li key={s.id}><button type="button" onClick={() => { onPick(s); setQ(''); setList([]); }}>{s.name}</button></li>
          ))}
        </ul>
      )}
      {err && q.trim().length >= 2 && !list.length && <p className="hint">{err}</p>}
    </div>
  );
}
