// src/queries/devoluciones.queries.js

// ══════════════════════════════════════════════
//  DEVOLUCIONES
// ══════════════════════════════════════════════
export const DEVOLUCIONES_QUERIES = {

  LIST: `
    SELECT
      d.id_devolucion,
      d.venta_id,
      v.numero_venta,
      d.producto_id,
      p.nombre          AS producto_nombre,
      d.motivo,
      d.estado,
      d.fecha
    FROM devoluciones d
    JOIN ventas v ON v.id_venta = d.venta_id
    LEFT JOIN productos p ON p.id_producto = d.producto_id
    ORDER BY d.fecha DESC, d.id_devolucion DESC
  `,

  SEARCH: `
    SELECT
      d.id_devolucion,
      d.venta_id,
      v.numero_venta,
      d.producto_id,
      p.nombre          AS producto_nombre,
      d.motivo,
      d.estado,
      d.fecha
    FROM devoluciones d
    JOIN ventas v ON v.id_venta = d.venta_id
    LEFT JOIN productos p ON p.id_producto = d.producto_id
    WHERE d.motivo ILIKE $1 OR d.estado ILIKE $1
    ORDER BY d.fecha DESC, d.id_devolucion DESC
  `,

  FIND_BY_ID: `
    SELECT
      d.id_devolucion,
      d.venta_id,
      v.numero_venta,
      d.producto_id,
      p.nombre          AS producto_nombre,
      d.motivo,
      d.estado,
      d.fecha
    FROM devoluciones d
    JOIN ventas v ON v.id_venta = d.venta_id
    LEFT JOIN productos p ON p.id_producto = d.producto_id
    WHERE d.id_devolucion = $1
  `,

  CREATE: `
    INSERT INTO devoluciones (venta_id, producto_id, motivo, estado, fecha)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `,

  UPDATE: `
    UPDATE devoluciones
    SET venta_id = $1, producto_id = $2, motivo = $3, estado = $4
    WHERE id_devolucion = $5
    RETURNING *
  `,

  DELETE: `
    DELETE FROM devoluciones
    WHERE id_devolucion = $1
  `,
};
