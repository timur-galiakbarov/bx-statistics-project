import { Schema, model } from 'mongoose';

const platforms = ['vk', 'youtube', 'telegram'];
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: platforms, required: true },
  externalId: { type: String, required: true },
  sourceName: { type: String, default: '' },
  // Место по ключевым метрикам из последнего отчёта за 30 дней — для главной.
  summary: { type: Schema.Types.Mixed, default: null },
  // У наборов, сохранённых до смешанных платформ, platform конкурента нет: это платформа исходного сообщества.
  competitors: { type: [{ platform: { type: String, enum: platforms }, externalId: { type: String, required: true }, name: { type: String, required: true } }], default: [] }
}, { timestamps: true });
schema.index({ userId: 1, platform: 1, externalId: 1 }, { unique: true });
schema.index({ userId: 1, updatedAt: -1 });
export const CompetitorSetModel = model('CompetitorSet', schema);
