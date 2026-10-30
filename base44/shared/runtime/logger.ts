const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = (typeof Deno !== 'undefined' && Deno.env?.get?.('AVCU_LOG_LEVEL')) || 'info';
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function write(level, message, metadata = {}) {
  if (LEVELS[level] < threshold) return;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
    ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
  };
  const output = JSON.stringify(record);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = Object.freeze({
  debug: (message, metadata) => write('debug', message, metadata),
  info: (message, metadata) => write('info', message, metadata),
  warn: (message, metadata) => write('warn', message, metadata),
  error: (message, metadata) => write('error', message, metadata),
});

export function createTracer(traceId) {
  return {
    startSpan(name) {
      const startedAt = Date.now();
      const attributes = {};
      let ended = false;
      return {
        setAttribute(key, value) { attributes[String(key)] = value; },
        end() {
          if (ended) return;
          ended = true;
          logger.debug('trace.span.completed', {
            traceId,
            name,
            durationMs: Date.now() - startedAt,
            attributes,
          });
        },
      };
    },
  };
}
