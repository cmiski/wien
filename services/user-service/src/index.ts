import 'dotenv/config';
import app from './app';
import { createLogger } from '@api-gateway-ms/shared';
import { config } from './config';
import { prisma } from './prisma';
import { closePublisher } from './event.publisher';

const logger = createLogger('user-service');

const server = app.listen(config.PORT, () => {
  logger.info(`User Service listening on port ${String(config.PORT)}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received - shutting down User Service`);
  server.close(() => {
    Promise.all([
      prisma.$disconnect(),
      closePublisher(),
    ])
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error('Failed to shut down User Service cleanly', { error: String(err) });
        process.exit(1);
      });
  });
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
