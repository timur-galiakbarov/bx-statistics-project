import { Schema, model } from 'mongoose';

/**
 * Группа ВК или Telegram-канал, подключённые пользователем для публикации.
 * Для ВК источник доступа — VkToken пользователя, для Telegram — собственный бот пользователя.
 */
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, enum: ['vk', 'telegram'], required: true },
    externalId: { type: String, required: true },
    // Бот, которым подключён канал: при замене бота канал нужно проверить заново.
    botId: { type: Schema.Types.ObjectId, ref: 'ContentPlanBot', default: null, index: true },
    title: { type: String, required: true },
    handle: { type: String, default: '' },
    status: { type: String, enum: ['connected', 'needs_reauth', 'error'], default: 'connected' },
    canPost: { type: Boolean, default: true },
    lastCheckedAt: { type: Date, default: null },
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

schema.index({ userId: 1, platform: 1, externalId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: 1 });

export const ContentPlanChannelModel = model('ContentPlanChannel', schema);
