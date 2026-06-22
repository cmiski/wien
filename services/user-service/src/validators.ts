import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase()),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one profile field is required',
});
