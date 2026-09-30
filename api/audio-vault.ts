import { dispatchRoute } from '../server/api/dispatch';
import audioVaultLog from '../server/api/audio-vault/log';

export const config = { runtime: 'edge' };

const handlers = {
    'log': audioVaultLog
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
