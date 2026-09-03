// src/controllers/usuarios.controller.js

import bcrypt from 'bcryptjs';
import pool   from '../config/db.js';
import { USUARIOS_QUERIES, EMPLEADOS_QUERIES } from '../queries/usuarios.queries.js';
import { CLIENTES_QUERIES } from '../queries/pedidos.queries.js';
import logger from '../utils/logger.js';

const ROL_CLIENTE_NOMBRE = 'Cliente';

// �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
//  USUARIOS
// �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

// GET /api/usuarios?search=&estado=&rol_id=
export const listarUsuarios = async (req, res) => {
  const { search, estado, rol_id } = req.query;
  try {
    let { rows } = search
      ? await pool.query(USUARIOS_QUERIES.SEARCH, [`%${search.trim()}%`])
      : await pool.query(USUARIOS_QUERIES.LIST);

    if (estado)  rows = rows.filter((u) => u.estado === estado.toUpperCase());
    if (rol_id)  rows = rows.filter((u) => u.rol_id === parseInt(rol_id));

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay usuarios registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    logger.error('Error al listar usuarios:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al buscar usuario.' });
  }
};

// GET /api/usuarios/:id
export const obtenerUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error('Error al obtener usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle.' });
  }
};

// POST /api/usuarios
export const crearUsuario = async (req, res) => {
  const { correo, contrasena, rol_id, nombre_usuario, telefono } = req.body;

  if (!correo || !contrasena || !rol_id) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ ok: false, message: 'El correo no es válido.' });
  }
  if (contrasena.length < 6) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: dup } = await client.query(USUARIOS_QUERIES.CORREO_EXISTS, [correo.trim(), 0]);
    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'El usuario ya se encuentra registrado.' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const { rows } = await client.query(USUARIOS_QUERIES.CREATE, [
      correo.trim().toLowerCase(), hash, rol_id,
      (nombre_usuario || '').trim() || null,
      (telefono      || '').trim() || null,
    ]);
    const usuario = rows[0];

    const { rows: rolRows } = await client.query(`SELECT nombre FROM roles WHERE id_rol = $1`, [rol_id]);
    if (rolRows[0]?.nombre === ROL_CLIENTE_NOMBRE) {
      const { rows: cliExist } = await client.query(
        `SELECT id_cliente FROM clientes WHERE LOWER(email) = LOWER($1) AND usuario_id IS NULL`, [correo.trim()]
      );
      if (cliExist.length > 0) {
        await client.query(CLIENTES_QUERIES.SET_USUARIO_ID, [usuario.id_usuario, cliExist[0].id_cliente]);
      } else {
        const { rows: cliDup } = await client.query(CLIENTES_QUERIES.FIND_BY_USUARIO_ID, [usuario.id_usuario]);
        if (cliDup.length === 0) {
          await client.query(
            `INSERT INTO clientes (nombre, documento, email, usuario_id, estado) VALUES ($1,$2,$3,$4,'ACTIVO')`,
            [nombre_usuario || correo.trim().toLowerCase(), `USR-${usuario.id_usuario}`, correo.trim().toLowerCase(), usuario.id_usuario]
          );
        }
      }
    }
    await client.query('COMMIT');
    return res.status(201).json({ ok: true, message: 'Usuario registrado exitosamente.', data: usuario });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error al crear usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el usuario.' });
  } finally {
    client.release();
  }
};

