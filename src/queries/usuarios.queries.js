// src/queries/usuarios.queries.js

export const USUARIOS_QUERIES = {

  // Migraciones: agregar columnas extras a usuarios
  MIGRATE: `
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(100);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono       VARCHAR(20);
  `,

  LIST: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    ORDER BY u.id_usuario
  `,

  SEARCH: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE (u.correo ILIKE $1 OR r.nombre ILIKE $1 OR u.nombre_usuario ILIKE $1)
    ORDER BY u.id_usuario
  `,

  FIND_BY_ID: `
    SELECT
      u.id_usuario,
      u.correo,
      u.nombre_usuario,
      u.telefono,
      u.rol_id,
      r.nombre  AS rol_nombre,
      u.estado,
      u.created_at,
      e.id_empleado,
      e.nombre  AS empleado_nombre
    FROM usuarios u
    JOIN roles    r ON r.id_rol     = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    WHERE u.id_usuario = $1
  `,

  CORREO_EXISTS: `
    SELECT id_usuario FROM usuarios
    WHERE LOWER(correo) = LOWER($1) AND id_usuario != $2
  `,

  // $1 correo $2 hash $3 rol_id $4 nombre_usuario $5 telefono
  CREATE: `
    INSERT INTO usuarios (correo, contrasena, rol_id, nombre_usuario, telefono)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  // $1 correo $2 rol_id $3 nombre_usuario $4 telefono $5 estado $6 id
  UPDATE: `
    UPDATE usuarios
    SET correo = $1, rol_id = $2, nombre_usuario = $3, telefono = $4, estado = $5
    WHERE id_usuario = $6
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  // $1 correo $2 rol_id $3 nombre_usuario $4 telefono $5 estado $6 hash $7 id
  UPDATE_WITH_PASSWORD: `
    UPDATE usuarios
    SET correo = $1, rol_id = $2, nombre_usuario = $3, telefono = $4, estado = $5, contrasena = $6
    WHERE id_usuario = $7
    RETURNING id_usuario, correo, nombre_usuario, telefono, rol_id, estado, created_at
  `,

  TOGGLE_ESTADO: `
    UPDATE usuarios
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_usuario = $1
    RETURNING id_usuario, correo, rol_id, estado
  `,

  SOFT_DELETE: `
    UPDATE usuarios SET estado = 'INACTIVO'
    WHERE id_usuario = $1
    RETURNING id_usuario, correo, estado
  `,
};

export const EMPLEADOS_QUERIES = {

  ADD_TIPO_DOCUMENTO: `
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) DEFAULT 'CC';
  `,

  // Migraciones: campos extras del empleado
  MIGRATE: `
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo        VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS area         VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS direccion    VARCHAR(150);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS email        VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS salario      NUMERIC(12,2);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
  `,

  LIST: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      u.correo      AS usuario_correo,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado
    FROM empleados e
    LEFT JOIN usuarios u ON u.id_usuario = e.usuario_id
    WHERE e.estado = 'ACTIVO'
    ORDER BY e.id_empleado
  `,

  SEARCH: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      u.correo      AS usuario_correo,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado
    FROM empleados e
    LEFT JOIN usuarios u ON u.id_usuario = e.usuario_id
    WHERE e.estado = 'ACTIVO'
      AND (e.nombre ILIKE $1 OR e.documento ILIKE $1 OR u.correo ILIKE $1 OR e.cargo ILIKE $1)
    ORDER BY e.id_empleado
  `,

  FIND_BY_ID: `
    SELECT
      e.id_empleado,
      e.usuario_id,
      u.correo      AS usuario_correo,
      u.rol_id,
      r.nombre      AS rol_nombre,
      e.nombre,
      e.tipo_documento,
      e.documento,
      e.telefono,
      e.cargo,
      e.area,
      e.direccion,
      e.email,
      e.salario,
      e.fecha_ingreso,
      e.estado
    FROM empleados e
    LEFT JOIN usuarios u ON u.id_usuario = e.usuario_id
    LEFT JOIN roles   r  ON r.id_rol     = u.rol_id
    WHERE e.id_empleado = $1
  `,

  DOCUMENTO_EXISTS: `
    SELECT id_empleado FROM empleados
    WHERE documento = $1 AND id_empleado != $2
  `,

  USUARIO_ASIGNADO: `
    SELECT id_empleado FROM empleados
    WHERE usuario_id = $1 AND id_empleado != $2
  `,

  // Para el select: todos los usuarios activos (incluye el ya asignado al editar)
  USUARIOS_DISPONIBLES: `
    SELECT u.id_usuario, u.correo, u.nombre_usuario, r.nombre AS rol_nombre
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    WHERE u.estado = 'ACTIVO'
      AND u.id_usuario NOT IN (
        SELECT usuario_id FROM empleados WHERE usuario_id IS NOT NULL
      )
    ORDER BY u.correo
  `,

  // $1 usuario_id $2 nombre $3 tipo_doc $4 doc $5 tel $6 cargo $7 area $8 dir $9 email $10 salario $11 fecha_ingreso
  CREATE: `
    INSERT INTO empleados
      (usuario_id, nombre, tipo_documento, documento, telefono,
       cargo, area, direccion, email, salario, fecha_ingreso)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `,

  UPDATE: `
    UPDATE empleados
    SET usuario_id=$1, nombre=$2, tipo_documento=$3, documento=$4, telefono=$5,
        cargo=$6, area=$7, direccion=$8, email=$9, salario=$10, fecha_ingreso=$11
    WHERE id_empleado=$12
    RETURNING *
  `,

  TOGGLE_ESTADO: `
    UPDATE empleados
    SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
    WHERE id_empleado = $1
    RETURNING *
  `,

  SOFT_DELETE: `
    UPDATE empleados SET estado = 'INACTIVO'
    WHERE id_empleado = $1
    RETURNING id_empleado, nombre, estado
  `,
};