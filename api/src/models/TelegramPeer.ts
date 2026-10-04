import { Schema, model } from 'mongoose';

// id и access_hash публичного канала для сессии TELEGRAM_SESSION. С ними канал
// открывается без contacts.resolveUsername, у которого жёсткий суточный лимит.
// access_hash привязан к аккаунту сессии: после смены аккаунта записи
// устаревают и пересоздаются автоматически.
const telegramPeerSchema = new Schema(
  {
    username: { type: String, required: true },
    channelId: { type: String, required: true },
    accessHash: { type: String, required: true }
  },
  { timestamps: true }
);

telegramPeerSchema.index({ username: 1 }, { unique: true });

export const TelegramPeerModel = model('TelegramPeer', telegramPeerSchema);
