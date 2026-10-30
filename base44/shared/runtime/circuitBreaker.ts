export class CircuitBreaker {
  failureThreshold: number;
  resetTimeoutMs: number;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number | null;

  constructor(opts: { failureThreshold?: number; resetTimeoutMs?: number } = {}) {
    this.failureThreshold = opts.failureThreshold || 5;
    this.resetTimeoutMs = opts.resetTimeoutMs || 30000;
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime ?? 0) > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open — service unavailable');
      }
    }
    try {
      const result = await fn();
      this.failureCount = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.failureThreshold) this.state = 'open';
      throw error;
    }
  }

  getState(): { state: string; failureCount: number; lastFailureTime: number | null } {
    return { state: this.state, failureCount: this.failureCount, lastFailureTime: this.lastFailureTime };
  }
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  policy: { maxRetries?: number; backoffMs?: number; backoffMultiplier?: number; timeout?: number } = {},
): Promise<T> {
  const maxRetries = policy.maxRetries ?? 3;
  const baseDelay = policy.backoffMs ?? 1000;
  const multiplier = policy.backoffMultiplier ?? 2;
  const timeoutMs = policy.timeout ?? 30000;
  let lastError: unknown;

  for (let i = 0; i <= maxRetries; i++) {
    const controller = new AbortController();
    let abortTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          controller.abort();
          reject(new Error('Operation timed out'));
        }, timeoutMs);
      });
      abortTimer = setTimeout(() => controller.abort(), timeoutMs);
      const result = await Promise.race<T>([fn(controller.signal), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(multiplier, i)));
      }
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Operation failed after retries');
}
