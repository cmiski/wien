import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  JwtPayload,
  UnauthorizedError,
  ForbiddenError,
  UserRole,
} from '@api-gateway-ms/shared';

// Extend Express Request to carry the decoded user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      correlationId?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? '';

/**
 * Verify JWT and attach decoded payload to req.user.
 * Throws UnauthorizedError if token is missing or invalid.
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
};

/**
 * Optional auth — attaches user if token present, does not throw if missing.
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      // swallow — optional auth
    }
  }
  next();
};

/**
 * Role-based access control guard.
 * Must be used after `authenticate`.
 */
export const requireRole = (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Required role: ${roles.join(' | ')}. Your role: ${req.user.role}`
      );
    }
    next();
  };
