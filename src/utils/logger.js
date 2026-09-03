import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'aroko-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 && !meta.service
            ? ' ' + JSON.stringify(meta)
            : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

if (isProduction) {
  logger.add(new winston.transports.File({
    dirname: logDir,
    filename: 'error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    dirname: logDir,
    filename: 'combined.log',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
}

export default logger;
