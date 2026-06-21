import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generate a new correlation ID (UUID v4)
 */
export const generateCorrelationId = (): string => uuidv4();

/**
 * Extract correlation ID from headers or generate a new one
 */
export const extractOrCreateCorrelationId = (
  headers: Record<string, string | string[] | undefined>
): string => {
  const id = headers[CORRELATION_ID_HEADER];
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  if (Array.isArray(id) && id.length > 0 && id[0].trim().length > 0) return id[0].trim();
  return generateCorrelationId();
};

/**
 * Simple async-local-storage based context for holding correlation IDs
 * without needing full OpenTelemetry baggage (can be upgraded later).
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  service?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getContext = (): RequestContext | undefined => requestContext.getStore();

export const getCorrelationId = (): string =>
  requestContext.getStore()?.correlationId ?? 'no-context';
