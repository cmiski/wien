import { Router, Request, Response } from 'express';
import axios from 'axios';
import { serviceRegistry } from '../registry';
import { getBreakerStats } from '../circuit-breaker';
import {
  asyncHandler,
  gatewayEnvSchema,
  HealthStatus,
  loadConfig,
} from '@api-gateway-ms/shared';

const router = Router();
const startTime = Date.now();
const config = loadConfig(gatewayEnvSchema);

/** Ping a downstream service health endpoint */
const pingService = async (url: string, healthPath: string) => {
  const start = Date.now();
  try {
    await axios.get(`${url}${healthPath}`, { timeout: config.HEALTH_PING_TIMEOUT_MS });
    return { status: HealthStatus.HEALTHY, latency: Date.now() - start };
  } catch {
    return { status: HealthStatus.UNHEALTHY, latency: Date.now() - start };
  }
};

/** GET /health - gateway liveness */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'api-gateway',
    status: HealthStatus.HEALTHY,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/** GET /health/detailed - gateway + all downstream services */
router.get('/health/detailed', asyncHandler(async (_req: Request, res: Response) => {
  const checks = await Promise.all(
    Object.values(serviceRegistry).map(async (svc) => ({
      [svc.name]: await pingService(svc.url, svc.healthPath),
    }))
  );

  const dependencies = Object.assign({}, ...checks) as Record<
    string,
    { status: HealthStatus; latency: number }
  >;
  const allHealthy = Object.values(dependencies).every(
    (d) => d.status === HealthStatus.HEALTHY
  );

  const status = allHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

  res.status(allHealthy ? 200 : 207).json({
    service: 'api-gateway',
    status,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    dependencies,
    circuitBreakers: getBreakerStats(),
  });
}));

export default router;
