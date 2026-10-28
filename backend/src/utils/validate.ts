import type { ZodType } from 'zod';
import { HttpError } from './http-error.js';

export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      422,
      'VALIDATION_ERROR',
      'Alcuni campi non sono validi.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'richiesta',
        message: issue.message,
      })),
    );
  }
  return result.data;
}
