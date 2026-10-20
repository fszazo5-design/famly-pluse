import { StrictMode } from 'react';
import { markOtaReady } from '@/lib/ota';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The native updater rolls back a broken bundle when readiness is not confirmed.
void markOtaReady().catch((error) => {
  console.warn('OTA readiness check failed', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
