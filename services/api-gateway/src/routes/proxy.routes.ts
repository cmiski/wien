import { NextFunction, Router, Request, Response, RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { getService } from '../registry';
import { getCircuitBreaker } from '../circuit-breaker';
import { createLogger, CORRELATION_ID_HEADER } from '@api-gateway-ms/shared';

const logger = createLogger('api-gateway');

const router = Router();

/** Build a proxy middleware for a given service with circuit breaker wrapping */
const buildProxy = (serviceName: string, basePath: string): RequestHandler => {
  const service = getService(serviceName);
  if (!service) throw new Error(`Unknown service: ${serviceName}`);

  const breaker = getCircuitBreaker(service);

  const proxy = createProxyMiddleware({
    target: service.url,
    changeOrigin: true,
    pathRewrite: (path) => `${basePath}${path}`,
    on: {
      proxyReq: (proxyReq, req: Request) => {
        // Forward correlation ID to downstream
        const corrId = req.correlationId ?? '';
        proxyReq.setHeader(CORRELATION_ID_HEADER, corrId);

        // Forward authenticated user info as headers
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub);
          proxyReq.setHeader('x-user-email', req.user.email);
          proxyReq.setHeader('x-user-role', req.user.role);
        }

        // Fix body for POST/PUT/PATCH after bodyParser
        fixRequestBody(proxyReq, req);
      },
      error: (err, _req, res) => {
        logger.error(`Proxy error for ${serviceName}`, { error: String(err) });
        breaker.fire(() => Promise.reject(err)).catch(() => {
          // breaker recorded the failure
        });
        if (!('headersSent' in res) || !(res as Response).headersSent) {
          (res as Response).status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: `${serviceName} is currently unavailable`,
            },
            timestamp: new Date().toISOString(),
          });
        }
      },
    },
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    void proxy(req, res, next);
  };
};

// User Service Routes
// Public: auth endpoints (with strict rate limiting)
router.use(
  '/api/v1/auth',
  authRateLimiter,
  buildProxy('user-service', '/api/v1/auth')
);

// Protected: user profile routes
router.use(
  '/api/v1/users',
  authenticate,
  buildProxy('user-service', '/api/v1/users')
);

// Event Service Routes
// Public GET, protected POST/PUT/DELETE — handled inside the service
router.use(
  '/api/v1/events',
  optionalAuthenticate,
  buildProxy('event-service', '/api/v1/events')
);

// Notification Service Routes
router.use(
  '/api/v1/notifications',
  authenticate,
  buildProxy('notification-service', '/api/v1/notifications')
);

// Search Service Routes
router.use(
  '/api/v1/search',
  optionalAuthenticate,
  buildProxy('search-service', '/api/v1/search')
);

export default router;
