import { Schema, model } from 'mongoose';

/**
 * Свой Telegram-бот пользователя для публикации. Токен хранится только
 * в зашифрованном виде и никогда не отдаётся в API.
 */
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    tokenEncrypted: { type: String, required: true },
    botId: { type: Number, required: true },
    username: { type: String, required: true },
    name: { type: String, default: '' },
    status: { type: String, enum: ['connected', 'needs_reauth', 'error'], default: 'connected' },
    lastCheckedAt: { type: Date, default: null },
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

export const ContentPlanBotModel = model('ContentPlanBot', schema);
