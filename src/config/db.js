import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  logger.error('DATABASE_URL no esta configurada. Verifica las variables de entorno.');
}

// Use ssl: { rejectUnauthorized: false } for PostgreSQL providers that use
// self-signed or chained CA certificates (Neon, Render managed PostgreSQL).
// This is required in all environments because the DATABASE_URL points to a
// remote PostgreSQL instance that mandates SSL connections.
const sslConfig = { rejectUnauthorized: false };

let poolConfig = {};

if (rawUrl) {
  try {
    const url = new URL(rawUrl);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 5432,
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
    };
  } catch {
    logger.warn('DATABASE_URL no es un URL valido, usando connectionString directo.');
    poolConfig = {
      connectionString: rawUrl,
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
    };
  }
} else {
  poolConfig = {
    connectionString: undefined,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.debug('Conexion a PostgreSQL establecida');
});

pool.on('error', (err) => {
  logger.error('Error en el pool de PostgreSQL:', err.stack);
});

export default pool;