// PUT /api/usuarios/:id
export const editarUsuario = async (req, res) => {
  const { id } = req.params;
  const { correo, rol_id, contrasena, nombre_usuario, telefono, estado } = req.body;

  if (!correo || !rol_id) {
    return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ ok: false, message: 'El correo no es válido (Sin @).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: dup } = await client.query(USUARIOS_QUERIES.CORREO_EXISTS, [correo.trim(), id]);
    if (dup.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: 'Ese correo ya está en uso por otro usuario.' });
    }

    const { rows: anterior } = await client.query(
      `SELECT u.rol_id, r.nombre AS rol_nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = $1`, [id]
    );
    const rolAnteriorNombre = anterior[0]?.rol_nombre;
    const { rows: nuevoRolRows } = await client.query(`SELECT nombre FROM roles WHERE id_rol = $1`, [rol_id]);
    const nuevoRolNombre = nuevoRolRows[0]?.nombre;

    const estadoFinal = estado || 'ACTIVO';
    const nombreFinal = (nombre_usuario || '').trim() || null;
    const telefonoFinal = (telefono || '').trim() || null;

    let rows;
    if (contrasena) {
      if (contrasena.length < 6) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      const hash = await bcrypt.hash(contrasena, 10);
      ({ rows } = await client.query(USUARIOS_QUERIES.UPDATE_WITH_PASSWORD, [
        correo.trim().toLowerCase(), rol_id, nombreFinal, telefonoFinal, estadoFinal, hash, id,
      ]));
    } else {
      ({ rows } = await client.query(USUARIOS_QUERIES.UPDATE, [
        correo.trim().toLowerCase(), rol_id, nombreFinal, telefonoFinal, estadoFinal, id,
      ]));
    }

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    if (rolAnteriorNombre === ROL_CLIENTE_NOMBRE && nuevoRolNombre !== ROL_CLIENTE_NOMBRE) {
      await client.query(`UPDATE clientes SET usuario_id = NULL WHERE usuario_id = $1`, [id]);
    }
    if (nuevoRolNombre === ROL_CLIENTE_NOMBRE && rolAnteriorNombre !== ROL_CLIENTE_NOMBRE) {
      const { rows: cliExist } = await client.query(
        `SELECT id_cliente FROM clientes WHERE LOWER(email) = LOWER($1) AND usuario_id IS NULL`, [correo.trim()]
      );
      if (cliExist.length > 0) {
        await client.query(CLIENTES_QUERIES.SET_USUARIO_ID, [id, cliExist[0].id_cliente]);
      } else {
        const { rows: cliDup } = await client.query(CLIENTES_QUERIES.FIND_BY_USUARIO_ID, [id]);
        if (cliDup.length === 0) {
          await client.query(
            `INSERT INTO clientes (nombre, documento, email, usuario_id, estado) VALUES ($1,$2,$3,$4,'ACTIVO')`,
            [nombreFinal || correo.trim().toLowerCase(), `USR-${id}`, correo.trim().toLowerCase(), id]
          );
        }
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Usuario actualizado correctamente.', data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error al editar usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Usuario no ha podido ser actualizado.' });
  } finally {
    client.release();
  }
};

// PATCH /api/usuarios/:id/estado
export const cambiarEstadoUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({
      ok: true,
      message: 'Estado actualizado correctamente.',
      data: rows[0],
    });
  } catch (error) {
    logger.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'No se pudo cambiar estado.' });
  }
};

// DELETE /api/usuarios/:id  �  soft delete (inactiva)
export const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(USUARIOS_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Usuario eliminado correctamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al eliminar usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'Usuario no pudo ser eliminado.' });
  }
};

// �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
//  EMPLEADOS
// �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

// GET /api/empleados?search=&estado=
export const listarEmpleados = async (req, res) => {
  const { search, estado } = req.query;
  try {
    let { rows } = search
      ? await pool.query(EMPLEADOS_QUERIES.SEARCH, [`%${search.trim()}%`])
      : await pool.query(EMPLEADOS_QUERIES.LIST);

    if (estado) rows = rows.filter((e) => e.estado === estado.toUpperCase());

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay empleados registrados.', data: [] });
    }
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    logger.error('Error al listar empleados:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al listar empleados.' });
  }
};

// GET /api/empleados/usuarios-disponibles
// Retorna usuarios ACTIVOS que aún no tienen empleado asignado
export const usuariosDisponibles = async (req, res) => {
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.USUARIOS_DISPONIBLES);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    logger.error('Error al obtener usuarios disponibles:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al obtener usuarios disponibles.' });
  }
};

