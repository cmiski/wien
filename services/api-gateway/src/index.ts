import 'dotenv/config';
import app from './app';
import { createLogger } from '@api-gateway-ms/shared';

const logger = createLogger('api-gateway');
const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${String(PORT)}`);
  logger.info(`   Health: http://localhost:${String(PORT)}/health`);
  logger.info(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received - shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});
