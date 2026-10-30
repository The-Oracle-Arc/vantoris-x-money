import { eventBus } from './eventBus.ts';
import { logger } from './logger.ts';
import { CircuitBreaker, withRetry } from './circuitBreaker.ts';

export function createOrbit(base44) {
  const breakers = new Map();

  return {
    async schedule(job) {
      logger.debug('Orbit scheduling job', { job: job.name });

      const record = await base44.asServiceRole.entities.ScheduledJob.create({
        name: job.name,
        schedule: job.schedule || 'immediate',
        status: 'pending',
        retry_policy: JSON.stringify(job.retryPolicy || { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2, timeout: 30000 }),
        payload: JSON.stringify(job.payload || {}),
      });

      eventBus.publish({
        type: 'workflow', source: 'orbit',
        payload: { jobId: record.id, name: job.name, status: 'pending' },
      });

      // Execute immediately if no delay
      if (!job.schedule || job.schedule === 'immediate') {
        await this.execute(record.id, job);
      }

      return record;
    },

    async execute(jobId, job) {
      await base44.asServiceRole.entities.ScheduledJob.update(jobId, {
        status: 'running',
        last_run: new Date().toISOString(),
      });

      const breaker = this._getBreaker(job.name);
      const policy = job.retryPolicy || { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2, timeout: 30000 };

      try {
        const result = await breaker.execute(() =>
          withRetry(() => job.handler(), policy)
        );

        await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'completed' });

        eventBus.publish({
          type: 'workflow', source: 'orbit',
          payload: { jobId, status: 'completed' },
        });

        return result;
      } catch (error) {
        await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'failed' });

        eventBus.publish({
          type: 'monitoring', source: 'orbit',
          payload: { jobId, error: error.message },
        });

        throw error;
      }
    },

    async pause(jobId) {
      await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'paused' });
      eventBus.publish({ type: 'workflow', source: 'orbit', payload: { jobId, status: 'paused' } });
    },

    async resume(jobId) {
      await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'pending' });
      eventBus.publish({ type: 'workflow', source: 'orbit', payload: { jobId, status: 'resumed' } });
    },

    async cancel(jobId) {
      await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'cancelled' });
      eventBus.publish({ type: 'workflow', source: 'orbit', payload: { jobId, status: 'cancelled' } });
    },

    async recover(jobId, job) {
      logger.info('Orbit recovering job', { jobId });
      await base44.asServiceRole.entities.ScheduledJob.update(jobId, { status: 'pending' });
      return await this.execute(jobId, job);
    },

    async list(filter = {}) {
      return await base44.asServiceRole.entities.ScheduledJob.filter(filter, '-created_date', 100);
    },

    _getBreaker(name) {
      if (!breakers.has(name)) {
        breakers.set(name, new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 }));
      }
      return breakers.get(name);
    },
  };
}