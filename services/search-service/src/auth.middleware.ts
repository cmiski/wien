import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UnauthorizedError } from '@api-gateway-ms/shared';
import { config } from './config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as JwtPayload;
    } catch {
      req.user = undefined;
    }
  }

  next();
};

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  optionalAuthenticate(req, res, () => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    next();
  });
};
