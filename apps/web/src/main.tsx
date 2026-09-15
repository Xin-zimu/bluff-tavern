import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js');
      return;
    }

    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if (!('caches' in window)) return undefined;
        return caches.keys().then((keys) => Promise.all(keys
          .filter((key) => key.startsWith('bluff-tavern-'))
          .map((key) => caches.delete(key))));
      })
      .catch(() => undefined);
  });
}

setupServiceWorker();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
