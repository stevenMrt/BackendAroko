import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import pool from './config/db.js';
import logger from './utils/logger.js';

import { AUTH_QUERIES } from './queries/auth.queries.js';
import { EMPLEADOS_QUERIES } from './queries/usuarios.queries.js';
import { USUARIOS_QUERIES } from './queries/usuarios.queries.js';
import { COMPRAS_QUERIES } from './queries/compras.queries.js';
import { PRODUCCION_QUERIES } from './queries/produccion.queries.js';
import {
  CLIENTES_QUERIES,
  PEDIDOS_QUERIES
} from './queries/pedidos.queries.js';

import { VENTAS_QUERIES } from './queries/ventas.queries.js';
import { DOMICILIOS_QUERIES } from './queries/domicilios.queries.js';
import { MOVIMIENTOS_QUERIES } from './queries/stock.queries.js';
import { ORDERS_QUERIES } from './queries/orders.queries.js';

// ������������������������������������������������������������������������������������������
// Migraciones automáticas
// ������������������������������������������������������������������������������������������

const migraciones = [
  { query: AUTH_QUERIES.ADD_RESET_TOKEN,        nombre: 'reset_token' },
  { query: AUTH_QUERIES.ADD_RESET_TOKEN_EXPIRY, nombre: 'reset_token_expiry' },
  { query: AUTH_QUERIES.ADD_NOMBRE_USUARIO,     nombre: 'nombre_usuario' },
  {
    query: `INSERT INTO roles (nombre, descripcion)
            VALUES ('Cliente', 'Acceso a la tienda en línea')
            ON CONFLICT (nombre) DO NOTHING`,
    nombre: 'rol Cliente'
  },
  { query: EMPLEADOS_QUERIES.ADD_TIPO_DOCUMENTO, nombre: 'tipo_documento' },
  { query: EMPLEADOS_QUERIES.MIGRATE,            nombre: 'empleados: campos extras' },
  { query: USUARIOS_QUERIES.MIGRATE,             nombre: 'usuarios: nombre_usuario, telefono' },
  { query: COMPRAS_QUERIES.MIGRATE,              nombre: 'compras columns' },
  { query: PRODUCCION_QUERIES.MIGRATE,           nombre: 'produccion columns' },
  { query: CLIENTES_QUERIES.MIGRATE,             nombre: 'clientes: tipo_documento' },
  { query: CLIENTES_QUERIES.MIGRATE_EMAIL,        nombre: 'clientes: email' },
  { query: CLIENTES_QUERIES.MIGRATE_USUARIO_ID,   nombre: 'clientes: usuario_id' },
  // Eliminar columna id_usuario duplicada de clientes (orden estricto)
  { query: CLIENTES_QUERIES.MIGRATE_ID_USUARIO,   nombre: 'clientes: migrar id_usuario �  usuario_id' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_FK,   nombre: 'clientes: drop FK id_usuario' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_UNIQUE, nombre: 'clientes: drop UNIQUE id_usuario' },
  { query: CLIENTES_QUERIES.DROP_ID_USUARIO_COL,  nombre: 'clientes: drop column id_usuario' },
  { query: PEDIDOS_QUERIES.MIGRATE,              nombre: 'pedidos columns' },
  { query: VENTAS_QUERIES.MIGRATE,               nombre: 'ventas columns' },
  { query: DOMICILIOS_QUERIES.MIGRATE,           nombre: 'domicilios columns' },
  { query: MOVIMIENTOS_QUERIES.MIGRATE,           nombre: 'movimientos_inventario table' },
  { query: ORDERS_QUERIES.MIGRATE,                nombre: 'orders / order_items tables' },
  { query: `CREATE TABLE IF NOT EXISTS devoluciones (
    id_devolucion SERIAL PRIMARY KEY,
    venta_id INT NOT NULL REFERENCES ventas(id_venta),
    producto_id INT NOT NULL REFERENCES productos(id_producto),
    motivo TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    fecha TIMESTAMP DEFAULT NOW()
  )`, nombre: 'devoluciones table' },
  // Integridad: primero desvincular no-clientes, luego vincular huérfanos por correo
  { query: CLIENTES_QUERIES.REMOVE_NON_CLIENTE_ROLE, nombre: 'clientes: desvincular no-clientes' },
  { query: CLIENTES_QUERIES.SYNC_USUARIO_ID,         nombre: 'clientes: vincular por correo' },
  // Eliminar registros huérfanos (sin usuario_id) que no tienen pedidos asociados
  {
    query: `DELETE FROM clientes
            WHERE usuario_id IS NULL
              AND id_cliente NOT IN (SELECT DISTINCT cliente_id FROM pedidos)`,
    nombre: 'clientes: eliminar huérfanos sin pedidos'
  },
];

async function ejecutarMigraciones() {
  for (const { query, nombre } of migraciones) {
    try {
      await pool.query(query);
      logger.info(`Migración [${nombre}] OK`);
    } catch (err) {
      logger.warn(`Migración [${nombre}] falló: ${err.message}`);
    }
  }
}

// ������������������������������������������������������������������������������������������
// Rutas
// ������������������������������������������������������������������������������������������

