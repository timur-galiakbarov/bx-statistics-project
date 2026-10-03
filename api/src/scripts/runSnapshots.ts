import mongoose from 'mongoose';
import { connectDatabase } from '../db/database.js';
import { connectRedis, disconnectRedis } from '../services/redis.js';
import { runSnapshotPass } from '../services/snapshotService.js';

// Ручной запуск ежедневного среза: npm run snapshots:run --workspace @socstat/api
// Повторный запуск в тот же день дособерёт только недостающие источники.
await connectDatabase();
await connectRedis();

try {
  const result = await runSnapshotPass();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectRedis();
  await mongoose.disconnect();
  // MTProto-клиент держит соединение открытым.
  process.exit(0);
}
