import {
  ConflictError,
  EventStatus,
  ForbiddenError,
  MessageEvent,
  NotFoundError,
  RegistrationStatus,
  UserRole,
  ValidationError,
} from '@api-gateway-ms/shared';
import { Prisma } from '@api-gateway-ms/event-prisma-client';
import { prisma } from './prisma';
import { toEvent, toEventRegistration } from './event.mapper';
import {
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from './validators';
import type { JwtPayload } from '@api-gateway-ms/shared';
import type { z } from 'zod';
import { publishEventMessage, publishSearchIndexUpdate } from './event.publisher';

type CreateEventInput = z.infer<typeof createEventSchema>;
type UpdateEventInput = z.infer<typeof updateEventSchema>;
type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

const canManageEvent = (user: JwtPayload, organizerId: string): boolean =>
  user.sub === organizerId || user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR;

const assertCanManageEvent = (user: JwtPayload, organizerId: string): void => {
  if (!canManageEvent(user, organizerId)) {
    throw new ForbiddenError('You cannot manage this event');
  }
};

const toPrismaStatus = (status: EventStatus) => status;

export const createEvent = async (input: CreateEventInput, user: JwtPayload) => {
  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description,
      location: input.location,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      capacity: input.capacity,
      tags: input.tags,
      organizerId: user.sub,
      status: 'DRAFT',
    },
  });

  const mapped = toEvent(event);
  await publishEventMessage(MessageEvent.EVENT_CREATED, mapped);
  return mapped;
};

export const listEvents = async (query: ListEventsQuery, user?: JwtPayload) => {
  const elevated = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  const canViewRequestedStatus =
    query.status === undefined ||
    query.status === EventStatus.PUBLISHED ||
    elevated ||
    (user !== undefined && query.organizerId === user.sub);

  if (!canViewRequestedStatus) {
    throw new ForbiddenError('You cannot list non-public events');
  }

  const where: Prisma.EventWhereInput = {
    status: query.status ? toPrismaStatus(query.status) : 'PUBLISHED',
    ...(query.organizerId && { organizerId: query.organizerId }),
    ...(query.tag && { tags: { has: query.tag } }),
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { location: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { startDate: 'asc' },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    items: items.map(toEvent),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getEvent = async (eventId: string, user?: JwtPayload) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  if (event.status !== 'PUBLISHED' && (!user || !canManageEvent(user, event.organizerId))) {
    throw new NotFoundError('Event', eventId);
  }

  return toEvent(event);
};

export const updateEvent = async (
  eventId: string,
  input: UpdateEventInput,
  user: JwtPayload
) => {
  const existingEvent = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existingEvent) {
    throw new NotFoundError('Event', eventId);
  }

  assertCanManageEvent(user, existingEvent.organizerId);

  const startDate = input.startDate ? new Date(input.startDate) : existingEvent.startDate;
  const endDate = input.endDate ? new Date(input.endDate) : existingEvent.endDate;
  if (endDate <= startDate) {
    throw new ValidationError('endDate must be after startDate');
  }

  if (input.capacity && input.capacity < existingEvent.registeredCount) {
    throw new ValidationError('capacity cannot be lower than registeredCount');
  }

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...input,
      ...(input.startDate && { startDate }),
      ...(input.endDate && { endDate }),
      ...(input.status && { status: toPrismaStatus(input.status) }),
    },
  });

  const mapped = toEvent(event);
  await publishEventMessage(
    mapped.status === EventStatus.CANCELLED
      ? MessageEvent.EVENT_CANCELLED
      : MessageEvent.EVENT_UPDATED,
    mapped
  );
  await publishSearchIndexUpdate(
    mapped.status === EventStatus.PUBLISHED
      ? { action: 'upsert', type: 'event', event: mapped }
      : { action: 'delete', type: 'event', id: mapped.id }
  );
  return mapped;
};

export const deleteEvent = async (eventId: string, user: JwtPayload): Promise<void> => {
  const existingEvent = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existingEvent) {
    throw new NotFoundError('Event', eventId);
  }

  assertCanManageEvent(user, existingEvent.organizerId);
  await prisma.event.delete({ where: { id: eventId } });
  await publishEventMessage(MessageEvent.EVENT_CANCELLED, {
    ...toEvent(existingEvent),
    status: EventStatus.CANCELLED,
  });
  await publishSearchIndexUpdate({ action: 'delete', type: 'event', id: eventId });
};

export const registerForEvent = async (eventId: string, user: JwtPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError('Event', eventId);
    }
    if (event.status !== 'PUBLISHED') {
      throw new ConflictError('Event is not open for registration');
    }
    if (event.organizerId === user.sub) {
      throw new ConflictError('Organizers cannot register for their own events');
    }

    const existingRegistration = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (existingRegistration && existingRegistration.status !== 'CANCELLED') {
      throw new ConflictError('User is already registered for this event');
    }

    const reservation = await tx.event.updateMany({
      where: {
        id: eventId,
        status: 'PUBLISHED',
        registeredCount: { lt: event.capacity },
      },
      data: { registeredCount: { increment: 1 } },
    });
    const status = reservation.count === 1 ? 'CONFIRMED' : 'WAITLISTED';
    const registration = existingRegistration
      ? await tx.eventRegistration.update({
        where: { id: existingRegistration.id },
        data: { status },
      })
      : await tx.eventRegistration.create({
        data: {
          eventId,
          userId: user.sub,
          status,
        },
      });

    const updatedEvent = await tx.event.findUnique({ where: { id: eventId } });
    if (!updatedEvent) {
      throw new NotFoundError('Event', eventId);
    }

    return { registration, event: updatedEvent };
  });

  const payload = {
    registration: toEventRegistration(result.registration),
    event: toEvent(result.event),
  };
  await publishEventMessage(MessageEvent.EVENT_REGISTERED, payload);
  return payload;
};

export const unregisterFromEvent = async (eventId: string, user: JwtPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (!registration || registration.status === 'CANCELLED') {
      throw new NotFoundError('Event registration');
    }

    const cancellation = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        status: registration.status,
      },
      data: { status: RegistrationStatus.CANCELLED },
    });
    if (cancellation.count !== 1) {
      throw new ConflictError('Registration was already updated');
    }

    const updatedEvent = registration.status === 'CONFIRMED'
      ? await tx.event.update({
        where: { id: eventId },
        data: { registeredCount: { decrement: 1 } },
      })
      : await tx.event.findUnique({ where: { id: eventId } });

    if (!updatedEvent) {
      throw new NotFoundError('Event', eventId);
    }

    const updatedRegistration = await tx.eventRegistration.findUnique({
      where: { id: registration.id },
    });
    if (!updatedRegistration) {
      throw new NotFoundError('Event registration');
    }

    return { registration: updatedRegistration, event: updatedEvent };
  });

  const payload = {
    registration: toEventRegistration(result.registration),
    event: toEvent(result.event),
  };
  await publishEventMessage(MessageEvent.EVENT_UNREGISTERED, payload);
  return payload;
};
