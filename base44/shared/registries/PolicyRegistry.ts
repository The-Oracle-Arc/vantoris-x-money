const policies = new Map();

// Default member policy grants only baseline reasoning and knowledge capabilities.
// Privileged capabilities must be registered explicitly with role-scoped policies.
policies.set('default_allow_authenticated', {
  id: 'default_allow_authenticated',
  name: 'Allow Authenticated Member Reasoning',
  effect: 'allow',
  actions: ['reasoning', 'knowledge'],
  resources: ['*'],
  conditions: { authenticated: true },
  priority: 1,
});

// Admin-only actions
policies.set('admin_only_actions', {
  id: 'admin_only_actions',
  name: 'Admin Only Actions',
  effect: 'allow',
  actions: ['audit', 'admin'],
  resources: ['*'],
  conditions: { role: 'admin' },
  priority: 10,
});

export const PolicyRegistry = {
  register(policy) { policies.set(policy.id, policy); },
  get(id) { return policies.get(id); },
  list() { return Array.from(policies.values()).sort((a, b) => b.priority - a.priority); },
  remove(id) { policies.delete(id); },
  getAllowPolicies() { return this.list().filter(p => p.effect === 'allow'); },
  getDenyPolicies() { return this.list().filter(p => p.effect === 'deny'); },
};