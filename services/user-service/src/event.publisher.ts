import amqp, { Channel, ChannelModel } from 'amqplib';
import { randomUUID } from 'crypto';
import {
  createLogger,
  EXCHANGES,
  getCorrelationId,
  MessageEvent,
  MessagePayload,
  ServiceName,
} from '@api-gateway-ms/shared';
import { config } from './config';

const logger = createLogger('user-service');

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

const rabbitUrl = () => {
  const vhost = encodeURIComponent(config.RABBITMQ_VHOST);
  return `amqp://${encodeURIComponent(config.RABBITMQ_USER)}:${encodeURIComponent(config.RABBITMQ_PASSWORD)}@${config.RABBITMQ_HOST}:${String(config.RABBITMQ_PORT)}/${vhost}`;
};

const getChannel = async (): Promise<Channel> => {
  if (channel) return channel;

  connection = await amqp.connect(rabbitUrl());
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGES.USERS, 'topic', { durable: true });
  return channel;
};

export const publishUserEvent = async <T>(
  eventType: MessageEvent,
  payload: T
): Promise<void> => {
  try {
    const activeChannel = await getChannel();
    const message: MessagePayload<T> = {
      eventType,
      payload,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      source: ServiceName.USER_SERVICE,
    };

    const routingKey = eventType;
    activeChannel.publish(
      EXCHANGES.USERS,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        contentType: 'application/json',
        persistent: true,
        messageId: randomUUID(),
        timestamp: Date.now(),
      }
    );
  } catch (err) {
    logger.error('Failed to publish user event message', {
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const closePublisher = async (): Promise<void> => {
  await channel?.close();
  await connection?.close();
  channel = undefined;
  connection = undefined;
};
