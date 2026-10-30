import { logger } from './logger.ts';

const ROUTES = [
  { specialist: 'fraud', terms: /fraud|scam|unauthori[sz]ed|stolen|phishing|suspicious/i, action: false },
  { specialist: 'compliance', terms: /regulat|compliance|policy|sanction|aml|suspicious activity|kyc/i, action: true },
  { specialist: 'payments', terms: /wire|transfer|payment|send money|ach|deposit|withdraw/i, action: true },
  { specialist: 'credit', terms: /loan|credit|borrow|apr|interest rate/i, action: true },
  { specialist: 'investment', terms: /invest|portfolio|stock|bond|yield|dividend/i, action: false },
  { specialist: 'documents', terms: /statement|document|letter|form|receipt|tax form/i, action: false },
  { specialist: 'banking', terms: /account|balance|card|branch|routing number|checking|savings/i, action: false },
];

export function createNexus() {
  return {
    async orchestrate(request, services, registries) {
      const message = String(request.message || '');
      const route = ROUTES.find(item => item.terms.test(message)) || { specialist: 'general', action: false };
      const isActionImpacting = Boolean(route.action);
      const model = registries.model.select(request.priority || 'normal');
      const prompt = registries.prompt.getDefault();
      let history = [];
      let memory = null;
      try {
        const thread = await services.conversation.getOrCreateThread(request.userId, 'AVCU Assistant');
        history = await services.conversation.getRecentHistory(thread.id, 10);
      } catch (error) {
        logger.warn('Conversation context unavailable', { requestId: request.id, error: error.message });
      }
      const capabilities = (request.capabilities || []).filter(name => ['reasoning', 'knowledge'].includes(name));
      logger.info('Nexus resolved request', { requestId: request.id, specialist: route.specialist, isActionImpacting });
      return {
        requiresReasoning: true,
        model,
        prompt,
        routing: {
          specialist: route.specialist,
          confidence: route.specialist === 'general' ? 'low' : 'medium',
          isActionImpacting,
          collaborators: [],
        },
        capabilities: capabilities.map(name => ({ name })),
        context: { history: Array.isArray(history) ? history.reverse() : [], memory, knowledge: [] },
        deferredJobs: [],
        escalate: route.specialist === 'fraud' || (isActionImpacting && route.specialist === 'compliance'),
      };
    },
  };
}
