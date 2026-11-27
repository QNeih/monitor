export const ACCENTS = [
  { id: 'red', label: 'Rot' },
  { id: 'green', label: 'Grün' },
  { id: 'blue', label: 'Blau' },
  { id: 'purple', label: 'Lila' },
];

export default function Settings({ settings, setSettings }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <section className="page">
      <h1>Einstellungen</h1>

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

      <h2 className="sec">Kontakte</h2>
      <div className="box">
        <p>Mit Google anmelden, Kontakte per E-Mail hinzufügen und sie bei Abfahrt zu deiner Reise einladen. Sie bekommen dann Benachrichtigungen zu deinem Sprung.</p>
        <button type="button" className="primary" disabled>Mit Google anmelden – folgt</button>
      </div>

      <p className="hint small">Daten: VRS-Fahrplanauskunft (inoffiziell, über monitor.qneih.workers.dev). Gespeichert wird nur auf diesem Gerät.</p>
    </section>
  );
}
