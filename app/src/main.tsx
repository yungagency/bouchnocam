import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker : seulement sur le web (pas dans l'application Capacitor)
const native = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
if ('serviceWorker' in navigator && location.protocol === 'https:' && !native) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
}
