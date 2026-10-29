import { eventBus } from './eventBus.ts';
import { logger } from './logger.ts';
import { CircuitBreaker, withRetry } from './circuitBreaker.ts';

export function createSpark() {
  const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000 });

  return {
    async reason(request, orchestration, services) {
      logger.debug('Spark reasoning', { requestId: request.id });

      const model = orchestration.model?.name || 'automatic';
      const promptTemplate = orchestration.prompt?.template || 'You are a helpful assistant.';
      const routing = orchestration.routing;
      const isActionImpacting = routing?.isActionImpacting || false;

      // Build context from platform services (Spark does NOT own these)
      const memory = orchestration.context?.memory;
      const history = orchestration.context?.history || [];

      const systemPrompt = this._buildSystemPrompt(promptTemplate, memory, history);

      // If action-impacting, request structured recommendation output
      let responseSchema = null;
      let fullPrompt = `${systemPrompt}\n\nMember: ${request.message}`;

      if (isActionImpacting) {
        responseSchema = {
          type: 'object',
          properties: {
            response: { type: 'string', description: 'The conversational response to show the member' },
            recommendation: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Concise summary of the recommendation' },
                supporting_evidence: { type: 'string', description: 'Data and evidence supporting the recommendation' },
                confidence_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                potential_risks: { type: 'string', description: 'Identified risks and mitigations' },
                applicable_policies: { type: 'string', description: 'Relevant platform policies and procedures' },
                recommended_action: { type: 'string', description: 'Specific next action recommended' },
                is_escalation: { type: 'boolean', description: 'Whether this should be escalated to staff' },
                escalation_reason: { type: 'string', description: 'Reason for escalation if applicable' },
              },
            },
          },
          required: ['response'],
        };
        fullPrompt = `${systemPrompt}\n\nMember: ${request.message}\n\nThis request requires staff approval before any action is taken. Prepare a structured recommendation with summary, supporting evidence, confidence level, potential risks, applicable policies, recommended action, and whether escalation is needed. Provide a conversational response for the member that acknowledges their request without executing any action.`;
      }

      eventBus.publish({
        type: 'request', source: 'spark', target: 'modelService',
        payload: { requestId: request.id, model, structured: isActionImpacting },
      });

      try {
        const result = await breaker.execute(() =>
          withRetry(() => services.model.invoke({
            prompt: fullPrompt,
            model,
            responseJsonSchema: responseSchema || undefined,
          }), { maxRetries: 2, backoffMs: 2000, timeout: 60000 })
        );

        eventBus.publish({
          type: 'response', source: 'spark', target: 'oracle',
          payload: { requestId: request.id, model, structured: isActionImpacting },
        });

        // Handle structured recommendation response
        let content = '';
        let recommendation = null;

        if (typeof result === 'object' && result !== null) {
          content = result.response || result.content || JSON.stringify(result);
          recommendation = result.recommendation || null;
        } else {
          content = typeof result === 'string' ? result : String(result);
        }

        return {
          content,
          recommendation,
          routing,
          sources: orchestration.context?.knowledge || [],
          metadata: { model, specialist: routing?.specialist, structured: isActionImpacting },
        };
      } catch (error) {
        logger.error('Spark reasoning failed', { requestId: request.id, error: error.message });
        return {
          content: 'I apologize, but I encountered an issue processing your request. Please try again.',
          metadata: { error: error.message, model },
        };
      }
    },

    _buildSystemPrompt(template, memory, history) {
      let prompt = template;
      if (memory) {
        prompt += `\n\nUser preferences: ${JSON.stringify(memory)}`;
      }
      if (history && history.length > 0) {
        const recent = history.slice(-5).map(h => `${h.sender}: ${h.body}`).join('\n');
        prompt += `\n\nRecent conversation:\n${recent}`;
      }
      return prompt;
    },
  };
}