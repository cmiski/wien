import { z } from 'zod';
import { EventStatus } from '@api-gateway-ms/shared';

const dateStringSchema = z.string().datetime();

export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(2).max(255),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  capacity: z.coerce.number().int().positive().max(100000),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
}).refine((value) => new Date(value.endDate) > new Date(value.startDate), {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

export const updateEventSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  location: z.string().min(2).max(255).optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one event field is required',
}).refine((value) => {
  if (!value.startDate || !value.endDate) return true;
  return new Date(value.endDate) > new Date(value.startDate);
}, {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

export const eventIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().min(1).max(100).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  tag: z.string().min(1).max(40).optional(),
  organizerId: z.string().uuid().optional(),
});
