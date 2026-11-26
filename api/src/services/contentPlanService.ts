import mongoose from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { getTelegramBotStatus, resolveTelegramChannel } from './telegramBotClient.js';

export type ContentPlanChannelDto = {
  id: string;
  platform: 'vk' | 'telegram';
  title: string;
  handle: string;
  status: 'connected' | 'needs_reauth' | 'error';
  canPost: boolean;
  error: string;
};

function toDto(doc: { _id: mongoose.Types.ObjectId; platform: 'vk' | 'telegram'; title: string; handle?: string; status: 'connected' | 'needs_reauth' | 'error'; canPost: boolean; error?: string }): ContentPlanChannelDto {
  return {
    id: String(doc._id),
    platform: doc.platform,
    title: doc.title,
    handle: doc.handle ?? '',
    status: doc.status,
    canPost: doc.canPost,
    error: doc.error ?? ''
  };
}

export async function listChannels(userId: string): Promise<ContentPlanChannelDto[]> {
  const docs = await ContentPlanChannelModel.find({ userId }).sort({ createdAt: 1 }).lean();
  return docs.map(toDto);
}

export async function connectTelegramChannel(userId: string, ref: unknown): Promise<ContentPlanChannelDto> {
  const resolved = await resolveTelegramChannel(ref);
  const doc = await ContentPlanChannelModel.findOneAndUpdate(
    { userId, platform: 'telegram', externalId: resolved.externalId },
    {
      $set: {
        title: resolved.title,
        handle: resolved.handle,
        status: 'connected',
        canPost: true,
        lastCheckedAt: new Date(),
        error: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toDto(doc);
}

export async function deleteChannel(userId: string, id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
  const result = await ContentPlanChannelModel.deleteOne({ _id: id, userId });
  if (!result.deletedCount) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
}

export async function getPlanMeta(userId: string) {
  const [channels, telegramBot] = await Promise.all([listChannels(userId), getTelegramBotStatus()]);
  return {
    channels,
    posts: [],
    telegramBot
  };
}
