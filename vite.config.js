import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': die Seite liegt unter qneih.github.io/monitor/, alle Pfade relativ.
export default defineConfig({ base: './', plugins: [react()] });
