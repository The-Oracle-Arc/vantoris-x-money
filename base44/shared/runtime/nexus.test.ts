import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { createNexus } from './nexus.ts';

Deno.test('Nexus routes payment requests with specialist guidance and saved context', async () => {
  const services = {
    conversation: {
      getOrCreateThread: async () => ({ id: 'thread-1', memory_summary: 'Member prefers plain English.' }),
      getRecentHistory: async () => [{ sender: 'user', body: 'Earlier question about transfers' }],
    },
  };
  const registries = {
    model: { select: () => ({ name: 'automatic' }) },
    prompt: { getDefault: () => ({ name: 'default_assistant', template: 'Base assistant instructions.' }) },
  };
  const result = await createNexus().orchestrate({
    id: 'request-1', userId: 'member-1', message: 'I need to make a wire transfer',
    capabilities: ['reasoning', 'knowledge', 'payments'], priority: 'normal',
  }, services, registries);

  assertEquals(result.routing.specialist, 'payments');
  assertEquals(result.routing.isActionImpacting, true);
  assertStringIncludes(result.prompt.template, 'Payments specialist');
  assertEquals(result.context.memory, 'Member prefers plain English.');
  assertEquals(result.context.threadId, 'thread-1');
  assertEquals(result.context.history.length, 1);
  assertEquals(result.capabilities.map(item => item.name), ['reasoning', 'knowledge']);
});

Deno.test('Nexus uses general guidance when no specialist route matches', async () => {
  const services = { conversation: { getOrCreateThread: async () => ({ id: 'thread-2' }), getRecentHistory: async () => [] } };
  const registries = { model: { select: () => ({ name: 'automatic' }) }, prompt: { getDefault: () => ({ template: 'Base.' }) } };
  const result = await createNexus().orchestrate({ id: 'request-2', userId: 'member-2', message: 'Hello there' }, services, registries);
  assertEquals(result.routing.specialist, 'general');
  assertEquals(result.routing.isActionImpacting, false);
  assertStringIncludes(result.prompt.template, 'General specialist');
});
