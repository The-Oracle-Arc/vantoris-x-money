// Process-local event bus for orchestration telemetry.
// This is intentionally not a durable queue; use a persisted job/event service for workflows.
const listeners = new Map();
const MAX_LISTENERS_PER_EVENT = 100;

export const eventBus = Object.freeze({
  publish(event) {
    if (!event || typeof event.type !== 'string' || !event.type.trim()) {
      throw new TypeError('Event type is required');
    }
    const normalized = Object.freeze({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
    const handlers = [
      ...(listeners.get(normalized.type) || []),
      ...(listeners.get('*') || []),
    ];
    for (const handler of handlers) {
      try {
        const result = handler(normalized);
        if (result && typeof result.then === 'function') {
          result.catch(error => console.error('Event listener failed', error));
        }
      } catch (error) {
        console.error('Event listener failed', error);
      }
    }
    return normalized;
  },
  subscribe(type, handler) {
    if (typeof type !== 'string' || !type.trim() || typeof handler !== 'function') {
      throw new TypeError('A valid event type and handler are required');
    }
    const handlers = listeners.get(type) || new Set();
    if (handlers.size >= MAX_LISTENERS_PER_EVENT) {
      throw new Error('Event listener limit reached');
    }
    handlers.add(handler);
    listeners.set(type, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) listeners.delete(type);
    };
  },
  clear() { listeners.clear(); },
});
