import { loadConfig, serviceEnvSchema } from '@api-gateway-ms/shared';
import { z } from 'zod';

const userServiceEnvSchema = serviceEnvSchema.extend({
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15),
});

export const config = loadConfig(userServiceEnvSchema);
