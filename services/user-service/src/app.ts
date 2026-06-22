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
  serializeError,
  successResponse,
  ValidationError,
} from '@api-gateway-ms/shared';
import { authenticate } from './auth.middleware';
import {
  getUserProfile,
  loginUser,
  logoutUser,
  refreshUserTokens,
  registerUser,
  updateUserProfile,
} from './auth.service';
import { prisma } from './prisma';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateProfileSchema,
} from './validators';

const app = express();
const startTime = Date.now();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    service: 'user-service',
    status: HealthStatus.HEALTHY,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}));

app.post('/api/v1/auth/register', asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid registration payload', { issues: parsed.error.flatten() });
  }

  const result = await registerUser(parsed.data);
  res.status(201).json(successResponse(result));
}));

app.post('/api/v1/auth/login', asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid login payload', { issues: parsed.error.flatten() });
  }

  const result = await loginUser(parsed.data);
  res.json(successResponse(result));
}));

app.post('/api/v1/auth/refresh', asyncHandler(async (req: Request, res: Response) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid refresh token payload', { issues: parsed.error.flatten() });
  }

  const result = await refreshUserTokens(parsed.data);
  res.json(successResponse(result));
}));

app.post('/api/v1/auth/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await logoutUser(req.user!.sub);
  res.status(204).send();
}));

app.get('/api/v1/users/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserProfile(req.user!.sub);
  res.json(successResponse(user));
}));

app.patch('/api/v1/users/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid profile payload', { issues: parsed.error.flatten() });
  }

  const user = await updateUserProfile(req.user!.sub, parsed.data);
  res.json(successResponse(user));
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const serialized = serializeError(err);
  res.status(getStatusCode(err)).json(errorResponse(serialized));
});

export default app;
