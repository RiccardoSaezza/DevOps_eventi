import { z } from 'zod';

const eventType = z.enum(['CONCERTO', 'WORKSHOP', 'DJ_SET'], {
  message: 'Scegli un tipo di evento valido.',
});

const startsAt = z.coerce
  .date({ message: 'Inserisci una data e un orario validi.' })
  .refine((date) => date.getTime() > Date.now() - 60_000, {
    message: 'La data dell’evento deve essere futura.',
  });

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Il titolo deve avere almeno 3 caratteri.')
    .max(120, 'Il titolo è troppo lungo.'),
  description: z
    .string()
    .trim()
    .max(4000, 'La descrizione è troppo lunga.')
    .optional()
    .default(''),
  type: eventType,
  startsAt,
  location: z
    .string()
    .trim()
    .min(2, 'Indica il luogo dell’evento.')
    .max(160, 'Il luogo è troppo lungo.'),
  capacity: z.coerce
    .number({ message: 'La capienza deve essere un numero.' })
    .int('La capienza deve essere un numero intero.')
    .min(1, 'La capienza minima è 1.')
    .max(10_000, 'La capienza massima è 10.000.'),
});

export const updateEventSchema = createEventSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nessun campo da aggiornare.',
  });

export const listEventsQuerySchema = z.object({
  type: eventType.optional(),
  q: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  available: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  period: z.enum(['upcoming', 'past', 'all']).optional().default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
