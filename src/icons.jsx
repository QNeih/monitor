// Eigene Katzen-Icons (24×24, currentColor). Augen und Abstände sind ausgestanzt (Maske), damit sie auf jedem Hintergrund passen.

const head = 'M3.6 22v-5.4c0-1.7.6-3.1 1.6-4.2L3.8 8.2l6.4 2.9a10 10 0 0 1 3.6 0l6.4-2.9-1.4 4.2c1 1.1 1.6 2.5 1.6 4.2V22z';

// Katze lugt unter einem Chevron-Dach hervor (Haus = eigene Haltestelle).
export function HomeCat(p) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...p}>
      <mask id="mh"><rect width="24" height="24" fill="#fff" /><circle cx="9.4" cy="17.2" r="1.45" fill="#000" /><circle cx="14.6" cy="17.2" r="1.45" fill="#000" /><path d="M11.3 20.2h1.4l-.7.7z" fill="#000" /></mask>
      <path d={head} fill="currentColor" mask="url(#mh)" />
      <path d="M2.5 7.4 12 1.4l9.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Springende Katze (Sprung = laufende Fahrt): derselbe Kopf wie die anderen, Körper im Sprung.
export function JumpCat(p) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...p}>
      <mask id="mj"><rect width="24" height="24" fill="#fff" /><circle cx="9.4" cy="16.4" r="1.7" fill="#000" /><circle cx="14.6" cy="16.4" r="1.7" fill="#000" /></mask>
      <path d="M3.6 16.6c0-1.7.6-3.1 1.6-4.2L3.8 8.2l6.4 2.9a10 10 0 0 1 3.6 0l6.4-2.9-1.4 4.2c1 1.1 1.6 2.5 1.6 4.2 0 3.4-3.8 5.6-8.4 5.6s-8.4-2.2-8.4-5.6z" fill="currentColor" mask="url(#mj)" transform="translate(12.4 -2.8) scale(.55)" />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M17 10.2C13.4 10.4 9.6 11.8 7 15" strokeWidth="4.4" />
        <path d="M16.2 10.8 21.2 13.4M14 11.6l3.4 4.4M6.8 15.6 2.6 19.6M8.6 15.4 6.6 21M6 14.2C3.6 13.2 3 10.4 4.4 8.4" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

// Katze mit Zahnrad (Einstellungen).
export function GearCat(p) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...p}>
      <mask id="mg">
        <rect width="24" height="24" fill="#fff" />
        <circle cx="8.6" cy="16.4" r="1.35" fill="#000" /><circle cx="13" cy="16.4" r="1.35" fill="#000" />
        <circle cx="18.2" cy="18.2" r="5.6" fill="#000" />
      </mask>
      <path d="M2.4 22v-5.2c0-1.6.6-2.9 1.5-3.9L2.6 8.4l5.8 2.7a9.6 9.6 0 0 1 3.6 0l5.8-2.7-1.3 4.5c.9 1 1.5 2.3 1.5 3.9V22z" fill="currentColor" mask="url(#mg)" />
      <circle cx="18.2" cy="18.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeDasharray="1.7 1.1" />
      <circle cx="18.2" cy="18.2" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export const Chevron = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const Swap = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
);
export const Down = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const Arrow = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
// Gebogener Pfeil zurück (Rückgängig).
export const Undo = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);
