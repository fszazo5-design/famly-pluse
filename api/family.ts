import { dispatchRoute } from '../server/api/dispatch';
import completeFamily from '../server/api/family/complete';
import familyGroup from '../server/api/family/group';
import familyMembers from '../server/api/family/members';

export const config = { runtime: 'edge' };

const handlers = {
    'complete': completeFamily,
    'group': familyGroup,
    'members': familyMembers
};

export default function handler(request: Request) {
  return dispatchRoute(request, handlers);
}
