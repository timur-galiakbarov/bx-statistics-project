import { Schema, model } from 'mongoose';

// Журнал отправленных напоминаний. Уникальный ключ не даёт отправить одно и то же
// напоминание дважды для одной даты окончания доступа; после продления дата новая.
const pushDeliverySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, required: true },
    activeTo: { type: Date, required: true },
    delivered: { type: Number, default: 0 },
    clickedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

pushDeliverySchema.index({ userId: 1, kind: 1, activeTo: 1 }, { unique: true });
pushDeliverySchema.index({ userId: 1, createdAt: -1 });

export const PushDeliveryModel = model('PushDelivery', pushDeliverySchema);
