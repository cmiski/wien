import CircuitBreaker from 'opossum';
import { createLogger, ServiceUnavailableError } from '@api-gateway-ms/shared';

const logger = createLogger('api-gateway');

export interface ServiceConfig {
  name: string;
  url: string;
}

const BREAKER_OPTIONS: CircuitBreaker.Options = {
  timeout: parseInt(process.env.CB_TIMEOUT_MS ?? '5000', 10),
  errorThresholdPercentage: parseInt(process.env.CB_ERROR_THRESHOLD_PERCENT ?? '50', 10),
  resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT_MS ?? '15000', 10),
  volumeThreshold: parseInt(process.env.CB_VOLUME_THRESHOLD ?? '5', 10),
};

const breakers = new Map<string, CircuitBreaker>();

/**
 * Wraps a downstream HTTP call in a circuit breaker per service.
 * If the circuit is open, throws ServiceUnavailableError immediately.
 */
export const getCircuitBreaker = (service: ServiceConfig): CircuitBreaker => {
  if (breakers.has(service.name)) {
    return breakers.get(service.name)!;
  }

  // The "action" is just a passthrough; the proxy middleware does the actual HTTP call.
  // We use the breaker to track failures reported by the proxy error handler.
  const breaker = new CircuitBreaker(
    async (fn: () => Promise<unknown>) => fn(),
    { ...BREAKER_OPTIONS, name: service.name }
  );

  breaker.on('open', () =>
    logger.warn(`Circuit OPEN for service: ${service.name}`)
  );
  breaker.on('halfOpen', () =>
    logger.info(`Circuit HALF-OPEN for service: ${service.name}`)
  );
  breaker.on('close', () =>
    logger.info(`Circuit CLOSED for service: ${service.name}`)
  );
  breaker.fallback(() => {
    throw new ServiceUnavailableError(service.name);
  });

  breakers.set(service.name, breaker);
  return breaker;
};

/**
 * Returns health status of all circuit breakers.
 */
export const getBreakerStats = () => {
  const stats: Record<string, object> = {};
  breakers.forEach((breaker, name) => {
    stats[name] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      stats: breaker.stats,
    };
  });
  return stats;
};
