import { Request, Response, NextFunction } from 'express';
import {
  createLogger,
  AppError,
  errorResponse,
  serializeError,
  getStatusCode,
} from '@api-gateway-ms/shared';

const logger = createLogger('api-gateway');

/**
 * Central error handler - must be the last middleware registered.
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = getStatusCode(err);
  const serialized = serializeError(err);

  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error', {
      ...serialized,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId,
    });
  } else {
    logger.error('Unexpected error', {
      ...serialized,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId,
    });
  }

  res.status(statusCode).json(errorResponse(serialized));
};

/**
 * 404 handler - catches any unmatched routes.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 'NOT_FOUND', 404));
};
