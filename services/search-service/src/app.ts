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
  paginationSchema,
  SearchType,
} from '@api-gateway-ms/shared';
import { prisma } from './prisma';
import { z } from 'zod';
import { Prisma } from '@api-gateway-ms/search-prisma-client';

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
    service: 'search-service',
    status: HealthStatus.HEALTHY,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}));

const searchSchema = paginationSchema.extend({
  q: z.string().optional().default(''),
  type: z.nativeEnum(SearchType).optional().default(SearchType.ALL),
  tags: z.string().optional(), // Comma-separated tags
  location: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

app.get('/api/v1/search', asyncHandler(async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid search parameters', { issues: parsed.error.flatten() });
  }

  const { q, type, tags, location, status, startDate, endDate, page, limit } = parsed.data;

  // Build where clause
  const where: Prisma.SearchIndexWhereInput = {
    isActive: true,
  };

  if (q.trim().length > 0) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (type === SearchType.EVENTS) {
    where.sourceType = 'EVENT';
  } else if (type === SearchType.USERS) {
    where.sourceType = 'USER';
  }

  if (tags) {
    const tagsList = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    if (tagsList.length > 0) {
      where.tags = { hasSome: tagsList };
    }
  }

  const filters: Prisma.SearchIndexWhereInput[] = [];
  if (location) {
    filters.push({
      metadata: {
        path: ['location'],
        equals: location,
      },
    });
  }
  if (status) {
    filters.push({
      metadata: {
        path: ['status'],
        equals: status,
      },
    });
  }
  if (startDate) {
    filters.push({
      metadata: {
        path: ['startDate'],
        gte: startDate,
      },
    });
  }
  if (endDate) {
    filters.push({
      metadata: {
        path: ['endDate'],
        lte: endDate,
      },
    });
  }

  if (filters.length > 0) {
    where.AND = filters;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.searchIndex.findMany({
      where,
      skip,
      take: limit,
      orderBy: { indexedAt: 'desc' },
    }),
    prisma.searchIndex.count({ where }),
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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const serialized = serializeError(err);
  res.status(getStatusCode(err)).json(errorResponse(serialized));
});

export default app;
