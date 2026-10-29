import { eventBus } from './eventBus.ts';
import { logger } from './logger.ts';

export function createGuardian(registries) {
  // DENY by default — no implicit allow policy
  const DEFAULT_DECISION = { effect: 'deny', reason: 'No matching allow policy found' };

  return {
    async authorize(request) {
      logger.debug('Guardian evaluating request', { requestId: request.id, userId: request.userId });

      // Get policies sorted by priority (highest first)
      const policies = registries.policy.list();

      for (const policy of policies) {
        if (this._matches(policy, request)) {
          const decision = policy.effect === 'allow'
            ? { effect: 'allow', policy: policy.name }
            : { effect: 'deny', reason: `Denied by policy: ${policy.name}` };

          await this._audit(request, decision.effect, policy.name);
          return decision;
        }
      }

      // No matching policy → DENY by default
      await this._audit(request, 'deny', 'default_deny');
      return DEFAULT_DECISION;
    },

    _matches(policy, request) {
      // Check authentication condition
      if (policy.conditions?.authenticated === true && !request.userId) return false;

      // Check role condition
      if (policy.conditions?.role && request.context?.userRole !== policy.conditions.role) return false;

      // Check actions — wildcard matches everything
      if (policy.actions.includes('*')) return true;

      // Check if any requested capability matches the policy actions
      if (request.capabilities && request.capabilities.length) {
        return request.capabilities.some(c => policy.actions.includes(c));
      }

      // No actions specified — matches everything (backward compat)
      return policy.actions.length === 0;
    },

    async _audit(request, decision, policyName) {
      eventBus.publish({
        type: 'security', source: 'guardian',
        payload: {
          requestId: request.id,
          userId: request.userId,
          decision,
          policy: policyName,
        },
      });
    },
  };
}