import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { pool } from './pool.js';

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: 'PARTECIPANTE' | 'ORGANIZZATORE';
}

function dateFromNow(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function ensureUser(
  name: string,
  email: string,
  password: string,
  role: SeedUser['role'],
): Promise<SeedUser> {
  const existing = await pool.query<SeedUser>(
    'SELECT id, name, email, role::text AS role FROM users WHERE lower(email) = $1',
    [email],
  );
  const found = existing.rows[0];
  if (found) return found;

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await pool.query<SeedUser>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role::text AS role`,
    [name, email, passwordHash, role],
  );
  const user = inserted.rows[0];
  if (!user) throw new Error(`Creazione utente seed fallita: ${email}`);
  return user;
}

export async function seed(): Promise<void> {
  const organizer = await ensureUser(
    'Marco Ferretti',
    'marco@accordo.test',
    'Organizza123!',
    'ORGANIZZATORE',
  );
  const giulia = await ensureUser(
    'Giulia Rossi',
    'giulia@accordo.test',
    'Partecipa123!',
    'PARTECIPANTE',
  );
  const luca = await ensureUser(
    'Luca Bianchi',
    'luca@accordo.test',
    'Partecipa123!',
    'PARTECIPANTE',
  );
  await ensureUser(
    'Sara Conti',
    'sara@accordo.test',
    'Partecipa123!',
    'PARTECIPANTE',
  );

  const count = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM events',
  );
  if ((count.rows[0]?.count ?? 0) > 0) {
    console.log('[db] seed eventi già presente, nessuna modifica');
    return;
  }

  const events = [
    {
      title: 'Rassegna d’Autunno — Live Session',
      description:
        'Una serata di chiusura della rassegna autunnale: tre band, un solo palco. Ingresso con posto numerato.',
      type: 'CONCERTO',
      startsAt: dateFromNow(-21, 20, 30),
      location: 'Teatro Duse, Bologna',
      capacity: 60,
    },
    {
      title: 'Vinile Sunset',
      description:
        'Selezione deep house e disco su vinile fino al tramonto. Ingresso libero fino a esaurimento capienza.',
      type: 'DJ_SET',
      startsAt: dateFromNow(5, 18, 30),
      location: 'Terrazza BASE, Milano',
      capacity: 200,
    },
    {
      title: 'Notturno Elettrico',
      description:
        'Live set di synth e percussioni, con apertura affidata a due progetti emergenti della scena bolognese. Posti numerati.',
      type: 'CONCERTO',
      startsAt: dateFromNow(11, 21, 0),
      location: 'Ex Macello, Bologna',
      capacity: 120,
    },
    {
      title: 'Produzione Musicale: dal Loop al Brano',
      description:
        'Workshop pratico su arrangiamento e mix: porta il tuo laptop e un progetto aperto. Massimo 18 partecipanti.',
      type: 'WORKSHOP',
      startsAt: dateFromNow(17, 10, 0),
      location: 'Studio 23, Firenze',
      capacity: 18,
    },
    {
      title: 'Cantiere Sonoro — Live',
      description:
        'Una serata in cui il pubblico ascolta il suono in costruzione: improvvisazione, elettronica e visuals.',
      type: 'CONCERTO',
      startsAt: dateFromNow(24, 21, 0),
      location: 'Teatro Duse, Bologna',
      capacity: 80,
    },
    {
      title: 'Ascolto Critico: il Disco come Opera',
      description:
        'Un ascolto guidato di tre album fondamentali, con discussione aperta e appunti condivisi.',
      type: 'WORKSHOP',
      startsAt: dateFromNow(31, 18, 0),
      location: 'Libreria Modo Infoshop, Bologna',
      capacity: 25,
    },
    {
      title: 'Afterhours: Selezione Deep',
      description:
        'Dj set notturno, capienza limitata. Ingresso libero con prenotazione consigliata.',
      type: 'DJ_SET',
      startsAt: dateFromNow(38, 23, 0),
      location: 'Spazio Nove, Torino',
      capacity: 150,
    },
  ] as const;

  const createdIds: string[] = [];
  for (const event of events) {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO events (title, description, type, starts_at, location, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        event.title,
        event.description,
        event.type,
        event.startsAt,
        event.location,
        event.capacity,
        organizer.id,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Creazione evento seed fallita');
    createdIds.push(id);
  }

  const pastConcertId = createdIds[0];
  const djSetId = createdIds[1];
  const concertId = createdIds[2];
  const workshopId = createdIds[3];

  if (pastConcertId && concertId && workshopId) {
    await pool.query(
      `INSERT INTO bookings (event_id, user_id, seat_number, status, created_at)
       VALUES
         ($1, $2, 7, 'CONFERMATA', now() - interval '30 days'),
         ($1, $3, 8, 'CONFERMATA', now() - interval '29 days'),
         ($4, $2, 1, 'CONFERMATA', now() - interval '4 days'),
         ($4, $3, 2, 'CONFERMATA', now() - interval '3 days'),
         ($5, $2, NULL, 'CONFERMATA', now() - interval '2 days')`,
      [pastConcertId, giulia.id, luca.id, concertId, workshopId],
    );
  }

  if (djSetId) {
    console.log(`[db] eventi demo creati (${createdIds.length})`);
  }

  console.log(
    '[db] account demo — organizzatore: marco@accordo.test / Organizza123! — partecipante: giulia@accordo.test / Partecipa123!',
  );
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  seed()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error('[db] seed fallito', error);
      await pool.end();
      process.exit(1);
    });
}
