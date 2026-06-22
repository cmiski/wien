import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UnauthorizedError, UserRole } from '@api-gateway-ms/shared';
import { config } from './config';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const gatewayUserId = req.headers['x-user-id'];
  const gatewayEmail = req.headers['x-user-email'];
  const gatewayRole = req.headers['x-user-role'];

  if (
    typeof gatewayUserId === 'string' &&
    typeof gatewayEmail === 'string' &&
    typeof gatewayRole === 'string'
  ) {
    req.user = {
      sub: gatewayUserId,
      email: gatewayEmail,
      role: gatewayRole as UserRole,
    };
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  try {
    req.user = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid token');
  }
};
