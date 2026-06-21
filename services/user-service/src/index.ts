import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import { createLogger } from '@api-gateway-ms/shared';

const logger = createLogger('user-service');
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'user-service', status: 'healthy', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  logger.info(`User Service listening on port ${String(PORT)}`);
});

const shutdown = () => {
  logger.info('Shutting down User Service...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
