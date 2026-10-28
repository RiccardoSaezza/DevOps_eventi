import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, Role } from '../types/domain.js';
import { HttpError } from '../utils/http-error.js';
import { verifyToken } from '../utils/jwt.js';

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(
      new HttpError(
        401,
        'UNAUTHENTICATED',
        'Devi effettuare l’accesso per continuare.',
      ),
    );
    return;
  }

  const user = verifyToken(header.slice('Bearer '.length).trim());
  if (!user) {
    next(
      new HttpError(
        401,
        'INVALID_TOKEN',
        'Sessione non valida o scaduta. Effettua di nuovo il login.',
      ),
    );
    return;
  }

  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new HttpError(401, 'UNAUTHENTICATED', 'Accesso non autenticato.'),
      );
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        new HttpError(
          403,
          'FORBIDDEN',
          'Il tuo ruolo non consente questa operazione.',
        ),
      );
      return;
    }
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Accesso non autenticato.');
  }
  return req.user;
}
