import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('[Auth] Authorization faltante');
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    logger.warn('[Auth] Authorization inválido');
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalizar siempre a id_usuario sin importar cómo fue generado el token
    req.usuario = {
      id_usuario:     decoded.id_usuario ?? decoded.id,
      nombre_usuario: decoded.nombre_usuario ?? decoded.nombre ?? decoded.correo ?? decoded.email,
      correo:         decoded.correo  ?? decoded.email,
      rol:            decoded.rol     ?? decoded.rol_nombre,
      rol_nombre:     decoded.rol_nombre ?? decoded.rol,
      rol_id:         decoded.rol_id,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('[Auth] Token expirado');
      return res.status(401).json({ ok: false, message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn('[Auth] Token inválido');
      return res.status(401).json({ ok: false, message: 'Token inválido.' });
    }
    logger.error('[Auth] Error verificando token:', err.message);
    return res.status(401).json({ ok: false, message: 'No autenticado.' });
  }
};

export const verificarRol = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, message: 'No autenticado' });
  }
  const rol = (req.usuario.rol ?? req.usuario.rol_nombre ?? '').trim();
  // Comparación case-insensitive para cubrir 'ADMINISTRADOR' vs 'Administrador'
  const permitido = rolesPermitidos.some(
    (r) => r.toLowerCase() === rol.toLowerCase()
  );
  if (!permitido) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes permiso para esta acción.',
      rol_recibido: rol,
    });
  }
  next();
};

// Middleware exclusivo para rutas del panel administrativo
export const soloPanel = (req, res, next) => {
  const ROLES_PANEL = ['Administrador', 'Panadero', 'Repartidor'];
  const rol = req.usuario?.rol ?? req.usuario?.rol_nombre;
  if (!ROLES_PANEL.includes(rol)) {
    return res.status(403).json({
      ok: false,
      message: 'No tienes acceso al panel administrativo.',
      rol_recibido: rol,
    });
  }
  next();
};