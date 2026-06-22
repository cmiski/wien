import { gatewayEnvSchema, loadConfig } from '@api-gateway-ms/shared';

/**
 * Static service registry - reads from environment variables.
 * Can be extended to a dynamic registry (Consul, etcd) later.
 */
export interface ServiceEntry {
  name: string;
  url: string;
  healthPath: string;
}

const config = loadConfig(gatewayEnvSchema);

export const serviceRegistry: Record<string, ServiceEntry> = {
  'user-service': {
    name: 'user-service',
    url: config.USER_SERVICE_URL,
    healthPath: '/health',
  },
  'event-service': {
    name: 'event-service',
    url: config.EVENT_SERVICE_URL,
    healthPath: '/health',
  },
  'notification-service': {
    name: 'notification-service',
    url: config.NOTIFICATION_SERVICE_URL,
    healthPath: '/health',
  },
  'search-service': {
    name: 'search-service',
    url: config.SEARCH_SERVICE_URL,
    healthPath: '/health',
  },
};

export const getService = (name: string): ServiceEntry | undefined =>
  serviceRegistry[name];
