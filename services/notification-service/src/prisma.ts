import { PrismaClient } from '@api-gateway-ms/notification-prisma-client';

const isDev = process.env.NODE_ENV !== 'production';

export const prisma = new PrismaClient({
  log: isDev ? ['error', 'warn'] : ['error'],
});
