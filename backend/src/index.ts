import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(
    `[api] Accordo in ascolto su http://localhost:${config.port} (${config.nodeEnv})`,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] ricevuto ${signal}, chiusura in corso...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
