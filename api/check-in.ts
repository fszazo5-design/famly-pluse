import { dispatchRoute } from '../server/api/dispatch';
import activeCheckIn from '../server/api/check-in/active';
import confirmCheckIn from '../server/api/check-in/confirm';
import createCheckIn from '../server/api/check-in/create';

export const config = { runtime: 'edge' };

const handlers = {
    'active': activeCheckIn,
    'confirm': confirmCheckIn,
    'create': createCheckIn
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
