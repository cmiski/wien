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
  NotFoundError,
  paginationSchema,
} from '@api-gateway-ms/shared';
import { authenticate } from './auth.middleware';
import { prisma } from './prisma';
import { z } from 'zod';
import { Prisma } from '@api-gateway-ms/notification-prisma-client';

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
    service: 'notification-service',
    status: HealthStatus.HEALTHY,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}));

const querySchema = paginationSchema.extend({
  isRead: z.enum(['true', 'false']).optional(),
});

app.get('/api/v1/notifications', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid notification query', { issues: parsed.error.flatten() });
  }

  const { page, limit, isRead } = parsed.data;
  const filterIsRead = isRead === 'true' ? true : isRead === 'false' ? false : undefined;

  const where: Prisma.NotificationWhereInput = {
    userId: req.user!.sub,
  };
  if (filterIsRead !== undefined) {
    where.isRead = filterIsRead;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  res.json(
    successResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
}));

app.patch('/api/v1/notifications/read-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user!.sub,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  res.json(successResponse({ message: 'All notifications marked as read' }));
}));

app.patch('/api/v1/notifications/:id/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = z.string().uuid('Invalid UUID format').safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError('Invalid notification ID', { issues: parsedId.error.flatten() });
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new NotFoundError('Notification', id);
  }

  if (notification.userId !== req.user!.sub) {
    throw new NotFoundError('Notification', id); // Hide existence for unauthorized users
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  res.json(successResponse(updated));
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const serialized = serializeError(err);
  res.status(getStatusCode(err)).json(errorResponse(serialized));
});

export default app;
