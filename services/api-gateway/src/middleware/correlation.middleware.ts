import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createLogger,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  requestContext,
} from '@api-gateway-ms/shared';

const logger = createLogger('api-gateway');

/**
 * Injects / propagates correlation ID from incoming headers.
 * Also runs all subsequent middleware inside AsyncLocalStorage context
 * so correlation ID is available everywhere without explicit threading.
 */
export const correlationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId =
    (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? uuidv4();
  const requestId = uuidv4();

  req.correlationId = correlationId;

  // Forward IDs to downstream services
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, requestId);

  requestContext.run(
    { correlationId, requestId },
    () => next()
  );
};

/**
 * HTTP request logger (replaces morgan for structured logging).
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info';

    logger[level]('HTTP request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  });

  next();
};
