import 'dotenv/config';

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readNumber(process.env.PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://accordo:accordo@localhost:5432/accordo',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-super-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  organizerInviteCode:
    process.env.ORGANIZER_INVITE_CODE ?? 'ORGANIZZA2026',
  smtpUrl: process.env.SMTP_URL ?? 'smtp://localhost:1025',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
} as const;
