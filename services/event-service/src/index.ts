import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import { createLogger } from '@api-gateway-ms/shared';

const logger = createLogger('event-service');
const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'event-service', status: 'healthy', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  logger.info(`Event Service listening on port ${String(PORT)}`);
});

const shutdown = () => {
  logger.info('Shutting down Event Service...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
