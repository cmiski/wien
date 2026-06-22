import rateLimit from 'express-rate-limit';
import { gatewayEnvSchema, loadConfig, RateLimitError } from '@api-gateway-ms/shared';

const config = loadConfig(gatewayEnvSchema);

/**
 * General rate limiter - applies to all routes.
 * Uses in-memory store (suitable for single gateway instance;
 * swap to RedisStore for multi-instance horizontal scaling).
 */
export const generalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
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
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, _res, next) => {
    next(new RateLimitError());
  },
  message: 'Too many authentication attempts',
});
