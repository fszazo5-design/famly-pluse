import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { initBotId } from 'botid/client/core';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
