import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/database.js';
import { seedDevelopmentData } from './db/seed.js';
import { connectRedis } from './services/redis.js';
import { startSnapshotScheduler } from './services/snapshotService.js';

async function bootstrap() {
  await connectDatabase();
  // Redis protects the shared Telegram session, but an outage must not take down
  // unrelated API routes and turn the whole site into a 502.
  void connectRedis().then(
    () => console.log('Redis connected'),
    (error) => console.error('Redis is unavailable; Telegram analytics is disabled until it reconnects.', error)
  );

  if (env.nodeEnv !== 'production') {
    await seedDevelopmentData();
  }

  createApp().listen(env.port, () => {
    console.log(`Socstat API listening on http://localhost:${env.port}`);
  });

  startSnapshotScheduler();
}

bootstrap().catch((error) => {
  console.error('Failed to start Socstat API', error);
  process.exit(1);
});
