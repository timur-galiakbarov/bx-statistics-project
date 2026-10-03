import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDatabase } from '../db/database.js';
import { SnapshotSourceModel } from '../models/SnapshotSource.js';
import { telegramUsernameFromSource } from '../services/snapshotUtils.js';

// Добавляет источники для ежедневных срезов из файла (по одному на строку):
// npm run snapshots:seed --workspace @socstat/api -- telegram channels.txt
// Для telegram — @username или ссылка t.me, для youtube — channel ID (UC…), для vk — числовой ID группы.
const [platformArg, file] = process.argv.slice(2);

if (platformArg !== 'vk' && platformArg !== 'youtube' && platformArg !== 'telegram' || !file) {
  console.error('Usage: snapshots:seed <vk|youtube|telegram> <file>');
  process.exit(1);
}
const platform: 'vk' | 'youtube' | 'telegram' = platformArg;

function normalize(line: string) {
  if (platform === 'telegram') return telegramUsernameFromSource({ externalId: line });
  if (platform === 'youtube') return /^UC[\w-]{20,}$/.test(line) ? line : null;
  const id = line.replace(/^-/, '');
  return /^\d+$/.test(id) ? id : null;
}

const lines = (await readFile(file, 'utf8')).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const ids = [...new Set(lines.map(normalize).filter((id): id is string => Boolean(id)))];
const skipped = lines.length - ids.length;

await connectDatabase();
try {
  if (ids.length) {
    const result = await SnapshotSourceModel.bulkWrite(ids.map((externalId) => ({
      updateOne: { filter: { platform, externalId }, update: { $setOnInsert: { platform, externalId, note: 'seed' } }, upsert: true }
    })), { ordered: false });
    console.log(`Added ${result.upsertedCount}, already present ${ids.length - result.upsertedCount}, skipped invalid/duplicate lines ${skipped}.`);
  } else {
    console.log(`Nothing to add, skipped lines ${skipped}.`);
  }
} finally {
  await mongoose.disconnect();
}
