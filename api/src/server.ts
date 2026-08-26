import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/database.js';
import { seedDevelopmentData } from './db/seed.js';

async function bootstrap() {
  await connectDatabase();

  if (env.nodeEnv !== 'production') {
    await seedDevelopmentData();
  }

  createApp().listen(env.port, () => {
    console.log(`Socstat API listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start Socstat API', error);
  process.exit(1);
});
