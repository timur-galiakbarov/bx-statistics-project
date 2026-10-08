import { Schema, model } from 'mongoose';

// Подписка браузера на Web Push. У одного пользователя их может быть несколько (разные браузеры).
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String },
    lastSuccessAt: { type: Date }
  },
  { timestamps: true }
);

export const PushSubscriptionModel = model('PushSubscription', pushSubscriptionSchema);
