import type { NextFunction, Request, Response } from 'express';
import type { DatabaseError } from 'pg';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new HttpError(
      404,
      'ROUTE_NOT_FOUND',
      `Endpoint non trovato: ${req.method} ${req.path}`,
    ),
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Alcuni campi non sono validi.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || 'richiesta',
          message: issue.message,
        })),
      },
    });
    return;
  }

  const pgError = error as Partial<DatabaseError>;
  if (pgError.code === '23505') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'L’operazione entra in conflitto con un dato già esistente.',
      },
    });
    return;
  }

  console.error('[api] errore non gestito', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Si è verificato un errore interno. Riprova più tardi.',
      ...(config.nodeEnv === 'development' && error instanceof Error
        ? { details: error.message }
        : {}),
    },
  });
}
