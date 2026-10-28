import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Inserisci almeno 2 caratteri.')
    .max(80, 'Il nome è troppo lungo.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Inserisci un indirizzo email valido.')
    .max(254),
  password: z
    .string()
    .min(8, 'La password deve avere almeno 8 caratteri.')
    .max(72, 'La password non può superare 72 caratteri.'),
  organizerCode: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Inserisci un indirizzo email valido.'),
  password: z.string().min(1, 'Inserisci la password.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
