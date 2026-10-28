import type { AuthUser, Role } from './domain.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export type { Role };
export {};
