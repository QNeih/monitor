// Eigene Katzen-Icons (24×24, currentColor). Augen und Abstände sind ausgestanzt (Maske), damit sie auf jedem Hintergrund passen.

const head = 'M4 22v-5.6c0-1.6.6-3 1.6-4L5.1 8.6l3.4 2.3a12 12 0 0 1 7 0l3.4-2.3-.5 3.8c1 1 1.6 2.4 1.6 4V22z';

// Katze lugt unter einem Chevron-Dach hervor (Haus = eigene Haltestelle).
export function HomeCat(p) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...p}>
      <mask id="mh"><rect width="24" height="24" fill="#fff" /><circle cx="9.4" cy="17.2" r="1.45" fill="#000" /><circle cx="14.6" cy="17.2" r="1.45" fill="#000" /><path d="M11.3 20.2h1.4l-.7.7z" fill="#000" /></mask>
      <path d={head} fill="currentColor" mask="url(#mh)" />
      <path d="M2.5 9 12 2.6 21.5 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Springende Katze (Sprung = laufende Fahrt).
export function JumpCat(p) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...p}>
      <g fill="currentColor">
        <path d="M5.2 15.4c1.5-3.8 5.6-6.2 9.8-5.9l1.4.2-1.2 3.6c-2.6.1-4.6 1.3-6.1 3.4z" />
        <circle cx="17.6" cy="8.6" r="2.7" />
        <path d="m15.6 7 .1-3.1 2.1 2zM18.6 6.2l2.1-1.9.1 2.9z" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M15.2 12.6 20.6 15M13.4 12.9l4.2 3.8M7.4 15.6 2.6 19M8.6 16.6l-2.4 4.6M5.4 15.2C3.2 14.4 2.4 11.6 3.6 9.4" />
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
      <path d="M2.6 22v-5.4c0-1.5.6-2.8 1.5-3.8L3.6 9.2l3.3 2.2a11 11 0 0 1 6.6 0l3.3-2.2-.5 3.6c.9 1 1.5 2.3 1.5 3.8V22z" fill="currentColor" mask="url(#mg)" />
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
