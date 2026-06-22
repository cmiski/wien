import 'express-async-errors';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import healthRoutes from './routes/health.routes';
import proxyRoutes from './routes/proxy.routes';
import { correlationMiddleware, requestLogger } from './middleware/correlation.middleware';
import { generalRateLimiter } from './middleware/rate-limit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(correlationMiddleware);
app.use(requestLogger);

app.use(healthRoutes);
app.use(generalRateLimiter);
app.use(proxyRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
