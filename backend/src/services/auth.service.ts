import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import type { AuthUser, PublicUser, Role } from '../types/domain.js';
import { HttpError } from '../utils/http-error.js';
import { signToken } from '../utils/jwt.js';
import { config } from '../config.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

function toPublicUser(row: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [
    input.email,
  ]);
  if (existing.rowCount) {
    throw new HttpError(
      409,
      'EMAIL_IN_USE',
      'Esiste già un account con questa email.',
    );
  }

  let role: Role = 'PARTECIPANTE';
  if (input.organizerCode) {
    if (input.organizerCode !== config.organizerInviteCode) {
      throw new HttpError(
        403,
        'INVALID_INVITE_CODE',
        'Il codice organizzatore non è valido.',
      );
    }
    role = 'ORGANIZZATORE';
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, password_hash`,
    [input.name, input.email, passwordHash, role],
  );

  const user = rows[0];
  if (!user) throw new Error('Creazione utente fallita');

  const publicUser = toPublicUser(user);
  return { token: signToken(publicUser as AuthUser), user: publicUser };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, password_hash, role
     FROM users WHERE lower(email) = $1`,
    [input.email],
  );

  const user = rows[0];
  if (!user) {
    throw new HttpError(
      401,
      'INVALID_CREDENTIALS',
      'Email o password non corretti.',
    );
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new HttpError(
      401,
      'INVALID_CREDENTIALS',
      'Email o password non corretti.',
    );
  }

  const publicUser = toPublicUser(user);
  return { token: signToken(publicUser as AuthUser), user: publicUser };
}

export async function findUserById(id: string): Promise<PublicUser> {
  const { rows } = await pool.query<UserRow>(
    'SELECT id, name, email, role, password_hash FROM users WHERE id = $1',
    [id],
  );
  const user = rows[0];
  if (!user) {
    throw new HttpError(401, 'USER_NOT_FOUND', 'Account non più disponibile.');
  }
  return toPublicUser(user);
}
