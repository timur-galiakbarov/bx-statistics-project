import { Schema, model } from 'mongoose';

// Журнал сообщений сообщества VK. Уникальный ключ не даёт отправить один отчёт
// дважды, даже если планировщик сработал в двух репликах API одновременно.
const notificationDeliverySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, required: true },
    // Для еженедельного отчёта — дата понедельника по Москве (YYYY-MM-DD).
    periodKey: { type: String, required: true },
    // full — с доступом; locked — доступ закончился, только прирост подписчиков.
    variant: { type: String, enum: ['full', 'locked'] },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: { type: String },
    sentAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

notificationDeliverySchema.index({ userId: 1, kind: 1, periodKey: 1 }, { unique: true });
notificationDeliverySchema.index({ createdAt: -1 });

export const NotificationDeliveryModel = model('NotificationDelivery', notificationDeliverySchema);