// GET /api/empleados/:id
export const obtenerEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.FIND_BY_ID, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error('Error al obtener empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cargar el detalle del empleado.' });
  }
};

// POST /api/empleados
export const crearEmpleado = async (req, res) => {
  const { usuario_id, nombre, tipo_documento, documento, telefono,
          cargo, area, direccion, email, salario, fecha_ingreso } = req.body;

  if (!usuario_id || !nombre || !documento) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  try {
    const { rows: dupDoc } = await pool.query(EMPLEADOS_QUERIES.DOCUMENTO_EXISTS, [documento.trim(), 0]);
    if (dupDoc.length > 0) return res.status(409).json({ ok: false, message: 'El empleado ya se encuentra registrado.' });

    const { rows: dupUsr } = await pool.query(EMPLEADOS_QUERIES.USUARIO_ASIGNADO, [usuario_id, 0]);
    if (dupUsr.length > 0) return res.status(409).json({ ok: false, message: 'Ese usuario ya tiene un empleado asignado.' });

    const { rows } = await pool.query(EMPLEADOS_QUERIES.CREATE, [
      usuario_id,
      nombre.trim(),
      tipo_documento || 'CC',
      documento.trim(),
      (telefono  || '').trim() || null,
      (cargo     || '').trim() || null,
      (area      || '').trim() || null,
      (direccion || '').trim() || null,
      (email     || '').trim().toLowerCase() || null,
      salario    ? parseFloat(salario)   : null,
      fecha_ingreso || null,
    ]);
    return res.status(201).json({ ok: true, message: 'Empleado registrado exitosamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al crear empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al registrar el empleado.' });
  }
};

// PUT /api/empleados/:id
export const editarEmpleado = async (req, res) => {
  const { id } = req.params;
  const { usuario_id, nombre, tipo_documento, documento, telefono,
          cargo, area, direccion, email, salario, fecha_ingreso } = req.body;

  if (!usuario_id || !nombre || !documento) {
    return res.status(400).json({ ok: false, message: 'Campos obligatorios incompletos.' });
  }
  try {
    const { rows: dupDoc } = await pool.query(EMPLEADOS_QUERIES.DOCUMENTO_EXISTS, [documento.trim(), id]);
    if (dupDoc.length > 0) return res.status(409).json({ ok: false, message: 'Ese documento ya pertenece a otro empleado.' });

    const { rows: dupUsr } = await pool.query(EMPLEADOS_QUERIES.USUARIO_ASIGNADO, [usuario_id, id]);
    if (dupUsr.length > 0) return res.status(409).json({ ok: false, message: 'Ese usuario ya tiene un empleado asignado.' });

    const { rows } = await pool.query(EMPLEADOS_QUERIES.UPDATE, [
      usuario_id,
      nombre.trim(),
      tipo_documento || 'CC',
      documento.trim(),
      (telefono  || '').trim() || null,
      (cargo     || '').trim() || null,
      (area      || '').trim() || null,
      (direccion || '').trim() || null,
      (email     || '').trim().toLowerCase() || null,
      salario    ? parseFloat(salario)   : null,
      fecha_ingreso || null,
      id,
    ]);
    if (rows.length === 0) return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    return res.status(200).json({ ok: true, message: 'Empleado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al editar empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el empleado.' });
  }
};

// PATCH /api/empleados/:id/estado
export const cambiarEstadoEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.TOGGLE_ESTADO, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Estado actualizado correctamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al cambiar estado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al cambiar el estado del empleado.' });
  }
};

// DELETE /api/empleados/:id �  soft delete
export const eliminarEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(EMPLEADOS_QUERIES.SOFT_DELETE, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
    }
    return res.status(200).json({ ok: true, message: 'Empleado eliminado correctamente.', data: rows[0] });
  } catch (error) {
    logger.error('Error al eliminar empleado:', error.message);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el empleado.' });
  }
};


