/**
 * Static service registry - reads from environment variables.
 * Can be extended to a dynamic registry (Consul, etcd) later.
 */
export interface ServiceEntry {
  name: string;
  url: string;
  healthPath: string;
}

export const serviceRegistry: Record<string, ServiceEntry> = {
  'user-service': {
    name: 'user-service',
    url: process.env.USER_SERVICE_URL ?? 'http://user-service:3001',
    healthPath: '/health',
  },
  'event-service': {
    name: 'event-service',
    url: process.env.EVENT_SERVICE_URL ?? 'http://event-service:3002',
    healthPath: '/health',
  },
  'notification-service': {
    name: 'notification-service',
    url: process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3003',
    healthPath: '/health',
  },
  'search-service': {
    name: 'search-service',
    url: process.env.SEARCH_SERVICE_URL ?? 'http://search-service:3004',
    healthPath: '/health',
  },
};

export const getService = (name: string): ServiceEntry | undefined =>
  serviceRegistry[name];
