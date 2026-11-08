import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base relative : la même compilation fonctionne sur GitHub Pages (/bouchnocam/)
// et dans l'application Capacitor (Android / iOS).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
});
