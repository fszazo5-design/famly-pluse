import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { markOtaReady } from '@/lib/ota';
import { initBotId } from 'botid/client/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The native updater rolls back a broken bundle when readiness is not confirmed.
void markOtaReady().catch((error) => {
  console.warn('OTA readiness check failed', error);
});

if (import.meta.env.PROD && Capacitor.getPlatform() === 'web') {
  initBotId({
    protect: [
      {
        path: '/api/auth/request-otp',
        method: 'POST',
        advancedOptions: { checkLevel: 'basic' },
      },
    ],
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
