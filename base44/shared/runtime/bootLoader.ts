import { createGuardian } from './guardian.ts';
import { createOracle } from './oracle.ts';
import { createSpark } from './spark.ts';
import { createOrbit } from './orbit.ts';
import { createNexus } from './nexus.ts';
import { ModelRegistry } from '../registries/ModelRegistry.ts';
import { PolicyRegistry } from '../registries/PolicyRegistry.ts';
import { PromptRegistry } from '../registries/PromptRegistry.ts';
import { logger } from './logger.ts';

let bootPromise;

function createServices(base44, request) {
  const authorization = request?.headers?.get?.('authorization') || '';
  const gatewayUrl = Deno.env.get('AVCU_AI_GATEWAY_URL') || '';
  const appUrl = Deno.env.get('AVCU_APP_URL') || '';
  const endpoint = gatewayUrl || (appUrl ? new URL('/.netlify/functions/ask', appUrl).toString() : '');

  return {
    model: {
      async invoke({ prompt, responseJsonSchema }) {
        if (!endpoint) throw new Error('AI gateway endpoint is not configured');
        if (!/^Bearer\s+\S+/i.test(authorization)) throw new Error('Authenticated member session is required');
        const instruction = responseJsonSchema
          ? `Return only valid JSON matching this schema: ${JSON.stringify(responseJsonSchema)}\n\n`
          : '';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { authorization, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ prompt: instruction + prompt }),
          signal: AbortSignal.timeout(25000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || `AI gateway returned HTTP ${response.status}`);
        if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('AI gateway returned an empty response');
        if (responseJsonSchema) {
          try { return JSON.parse(result.text); }
          catch { throw new Error('AI gateway did not return valid structured JSON'); }
        }
        return result.text;
      },
    },
    conversation: {
      async getOrCreateThread(userId, title) {
        const rows = await base44.asServiceRole.entities.AIConversation.filter({ user_id: userId, status: 'active' }, '-updated_date', 1);
        if (rows?.length) return rows[0];
        return base44.asServiceRole.entities.AIConversation.create({ user_id: userId, title, status: 'active' });
      },
      async addMessage(threadId, userId, role, body) {
        return base44.asServiceRole.entities.AIMessage.create({ thread_id: threadId, user_id: userId, role, body: String(body).slice(0, 20000) });
      },
      async getRecentHistory(threadId, limit = 10) {
        return base44.asServiceRole.entities.AIMessage.filter({ thread_id: threadId }, '-created_date', Math.min(20, Math.max(1, limit)));
      },
    },
    metrics: {
      async increment(name, value = 1, dimensions = {}) {
        logger.info('metric.increment', { name, value, dimensions });
      },
    },
    audit: {
      async log(entry) {
        logger.info('audit.event', { ...entry, recordedAt: new Date().toISOString() });
      },
    },
    health: {
      async runAll() {
        return {
          gateway: { status: endpoint ? 'configured' : 'not_configured' },
          conversationStore: { status: 'configured' },
          modelRegistry: { status: 'ok', models: ModelRegistry.list().length },
          promptRegistry: { status: 'ok', prompts: PromptRegistry.list().length },
          policyRegistry: { status: 'ok', policies: PolicyRegistry.list().length },
        };
      },
    },
  };
}

export async function boot(base44, request) {
  if (bootPromise) return bootPromise;
  bootPromise = Promise.resolve().then(() => {
    const services = createServices(base44, request);
    const registries = {
      model: ModelRegistry,
      prompt: PromptRegistry,
      policy: PolicyRegistry,
    };
    const guardian = createGuardian(registries);
    const nexus = createNexus();
    const spark = createSpark();
    const orbit = createOrbit(base44);
    const oracle = createOracle(services, registries, guardian, nexus, spark, orbit);
    const runtime = { oracle, guardian, nexus, spark, orbit };
    const stages = ['services', 'registries', 'guardian', 'nexus', 'spark', 'orbit', 'oracle'];
    logger.info('AVCU Oracle runtime initialized', { stages });
    return { services, runtime, stages };
  }).catch(error => {
    bootPromise = null;
    throw error;
  });
  return bootPromise;
}
