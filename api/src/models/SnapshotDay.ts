import { Schema, model } from 'mongoose';

// Покрытие ежедневного среза: сколько источников ожидалось и сколько снято на
// дату. Обновляется после каждого прохода, по нему видно пропуски до того,
// как день закончится и недостающие данные станут невосстановимыми.
const platformCoverageSchema = new Schema(
  {
    sources: { type: Number, default: 0 },
    collected: { type: Number, default: 0 },
    // Только VK: источники со снятыми подписчиками, но без постов.
    postsPending: { type: Number, default: 0 },
    // Почему последний проход остановил платформу (нет токена, лимит и т. п.).
    stoppedReason: { type: String, default: null }
  },
  { _id: false }
);

const snapshotDaySchema = new Schema(
  {
    date: { type: String, required: true },
    lastPassAt: { type: Date },
    vk: { type: platformCoverageSchema, default: () => ({}) },
    youtube: { type: platformCoverageSchema, default: () => ({}) },
    telegram: { type: platformCoverageSchema, default: () => ({}) }
  },
  { timestamps: true }
);

snapshotDaySchema.index({ date: 1 }, { unique: true });

export const SnapshotDayModel = model('SnapshotDay', snapshotDaySchema);
