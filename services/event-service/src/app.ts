import 'express-async-errors';
import compression from 'compression';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import {
  asyncHandler,
  errorResponse,
  getStatusCode,
  HealthStatus,
  extractOrCreateCorrelationId,
  generateCorrelationId,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  requestContext,
  serializeError,
  successResponse,
  ValidationError,
} from '@api-gateway-ms/shared';
import { authenticate, optionalAuthenticate } from './auth.middleware';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  registerForEvent,
  unregisterFromEvent,
  updateEvent,
} from './event.service';
import { prisma } from './prisma';
import {
  createEventSchema,
  eventIdParamsSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from './validators';

const app = express();
const startTime = Date.now();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = extractOrCreateCorrelationId(req.headers);
  const requestId = generateCorrelationId();

  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  requestContext.run({ correlationId, requestId }, next);
});

app.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    service: 'event-service',
    status: HealthStatus.HEALTHY,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}));

app.get('/api/v1/events', optionalAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  const parsed = listEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid event query', { issues: parsed.error.flatten() });
  }

  const result = await listEvents(parsed.data, req.user);
  res.json(successResponse(result.items, result.meta));
}));

app.get('/api/v1/events/:id', optionalAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  const params = eventIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('Invalid event id', { issues: params.error.flatten() });
  }

  const event = await getEvent(params.data.id, req.user);
  res.json(successResponse(event));
}));

app.post('/api/v1/events', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid event payload', { issues: parsed.error.flatten() });
  }

  const event = await createEvent(parsed.data, req.user!);
  res.status(201).json(successResponse(event));
}));

app.patch('/api/v1/events/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const params = eventIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('Invalid event id', { issues: params.error.flatten() });
  }

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid event payload', { issues: parsed.error.flatten() });
  }

  const event = await updateEvent(params.data.id, parsed.data, req.user!);
  res.json(successResponse(event));
}));

app.delete('/api/v1/events/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const params = eventIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('Invalid event id', { issues: params.error.flatten() });
  }

  await deleteEvent(params.data.id, req.user!);
  res.status(204).send();
}));

app.post('/api/v1/events/:id/register', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const params = eventIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('Invalid event id', { issues: params.error.flatten() });
  }

  const registration = await registerForEvent(params.data.id, req.user!);
  res.status(201).json(successResponse(registration));
}));

app.delete('/api/v1/events/:id/register', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const params = eventIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('Invalid event id', { issues: params.error.flatten() });
  }

  const registration = await unregisterFromEvent(params.data.id, req.user!);
  res.json(successResponse(registration));
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const serialized = serializeError(err);
  res.status(getStatusCode(err)).json(errorResponse(serialized));
});

export default app;
