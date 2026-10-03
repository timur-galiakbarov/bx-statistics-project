import { Schema, model } from 'mongoose';

// Дополнительные источники для ежедневных срезов помимо сохранённых
// пользователями (например, популярные каналы для будущих публичных страниц).
const snapshotSourceSchema = new Schema(
  {
    platform: { type: String, enum: ['vk', 'youtube', 'telegram'], required: true },
    externalId: { type: String, required: true },
    note: { type: String }
  },
  { timestamps: true }
);

snapshotSourceSchema.index({ platform: 1, externalId: 1 }, { unique: true });

export const SnapshotSourceModel = model('SnapshotSource', snapshotSourceSchema);
