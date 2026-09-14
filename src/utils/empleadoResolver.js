// src/utils/empleadoResolver.js

/**
 * Resuelve un ID de empleado válido para relaciones de clave foránea.
 * Si el ID proporcionado corresponde a un usuario (usuario_id) o si el empleado
 * no existe directamente, busca la correspondencia en la tabla `empleados`.
 *
 * @param {import('pg').PoolClient | import('pg').Pool} db - Cliente o Pool de PostgreSQL
 * @param {number|string} empleadoId - ID recibido en el request (puede ser id_empleado o id_usuario)
 * @returns {Promise<number>} ID de empleado válido
 */
export async function resolverEmpleadoId(db, empleadoId) {
  const numId = parseInt(empleadoId, 10);
  if (!numId || isNaN(numId)) {
    const { rows: firstEmp } = await db.query(
      "SELECT id_empleado FROM empleados WHERE estado = 'ACTIVO' ORDER BY id_empleado ASC LIMIT 1"
    );
    if (firstEmp.length > 0) return firstEmp[0].id_empleado;
    const { rows: anyEmp } = await db.query('SELECT id_empleado FROM empleados ORDER BY id_empleado ASC LIMIT 1');
    return anyEmp[0]?.id_empleado || 1;
  }

  // 1. Verificar si existe directamente como id_empleado
  const { rows: direct } = await db.query(
    'SELECT id_empleado FROM empleados WHERE id_empleado = $1',
    [numId]
  );
  if (direct.length > 0) {
    return direct[0].id_empleado;
  }

  // 2. Verificar si corresponde a usuario_id en la tabla empleados
  const { rows: byUser } = await db.query(
    'SELECT id_empleado FROM empleados WHERE usuario_id = $1',
    [numId]
  );
  if (byUser.length > 0) {
    return byUser[0].id_empleado;
  }

  // 3. Fallback al primer empleado activo del sistema
  const { rows: fallback } = await db.query(
    "SELECT id_empleado FROM empleados WHERE estado = 'ACTIVO' ORDER BY id_empleado ASC LIMIT 1"
  );
  if (fallback.length > 0) {
    return fallback[0].id_empleado;
  }

  const { rows: anyEmp } = await db.query('SELECT id_empleado FROM empleados ORDER BY id_empleado ASC LIMIT 1');
  return anyEmp[0]?.id_empleado || numId;
}
