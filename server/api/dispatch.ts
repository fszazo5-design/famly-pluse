import { json } from './lib/http';

type ApiHandler = (request: Request) => Response | Promise<Response>;

export function dispatchRoute(
  request: Request,
  handlers: Record<string, ApiHandler>,
): Response | Promise<Response> {
  const action = new URL(request.url).searchParams.get('__api_handler');
  if (!action || !Object.prototype.hasOwnProperty.call(handlers, action)) {
    return json({ error: 'API route not found' }, 404);
  }
  return handlers[action](request);
}
