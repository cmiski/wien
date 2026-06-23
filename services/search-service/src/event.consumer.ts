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
  EventStatus,
} from '@api-gateway-ms/shared';
import { Prisma } from '@api-gateway-ms/search-prisma-client';
import { config } from './config';
import { prisma } from './prisma';

const logger = createLogger('search-service');

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
    await channel.assertExchange(EXCHANGES.USERS, 'topic', { durable: true });

    // Assert queue
    await channel.assertQueue(QUEUES.SEARCH_INDEX, { durable: true });

    // Bind queue
    await channel.bindQueue(QUEUES.SEARCH_INDEX, EXCHANGES.EVENTS, ROUTING_KEYS.SEARCH_INDEX_UPDATE);
    await channel.bindQueue(QUEUES.SEARCH_INDEX, EXCHANGES.USERS, ROUTING_KEYS.USER_CREATED);
    await channel.bindQueue(QUEUES.SEARCH_INDEX, EXCHANGES.USERS, ROUTING_KEYS.USER_UPDATED);
    await channel.bindQueue(QUEUES.SEARCH_INDEX, EXCHANGES.USERS, ROUTING_KEYS.USER_DELETED);

    // Prefetch
    await channel.prefetch(10);

    // Consume
    await channel.consume(QUEUES.SEARCH_INDEX, (msg) => {
      if (msg) {
        handleMessage(msg);
      }
    });

    logger.info('Search Service RabbitMQ consumer started successfully');
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
  void requestContext.run({ correlationId, requestId: randomUUID(), service: 'search-service' }, async () => {
    try {
      const { eventType, payload } = messagePayload;
      logger.info(`Received event for search indexing: ${eventType}`, { correlationId });

      switch (eventType) {
        case MessageEvent.SEARCH_INDEX_UPDATE: {
          const { action, type, event, id } = payload as {
            action: 'upsert' | 'delete';
            type: 'event' | 'user';
            event?: Event;
            id?: string;
          };
          if (type === 'event') {
            if (action === 'upsert' && event) {
              await prisma.searchIndex.upsert({
                where: {
                  sourceId_sourceType: {
                    sourceId: event.id,
                    sourceType: 'EVENT',
                  },
                },
                update: {
                  title: event.title,
                  description: event.description,
                  tags: event.tags || [],
                  metadata: {
                    location: event.location,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    capacity: event.capacity,
                    registeredCount: event.registeredCount,
                    organizerId: event.organizerId,
                    status: event.status,
                  } as Prisma.InputJsonValue,
                  isActive: event.status === EventStatus.PUBLISHED,
                },
                create: {
                  sourceId: event.id,
                  sourceType: 'EVENT',
                  title: event.title,
                  description: event.description,
                  tags: event.tags || [],
                  metadata: {
                    location: event.location,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    capacity: event.capacity,
                    registeredCount: event.registeredCount,
                    organizerId: event.organizerId,
                    status: event.status,
                  } as Prisma.InputJsonValue,
                  isActive: event.status === EventStatus.PUBLISHED,
                },
              });
              logger.info(`Indexed event upsert for event: ${String(event.id)}`);
            } else if (action === 'delete' && id) {
              await prisma.searchIndex.deleteMany({
                where: {
                  sourceId: id,
                  sourceType: 'EVENT',
                },
              });
              logger.info(`Indexed event deletion for event: ${String(id)}`);
            }
          }
          break;
        }

        case MessageEvent.USER_CREATED:
        case MessageEvent.USER_UPDATED: {
          const user = payload as {
            id: string;
            email: string;
            username: string;
            firstName: string;
            lastName: string;
            role?: string;
            isActive?: boolean;
          };
          await prisma.searchIndex.upsert({
            where: {
              sourceId_sourceType: {
                sourceId: user.id,
                sourceType: 'USER',
              },
            },
            update: {
              title: `${String(user.firstName)} ${String(user.lastName)}`,
              description: user.username,
              tags: [user.role || 'USER'],
              metadata: {
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
              } as Prisma.InputJsonValue,
              isActive: user.isActive !== false,
            },
            create: {
              sourceId: user.id,
              sourceType: 'USER',
              title: `${String(user.firstName)} ${String(user.lastName)}`,
              description: user.username,
              tags: [user.role || 'USER'],
              metadata: {
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
              } as Prisma.InputJsonValue,
              isActive: user.isActive !== false,
            },
          });
          logger.info(`Indexed user upsert for user: ${String(user.id)}`);
          break;
        }

        case MessageEvent.USER_DELETED: {
          const { id } = payload as { id: string };
          await prisma.searchIndex.deleteMany({
            where: {
              sourceId: id,
              sourceType: 'USER',
            },
          });
          logger.info(`Indexed user deletion for user: ${String(id)}`);
          break;
        }

        default:
          logger.warn(`Unhandled event type for indexing: ${eventType}`);
      }

      channel?.ack(msg);
    } catch (err) {
      logger.error('Error processing search index event', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Nack and do not requeue to avoid loops
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
