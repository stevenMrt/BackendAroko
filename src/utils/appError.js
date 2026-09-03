export class AppError extends Error {
  constructor(message, statusCode, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.data = data;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Solicitud inválida', data = null) {
    super(message, 400, data);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', data = null) {
    super(message, 404, data);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto de datos', data = null) {
    super(message, 409, data);
  }
}
