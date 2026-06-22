import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import { createLogger, loadConfig, serviceEnvSchema } from '@api-gateway-ms/shared';

const logger = createLogger('event-service');
const config = loadConfig(serviceEnvSchema);
const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'event-service', status: 'healthy', timestamp: new Date().toISOString() });
});

const server = app.listen(config.PORT, () => {
  logger.info(`Event Service listening on port ${String(config.PORT)}`);
});

const shutdown = () => {
  logger.info('Shutting down Event Service...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
