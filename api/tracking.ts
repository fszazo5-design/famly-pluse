import { dispatchRoute } from '../server/api/dispatch';
import trackingBreadcrumb from '../server/api/tracking/breadcrumb';
import trackingSessions from '../server/api/tracking/sessions';
import startTracking from '../server/api/tracking/start';
import stopTracking from '../server/api/tracking/stop';

export const config = { runtime: 'edge' };

const handlers = {
    'breadcrumb': trackingBreadcrumb,
    'sessions': trackingSessions,
    'start': startTracking,
    'stop': stopTracking
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
