import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthUser, Role } from '../types/domain.js';

interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  role: Role;
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string') return null;

    const { sub, name, email, role } = decoded as jwt.JwtPayload & TokenPayload;
    if (!sub || !name || !email || !role) return null;
    if (role !== 'PARTECIPANTE' && role !== 'ORGANIZZATORE') return null;

    return { id: sub, name, email, role };
  } catch {
    return null;
  }
}