import authRoutes from './routes/auth.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import permisosRoutes from './routes/permisos.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import empleadosRoutes from './routes/empleados.routes.js';
import proveedoresRoutes from './routes/proveedores.routes.js';
import catInsumoRoutes from './routes/categoriasInsumo.routes.js';
import insumosRoutes from './routes/insumos.routes.js';
import comprasRoutes from './routes/compras.routes.js';
import catProductoRoutes from './routes/categoriasProducto.routes.js';
import productosRoutes from './routes/productos.routes.js';
import produccionRoutes from './routes/produccion.routes.js';
import salidasRoutes from './routes/salidas.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import pedidosRoutes from './routes/pedidos.routes.js';
import ventasRoutes from './routes/ventas.routes.js';
import abonosRoutes from './routes/abonos.routes.js';
import devolucionesRoutes from './routes/devoluciones.routes.js';
import domiciliosRoutes from './routes/domicilios.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { ordersRouter, adminOrdersRouter } from './routes/orders.routes.js';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// ������������������������������������������������������������������������������������������
// Security headers
// ������������������������������������������������������������������������������������������

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  } : false,
}));

// ������������������������������������������������������������������������������������������
// CORS
// ������������������������������������������������������������������������������������������

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin) && !isProduction) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS bloqueado para origen: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ������������������������������������������������������������������������������������������
// HTTP request logging (Morgan �  Winston)
// ������������������������������������������������������������������������������������������

app.use(morgan(':method :url :status :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
  skip: (req) => isProduction && req.method === 'OPTIONS',
}));

// ������������������������������������������������������������������������������������������
// Global rate limiting (protege endpoints públicos)
// ������������������������������������������������������������������������������������������

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes. Intenta m�s tarde.' },
  skip: (req) => !isProduction,
});

app.use(globalLimiter);

// ������������������������������������������������������������������������������������������
// Archivos públicos
// ������������������������������������������������������������������������������������������

// Archivos subidos (imágenes de productos, comprobantes)
app.use('/uploads', express.static('uploads'));

// ������������������������������������������������������������������������������������������
// API
// ������������������������������������������������������������������������������������������

const API = '/api';

app.use(`${API}/auth`, authRoutes);

app.use(`${API}/roles`, rolesRoutes);

app.use(`${API}/permisos`, permisosRoutes);

app.use(`${API}/usuarios`, usuariosRoutes);

app.use(`${API}/empleados`, empleadosRoutes);

app.use(`${API}/proveedores`, proveedoresRoutes);

app.use(`${API}/categorias-insumos`, catInsumoRoutes);
app.use(`${API}/insumos`, insumosRoutes);
app.use(`${API}/compras`, comprasRoutes);

app.use(`${API}/categorias-productos`, catProductoRoutes);
app.use(`${API}/productos`, productosRoutes);
app.use(`${API}/produccion`, produccionRoutes);

app.use(`${API}/salidas`, salidasRoutes);
app.use(`${API}/clientes`, clientesRoutes);
app.use(`${API}/pedidos`, pedidosRoutes);
app.use(`${API}/ventas`, ventasRoutes);
app.use(`${API}/abonos`, abonosRoutes);
app.use(`${API}/devoluciones`, devolucionesRoutes);
app.use(`${API}/domicilios`, domiciliosRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/orders`, ordersRouter);
app.use(`${API}/admin`, adminOrdersRouter);

// ������������������������������������������������������������������������������������������
// Health check � liveness
// ������������������������������������������������������������������������������������������

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'Aroko API corriendo',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ������������������������������������������������������������������������������������������
// Health check � readiness (verifica dependencias)
// ������������������������������������������������������������������������������������������

app.get('/api/health/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true, message: 'Listo', database: 'conectado' });
  } catch (err) {
    logger.error('Health check DB falló:', err.message);
    res.status(503).json({ ok: false, message: 'Base de datos no disponible', database: 'desconectado' });
  }
});

// ������������������������������������������������������������������������������������������
// 404
// ������������������������������������������������������������������������������������������

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Ruta no encontrada'
  });
});

// ������������������������������������������������������������������������������������������
// Middleware global de manejo de errores
// ������������������������������������������������������������������������������������������

app.use((err, req, res, _next) => {
  logger.error('Error no capturado', {
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method,
    statusCode: err.statusCode,
  });

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      ok: false,
      message: err.message,
      ...(err.data && { data: err.data }),
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ ok: false, message: 'Conflicto: el recurso ya existe.' });
  }

  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor.',
  });
});

// ������������������������������������������������������������������������������������������
// Arranque
// ������������������������������������������������������������������������������������������

const PORT = process.env.PORT || 3000;

let server;

async function startServer() {
  try {
    await pool.query('SELECT 1');
    logger.info('Conexión a PostgreSQL verificada');
  } catch (err) {
    logger.error('No se pudo conectar a PostgreSQL en startup:', err.message);
    process.exit(1);
  }

  await ejecutarMigraciones();

  server = app.listen(PORT, () => {
    logger.info(`�xa� Aroko API corriendo en puerto ${PORT} (modo ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();

// ������������������������������������������������������������������������������������������
// Graceful shutdown
// ������������������������������������������������������������������������������������������

const SHUTDOWN_TIMEOUT = 30000;

let shuttingDown = false;

const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Recibida señal ${signal}. Cerrando servidor...`);

  if (server) {
    server.close(() => {
      logger.info('Servidor cerrado. Cerrando pool de PostgreSQL...');
      pool.end(() => {
        logger.info('Pool de PostgreSQL cerrado. Terminando proceso.');
        process.exit(0);
      });
    });
  }

  setTimeout(() => {
    logger.error('Graceful shutdown excedió timeout. Forzando cierre.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  pool.removeAllListeners('error');
  pool.connect((err) => {
    if (err) {
      logger.error('Error forzando cierre de pool:', err.message);
      process.exit(1);
    }
  });
  pool.end(() => {
    if (server) server.close();
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error('UnhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('UncaughtException:', err);
  process.exit(1);
});

export { app };

