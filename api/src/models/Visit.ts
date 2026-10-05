import { Schema, model } from 'mongoose';

// Визит — серия просмотров страниц кабинета с перерывами не дольше 30 минут.
// Идентификатор генерирует фронт, длительность продлевают heartbeat-запросы.
const visitSchema = new Schema(
  {
    visitId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, required: true, index: true },
    lastSeenAt: { type: Date, required: true },
    pageViews: { type: Number, default: 0 },
    // Действия на сервере (добавление канала, запуск аналитики и т. п.) в рамках визита.
    actions: { type: Number, default: 0 },
    entryPath: { type: String },
    paths: [{ type: String }],
    device: { type: String, enum: ['mobile', 'desktop'] }
  },
  { versionKey: false }
);

visitSchema.index({ startedAt: 1 }, { expireAfterSeconds: 400 * 86_400, name: 'visit_ttl' });

export const VisitModel = model('Visit', visitSchema);
