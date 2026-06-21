// ─── Common API Response Types ────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  traceId?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── User Types ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MODERATOR = 'MODERATOR',
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface CreateUserDto {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UpdateUserDto {
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── Event Types ──────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string;
  organizerId: string;
  location: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  registeredCount: number;
  status: EventStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface CreateEventDto {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  capacity: number;
  tags?: string[];
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  status?: EventStatus;
  tags?: string[];
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  registeredAt: Date;
  status: RegistrationStatus;
}

export enum RegistrationStatus {
  CONFIRMED = 'CONFIRMED',
  WAITLISTED = 'WAITLISTED',
  CANCELLED = 'CANCELLED',
}

// ─── Notification Types ───────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum NotificationType {
  EVENT_REGISTERED = 'EVENT_REGISTERED',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  EVENT_UPDATED = 'EVENT_UPDATED',
  SYSTEM = 'SYSTEM',
}

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── Search Types ─────────────────────────────────────────────

export interface SearchQuery {
  q: string;
  type?: SearchType;
  filters?: SearchFilters;
  pagination?: PaginationQuery;
}

export enum SearchType {
  ALL = 'ALL',
  EVENTS = 'EVENTS',
  USERS = 'USERS',
}

export interface SearchFilters {
  tags?: string[];
  startDate?: string;
  endDate?: string;
  location?: string;
  status?: EventStatus;
}

export interface SearchResult<T = unknown> {
  type: SearchType;
  items: T[];
  total: number;
  query: string;
}

// ─── RabbitMQ Event Messages ──────────────────────────────────

export type MessagePayload<T = unknown> = {
  eventType: MessageEvent;
  payload: T;
  correlationId: string;
  timestamp: string;
  source: ServiceName;
};

export enum MessageEvent {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  EVENT_CREATED = 'event.created',
  EVENT_UPDATED = 'event.updated',
  EVENT_CANCELLED = 'event.cancelled',
  EVENT_REGISTERED = 'event.registered',
  EVENT_UNREGISTERED = 'event.unregistered',
  NOTIFICATION_SEND = 'notification.send',
  SEARCH_INDEX_UPDATE = 'search.index.update',
}

export enum ServiceName {
  API_GATEWAY = 'api-gateway',
  USER_SERVICE = 'user-service',
  EVENT_SERVICE = 'event-service',
  NOTIFICATION_SERVICE = 'notification-service',
  SEARCH_SERVICE = 'search-service',
}

// ─── Health Check ─────────────────────────────────────────────

export interface HealthCheck {
  service: string;
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies?: Record<string, DependencyHealth>;
}

export interface DependencyHealth {
  status: HealthStatus;
  latency?: number;
  message?: string;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}
