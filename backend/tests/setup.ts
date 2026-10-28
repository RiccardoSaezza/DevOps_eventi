// Deve essere eseguito prima di importare la configurazione dell'app:
// punta tutti i test a un database separato da quello di sviluppo.
const fallback = 'postgres://accordo:accordo@localhost:5432/accordo_test';

function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const base = process.env.DATABASE_URL;
  if (!base) return fallback;

  try {
    const url = new URL(base);
    url.pathname = '/accordo_test';
    return url.toString();
  } catch {
    return fallback;
  }
}

process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret';
process.env.ORGANIZER_INVITE_CODE = 'TESTCODE';
