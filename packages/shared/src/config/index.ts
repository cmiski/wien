import { z } from 'zod';

// ─── Environment config schema with Zod ───────────────────────

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
});

const redisEnvSchema = z.object({
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default('redis123'),
});

const rabbitmqEnvSchema = z.object({
  RABBITMQ_HOST: z.string().default('rabbitmq'),
  RABBITMQ_PORT: z.coerce.number().default(5672),
  RABBITMQ_USER: z.string().default('admin'),
  RABBITMQ_PASSWORD: z.string().default('rabbit123'),
  RABBITMQ_VHOST: z.string().default('/'),
});

const jwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

// ─── Per-service schemas ───────────────────────────────────────

export const gatewayEnvSchema = baseEnvSchema
  .merge(redisEnvSchema)
  .merge(rabbitmqEnvSchema)
  .merge(jwtEnvSchema)
  .extend({
    PORT: z.coerce.number().default(3000),
    USER_SERVICE_URL: z.string().url(),
    EVENT_SERVICE_URL: z.string().url(),
    NOTIFICATION_SERVICE_URL: z.string().url(),
    SEARCH_SERVICE_URL: z.string().url(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
  });

export const serviceEnvSchema = baseEnvSchema
  .merge(redisEnvSchema)
  .merge(rabbitmqEnvSchema)
  .extend({
    PORT: z.coerce.number(),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
  });

// ─── Config loader ────────────────────────────────────────────

export function loadConfig<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${issues}`);
  }
  return result.data as z.infer<T>;
}

// ─── RabbitMQ exchange/queue constants ────────────────────────

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
