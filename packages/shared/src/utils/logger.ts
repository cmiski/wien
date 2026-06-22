import winston from 'winston';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, service, correlationId, ...meta }) => {
  const corr = correlationId ? ` [${String(correlationId)}]` : '';
  const svc = service ? ` [${String(service)}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${String(ts)}${svc}${corr} ${level}: ${String(message)}${metaStr}`;
});

const isDev = process.env.NODE_ENV !== 'production';

export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL,
    defaultMeta: { service },
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      errors({ stack: true }),
      isDev
        ? combine(colorize({ all: true }), devFormat)
        : json()
    ),
    transports: [
      new winston.transports.Console(),
    ],
    exitOnError: false,
  });
};

// Default logger
export const logger = createLogger('app');
