import type {
  Event as PrismaEvent,
  EventRegistration as PrismaEventRegistration,
} from '@api-gateway-ms/event-prisma-client';
import {
  Event,
  EventRegistration,
  EventStatus,
  RegistrationStatus,
} from '@api-gateway-ms/shared';

const toEventStatus = (status: PrismaEvent['status']): EventStatus => {
  switch (status) {
    case 'DRAFT':
      return EventStatus.DRAFT;
    case 'PUBLISHED':
      return EventStatus.PUBLISHED;
    case 'CANCELLED':
      return EventStatus.CANCELLED;
    case 'COMPLETED':
      return EventStatus.COMPLETED;
  }
};

const toRegistrationStatus = (
  status: PrismaEventRegistration['status']
): RegistrationStatus => {
  switch (status) {
    case 'CONFIRMED':
      return RegistrationStatus.CONFIRMED;
    case 'WAITLISTED':
      return RegistrationStatus.WAITLISTED;
    case 'CANCELLED':
      return RegistrationStatus.CANCELLED;
  }
};

export const toEvent = (event: PrismaEvent): Event => ({
  id: event.id,
  title: event.title,
  description: event.description,
  organizerId: event.organizerId,
  location: event.location,
  startDate: event.startDate,
  endDate: event.endDate,
  capacity: event.capacity,
  registeredCount: event.registeredCount,
  status: toEventStatus(event.status),
  tags: event.tags,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

export const toEventRegistration = (
  registration: PrismaEventRegistration
): EventRegistration => ({
  id: registration.id,
  eventId: registration.eventId,
  userId: registration.userId,
  registeredAt: registration.registeredAt,
  status: toRegistrationStatus(registration.status),
});
