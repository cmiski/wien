import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'crypto';
import {
  createLogger,
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  MessageEvent,
  MessagePayload,
  requestContext,
  Event,
  EventRegistration,
  RegistrationStatus,
} from '@api-gateway-ms/shared';
import { NotificationType, Prisma } from '@api-gateway-ms/notification-prisma-client';
import { config } from './config';
import { prisma } from './prisma';

const logger = createLogger('notification-service');

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

const rabbitUrl = () => {
  const vhost = encodeURIComponent(config.RABBITMQ_VHOST);
  return `amqp://${encodeURIComponent(config.RABBITMQ_USER)}:${encodeURIComponent(config.RABBITMQ_PASSWORD)}@${config.RABBITMQ_HOST}:${String(config.RABBITMQ_PORT)}/${vhost}`;
};

export const startConsumer = async (): Promise<void> => {
  try {
    connection = await amqp.connect(rabbitUrl());
    channel = await connection.createChannel();

    // Assert exchanges
    await channel.assertExchange(EXCHANGES.EVENTS, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.NOTIFICATIONS, 'topic', { durable: true });

    // Assert queue
    await channel.assertQueue(QUEUES.NOTIFICATION_EVENTS, { durable: true });

    // Bind queue
    await channel.bindQueue(QUEUES.NOTIFICATION_EVENTS, EXCHANGES.EVENTS, ROUTING_KEYS.EVENT_REGISTERED);
    await channel.bindQueue(QUEUES.NOTIFICATION_EVENTS, EXCHANGES.EVENTS, ROUTING_KEYS.EVENT_CANCELLED);
    await channel.bindQueue(QUEUES.NOTIFICATION_EVENTS, EXCHANGES.EVENTS, ROUTING_KEYS.EVENT_UPDATED);
    await channel.bindQueue(QUEUES.NOTIFICATION_EVENTS, EXCHANGES.NOTIFICATIONS, ROUTING_KEYS.NOTIFICATION_SEND);

    // Prefetch
    await channel.prefetch(10);

    // Consume
    await channel.consume(QUEUES.NOTIFICATION_EVENTS, (msg) => {
      if (msg) {
        handleMessage(msg);
      }
    });

    logger.info('Notification Service RabbitMQ consumer started successfully');
  } catch (err) {
    logger.error('Failed to start RabbitMQ consumer', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

const handleMessage = (msg: ConsumeMessage): void => {
  let messagePayload: MessagePayload<unknown>;
  try {
    messagePayload = JSON.parse(msg.content.toString()) as MessagePayload<unknown>;
  } catch (err) {
    logger.error('Failed to parse RabbitMQ message content', { error: String(err) });
    channel?.ack(msg);
    return;
  }

  const correlationId = messagePayload.correlationId ?? randomUUID();
  void requestContext.run({ correlationId, requestId: randomUUID(), service: 'notification-service' }, async () => {
    try {
      const { eventType, payload } = messagePayload;
      logger.info(`Received event: ${eventType}`, { correlationId });

      switch (eventType) {
        case MessageEvent.EVENT_REGISTERED: {
          const { registration, event } = payload as { registration: EventRegistration; event: Event };
          const isConfirmed = registration.status === RegistrationStatus.CONFIRMED;

          // Notify participant
          await prisma.notification.create({
            data: {
              userId: registration.userId,
              type: 'EVENT_REGISTERED',
              title: isConfirmed ? 'Registered for Event' : 'Waitlisted for Event',
              message: isConfirmed
                ? `You have successfully registered for "${event.title}"`
                : `You have been waitlisted for "${event.title}"`,
              metadata: { eventId: event.id, registrationId: registration.id } as Prisma.InputJsonValue,
            },
          });

          // Notify organizer
          await prisma.notification.create({
            data: {
              userId: event.organizerId,
              type: 'EVENT_REGISTERED',
              title: 'New Event Registration',
              message: `A user has registered for your event "${event.title}"`,
              metadata: { eventId: event.id, registrationId: registration.id } as Prisma.InputJsonValue,
            },
          });
          break;
        }

        case MessageEvent.EVENT_CANCELLED: {
          const { event, userIds } = payload as { event: Event; userIds: string[] };
          if (userIds && userIds.length > 0) {
            const notificationsData = userIds.map((userId) => ({
              userId,
              type: 'EVENT_CANCELLED' as const,
              title: 'Event Cancelled',
              message: `The event "${event.title}" has been cancelled.`,
              metadata: { eventId: event.id } as Prisma.InputJsonValue,
            }));

            await prisma.notification.createMany({
              data: notificationsData,
            });
          }
          break;
        }

        case MessageEvent.EVENT_UPDATED: {
          const { event, userIds } = payload as { event: Event; userIds: string[] };
          if (userIds && userIds.length > 0) {
            const notificationsData = userIds.map((userId) => ({
              userId,
              type: 'EVENT_UPDATED' as const,
              title: 'Event Updated',
              message: `The event "${event.title}" has been updated.`,
              metadata: { eventId: event.id } as Prisma.InputJsonValue,
            }));

            await prisma.notification.createMany({
              data: notificationsData,
            });
          }
          break;
        }

        case MessageEvent.NOTIFICATION_SEND: {
          const { userId, type, title, message, metadata } = payload as {
            userId: string;
            type: NotificationType;
            title: string;
            message: string;
            metadata?: Prisma.InputJsonValue;
          };
          await prisma.notification.create({
            data: {
              userId,
              type,
              title,
              message,
              metadata,
            },
          });
          break;
        }

        default:
          logger.warn(`Unhandled event type: ${eventType}`);
      }

      channel?.ack(msg);
    } catch (err) {
      logger.error('Error processing notification event', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Nack and do not requeue to avoid infinite loops on invalid payloads
      channel?.nack(msg, false, false);
    }
  });
};

export const closeConsumer = async (): Promise<void> => {
  try {
    await channel?.close();
    await connection?.close();
    channel = undefined;
    connection = undefined;
    logger.info('RabbitMQ consumer connection closed');
  } catch (err) {
    logger.error('Error closing RabbitMQ consumer connection', { error: String(err) });
  }
};
