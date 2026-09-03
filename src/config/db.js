import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
  logger.debug('Conexión a PostgreSQL establecida');
});

pool.on('error', (err) => {
  logger.error('Error en el pool de PostgreSQL:', err.message);
});

export default pool;
