import rateLimit from 'express-rate-limit';
import { RateLimitError } from '@api-gateway-ms/shared';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
const AUTH_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? '900000', 10); // 15 min
const AUTH_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10);

/**
 * General rate limiter - applies to all routes.
 * Uses in-memory store (suitable for single gateway instance;
 * swap to RedisStore for multi-instance horizontal scaling).
 */
export const generalRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID when authenticated, else by IP
    return req.user?.sub ?? req.ip ?? 'unknown';
  },
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
});

/**
 * Strict limiter for auth routes (login, register).
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
  message: 'Too many authentication attempts',
});
