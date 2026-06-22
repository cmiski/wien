import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import type { User } from '@prisma/client';
import {
  AuthTokens,
  ConflictError,
  JwtPayload,
  UnauthorizedError,
  UserRole,
} from '@api-gateway-ms/shared';
import { config } from './config';
import { prisma } from './prisma';
import { toPublicUser } from './user.mapper';
import type { z } from 'zod';
import type {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateProfileSchema,
} from './validators';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type RefreshInput = z.infer<typeof refreshTokenSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const signToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: SignOptions['expiresIn']
): string => jwt.sign(payload, config.JWT_SECRET, { expiresIn });

const createTokens = async (user: User): Promise<AuthTokens> => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
  };
  const accessToken = signToken(payload, config.JWT_EXPIRES_IN as SignOptions['expiresIn']);
  const refreshToken = signToken(payload, config.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  const decodedAccessToken = jwt.decode(accessToken) as JwtPayload | null;

  return {
    accessToken,
    refreshToken,
    expiresIn: decodedAccessToken?.exp && decodedAccessToken.iat
      ? decodedAccessToken.exp - decodedAccessToken.iat
      : 0,
  };
};

export const registerUser = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: input.email },
        { username: input.username },
      ],
    },
  });

  if (existingUser?.email === input.email) {
    throw new ConflictError('Email is already registered');
  }

  if (existingUser?.username === input.username) {
    throw new ConflictError('Username is already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  const tokens = await createTokens(user);
  return { user: toPublicUser(user), tokens };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const tokens = await createTokens(user);
  return { user: toPublicUser(user), tokens };
};

export const refreshUserTokens = async (input: RefreshInput) => {
  try {
    const payload = jwt.verify(input.refreshToken, config.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive || user.refreshToken !== input.refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokens = await createTokens(user);
    return { user: toPublicUser(user), tokens };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid refresh token');
  }
};

export const logoutUser = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User is inactive or no longer exists');
  }
  return toPublicUser(user);
};

export const updateUserProfile = async (userId: string, input: UpdateProfileInput) => {
  if (input.username) {
    const existingUser = await prisma.user.findUnique({ where: { username: input.username } });
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError('Username is already taken');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
  });
  return toPublicUser(user);
};
