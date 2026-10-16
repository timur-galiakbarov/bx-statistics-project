import { Schema, model } from 'mongoose';

// id и access_hash публичного канала для сессии Telegram. С ними канал
// открывается без contacts.resolveUsername, у которого жёсткий суточный лимит.
// access_hash привязан к аккаунту сессии, поэтому записи хранятся отдельно для
// каждой сессии (`account`): main — TELEGRAM_SESSION, adcheck — TELEGRAM_ADCHECK_SESSION.
// После смены аккаунта записи устаревают и пересоздаются автоматически.
const telegramPeerSchema = new Schema(
  {
    account: { type: String, enum: ['main', 'adcheck'], default: 'main', required: true },
    username: { type: String, required: true },
    channelId: { type: String, required: true },
    accessHash: { type: String, required: true }
  },
  { timestamps: true }
);

telegramPeerSchema.index({ account: 1, username: 1 }, { unique: true });

export const TelegramPeerModel = model('TelegramPeer', telegramPeerSchema);
