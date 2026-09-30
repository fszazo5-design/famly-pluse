import { dispatchRoute } from '../server/api/dispatch';
import requestOtp from '../server/api/auth/request-otp';
import verifyOtp from '../server/api/auth/verify-otp';

export const config = { runtime: 'edge' };

const handlers = {
    'request-otp': requestOtp,
    'verify-otp': verifyOtp
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
