// src/controllers/devoluciones.controller.js

import pool from '../config/db.js';
import { DEVOLUCIONES_QUERIES } from '../queries/devoluciones.queries.js';
import logger from '../utils/logger.js';

// GET /api/devoluciones?search=&estado=
export const listarDevoluciones = async (req, res) => {
  const { search, estado } = req.query;
  try {
    let rows;
    if (search) {
      ({ rows } = await pool.query(DEVOLUCIONES_QUERIES.SEARCH, [`%${search.trim()}%`]));
    } else if (estado) {
      ({ rows } = await pool.query(DEVOLUCIONES_QUERIES.LIST + ' WHERE d.estado = $1', [estado.toUpperCase()]));
    } else {
      ({ rows } = await pool.query(DEVOLUCIONES_QUERIES.LIST));
    }

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay devoluciones registradas.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    logger.error('Error al listar devoluciones:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar devoluciones.' });
  }
};

// GET /api/devoluciones/:id
export const obtenerDevolucion = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(DEVOLUCIONES_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Devolución no encontrada.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al cargar la devolución.' });
  }
};

// POST /api/devoluciones
// Body: { venta_id, producto_id, motivo?, estado? }
export const crearDevolucion = async (req, res) => {
  const { venta_id, producto_id, motivo, estado = 'PENDIENTE' } = req.body;

  if (!venta_id || !producto_id) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows } = await pool.query(DEVOLUCIONES_QUERIES.CREATE, [
      venta_id,
      producto_id,
      motivo || null,
      estado.toUpperCase(),
    ]);
    return res.status(201).json({ ok: true, message: 'Devolución registrada exitosamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al registrar devolución:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar la devolución.' });
  }
};

// PUT /api/devoluciones/:id
// Body: { venta_id, producto_id, motivo, estado }
export const actualizarDevolucion = async (req, res) => {
  const { id } = req.params;
  const { venta_id, producto_id, motivo, estado } = req.body;

  if (!venta_id || !producto_id || !estado) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }

  try {
    const { rows } = await pool.query(DEVOLUCIONES_QUERIES.UPDATE, [
      venta_id,
      producto_id,
      motivo || null,
      estado.toUpperCase(),
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Devolución no encontrada.' });
    }
    return res.status(200).json({ ok: true, message: 'Devolución actualizada exitosamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al actualizar devolución:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar la devolución.' });
  }
};

// DELETE /api/devoluciones/:id
export const eliminarDevolucion = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(DEVOLUCIONES_QUERIES.DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Devolución no encontrada.' });
    }
    return res.status(200).json({ ok: true, message: 'Devolución eliminada exitosamente.' });
  } catch (error) {
    logger.error('Error al eliminar devolución:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar la devolución.' });
  }
};



