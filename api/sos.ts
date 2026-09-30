import { dispatchRoute } from '../server/api/dispatch';
import activeSos from '../server/api/sos/active';
import resolveSos from '../server/api/sos/resolve';
import triggerSos from '../server/api/sos/trigger';

export const config = { runtime: 'edge' };

const handlers = {
    'active': activeSos,
    'resolve': resolveSos,
    'trigger': triggerSos
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
