// src/queries/auth.queries.js

export const AUTH_QUERIES = {

  // Buscar usuario por id_usuario (para /me y actualizarPerfil)
  FIND_BY_ID: `
    SELECT
      u.id_usuario,
      u.nombre_usuario,
      u.correo,
      u.estado,
      u.rol_id,
      r.nombre AS rol_nombre,
      c.telefono,
      c.direccion,
      c.documento       AS numero_documento,
      c.tipo_documento
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    LEFT JOIN clientes c ON c.usuario_id = u.id_usuario
    WHERE u.id_usuario = $1
  `,

  // Buscar usuario por correo (para login)
  FIND_BY_CORREO: `
    SELECT
      u.id_usuario,
      u.nombre_usuario,
      u.correo,
      u.contrasena,
      u.estado,
      u.rol_id,
      r.nombre AS rol_nombre,
      e.id_empleado,
      e.nombre AS nombre_empleado,
      c.telefono,
      c.direccion
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.rol_id
    LEFT JOIN empleados e ON e.usuario_id = u.id_usuario
    LEFT JOIN clientes  c ON c.usuario_id = u.id_usuario
    WHERE u.correo = $1
  `,

  // Verificar si ya existe correo
  CHECK_CORREO_EXISTE: `
    SELECT id_usuario FROM usuarios WHERE correo = $1
  `,

  // Verificar documento duplicado en clientes
  CHECK_DOCUMENTO_EXISTE: `
    SELECT id_cliente FROM clientes WHERE documento = $1
  `,

  // Registrar usuario con rol Cliente fijo (asignado por BD via subquery)
  REGISTER: `
    INSERT INTO usuarios (
      nombre_usuario,
      correo,
      contrasena,
      rol_id,
      estado
    )
    VALUES (
      $1, $2, $3,
      (SELECT id_rol FROM roles WHERE nombre = 'Cliente' LIMIT 1),
      'ACTIVO'
    )
    RETURNING
      id_usuario,
      nombre_usuario,
      correo,
      rol_id,
      estado
  `,

  // Actualizar perfil sin cambiar contraseña
  UPDATE_PERFIL: `
    UPDATE usuarios
    SET nombre_usuario = $1, correo = $2
    WHERE id_usuario = $3
    RETURNING
      id_usuario, nombre_usuario, correo, rol_id,
      (SELECT nombre FROM roles WHERE id_rol = rol_id) AS rol_nombre
  `,

  // Actualizar perfil cambiando también la contraseña
  UPDATE_PERFIL_CON_PASSWORD: `
    UPDATE usuarios
    SET nombre_usuario = $1, correo = $2, contrasena = $3
    WHERE id_usuario = $4
    RETURNING
      id_usuario, nombre_usuario, correo, rol_id,
      (SELECT nombre FROM roles WHERE id_rol = rol_id) AS rol_nombre
  `,

  // Guardar token recuperación
  SAVE_RESET_TOKEN: `
    UPDATE usuarios
    SET
      reset_token = $1,
      reset_token_expiry = NOW() + INTERVAL '1 hour'
    WHERE correo = $2
    RETURNING id_usuario, correo
  `,

  // Buscar token recuperación
  FIND_BY_RESET_TOKEN: `
    SELECT id_usuario, correo, reset_token_expiry
    FROM usuarios
    WHERE reset_token = $1
      AND reset_token_expiry > NOW()
  `,

  // Actualizar contraseña
  UPDATE_PASSWORD: `
    UPDATE usuarios
    SET
      contrasena = $1,
      reset_token = NULL,
      reset_token_expiry = NULL
    WHERE id_usuario = $2
  `,

  // Migraciones (una por columna para evitar fallos en Neon/PostgreSQL)
  ADD_RESET_TOKEN: `
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
  `,
  ADD_RESET_TOKEN_EXPIRY: `
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
  `,
  ADD_NOMBRE_USUARIO: `
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(100);
  `,
};
