import { ApiResponse, ApiError, ResponseMeta } from '../types';
import { getCorrelationId } from './correlation';

// ─── Custom Error Classes ──────────────────────────────────────

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(msg, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`Service '${service}' is unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests, please try again later', 'RATE_LIMIT_EXCEEDED', 429);
  }
}

// ─── Response Helpers ─────────────────────────────────────────

export const successResponse = <T>(
  data: T,
  meta?: ResponseMeta
): ApiResponse<T> => ({
  success: true,
  data,
  meta,
  traceId: getCorrelationId(),
  timestamp: new Date().toISOString(),
});

export const errorResponse = (
  error: ApiError
): ApiResponse<never> => ({
  success: false,
  error,
  traceId: getCorrelationId(),
  timestamp: new Date().toISOString(),
});

// ─── Error Serializer ─────────────────────────────────────────

export const serializeError = (err: unknown): ApiError => {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      details: err.details,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };
  }

  if (err instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
};

export const getStatusCode = (err: unknown): number => {
  if (err instanceof AppError) return err.statusCode;
  return 500;
};
