import { z } from 'zod';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
});

const redisEnvSchema = z.object({
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().min(1),
});

const rabbitmqEnvSchema = z.object({
  RABBITMQ_HOST: z.string().min(1),
  RABBITMQ_PORT: z.coerce.number().int().positive(),
  RABBITMQ_USER: z.string().min(1),
  RABBITMQ_PASSWORD: z.string().min(1),
  RABBITMQ_VHOST: z.string().min(1),
});

const jwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export const gatewayEnvSchema = baseEnvSchema
  .merge(redisEnvSchema)
  .merge(rabbitmqEnvSchema)
  .merge(jwtEnvSchema)
  .extend({
    PORT: z.coerce.number().int().positive(),
    USER_SERVICE_URL: z.string().url(),
    EVENT_SERVICE_URL: z.string().url(),
    NOTIFICATION_SERVICE_URL: z.string().url(),
    SEARCH_SERVICE_URL: z.string().url(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive(),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
    HEALTH_PING_TIMEOUT_MS: z.coerce.number().int().positive(),
    CORS_ORIGIN: z.string().min(1),
    CB_TIMEOUT_MS: z.coerce.number().int().positive(),
    CB_ERROR_THRESHOLD_PERCENT: z.coerce.number().int().min(1).max(100),
    CB_RESET_TIMEOUT_MS: z.coerce.number().int().positive(),
    CB_VOLUME_THRESHOLD: z.coerce.number().int().positive(),
  });

export const serviceEnvSchema = baseEnvSchema
  .merge(redisEnvSchema)
  .merge(rabbitmqEnvSchema)
  .merge(jwtEnvSchema)
  .extend({
    PORT: z.coerce.number().int().positive(),
    DATABASE_URL: z.string().min(1),
  });

export function loadConfig<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data as z.infer<T>;
}

export const EXCHANGES = {
  EVENTS: 'events.exchange',
  USERS: 'users.exchange',
  NOTIFICATIONS: 'notifications.exchange',
} as const;

export const QUEUES = {
  USER_EVENTS: 'user.events.queue',
  EVENT_EVENTS: 'event.events.queue',
  NOTIFICATION_EVENTS: 'notification.events.queue',
  SEARCH_INDEX: 'search.index.queue',
} as const;

export const ROUTING_KEYS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',
  EVENT_CANCELLED: 'event.cancelled',
  EVENT_REGISTERED: 'event.registered',
  EVENT_UNREGISTERED: 'event.unregistered',
  NOTIFICATION_SEND: 'notification.send',
  SEARCH_INDEX_UPDATE: 'search.index.update',
} as const;
