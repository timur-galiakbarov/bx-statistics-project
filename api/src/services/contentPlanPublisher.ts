import mongoose from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { ContentPlanPostModel } from '../models/ContentPlanPost.js';
import { toPostDto, type ContentPlanPostDto } from './contentPlanService.js';
import { markdownToTelegramHtml } from './contentPlanUtils.js';
import { sendTelegramMessage } from './telegramBotClient.js';

const MAX_AUTO_ATTEMPTS = 3;

async function failPost(post: any, error: DomainError) {
  const retryAt = error.code === 'TELEGRAM_RATE_LIMITED' ? new Date(Date.now() + 60_000) : null;
  await ContentPlanPostModel.updateOne(
    { _id: post._id },
    { $set: { status: 'failed', error: error.message, nextAttemptAt: retryAt } }
  );
}

async function sendAndUpdate(post: any): Promise<ContentPlanPostDto> {
  const channel = await ContentPlanChannelModel.findOne({ _id: post.channelId });
  if (!channel) {
    const error = new DomainError('Канал не найден. Подключите его снова.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
    await failPost(post, error);
    throw error;
  }
  if (channel.status !== 'connected' || !channel.canPost) {
    const error = new DomainError('Канал не подключён к публикации. Проверьте права бота.', { status: 409, code: 'CONTENT_PLAN_CHANNEL_NOT_READY' });
    await failPost(post, error);
    throw error;
  }

  try {
    const sent = await sendTelegramMessage(channel.externalId, channel.handle, markdownToTelegramHtml(post.text));
    const updated = await ContentPlanPostModel.findByIdAndUpdate(
      post._id,
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          externalPostId: String(sent.messageId),
          externalUrl: sent.url,
          error: '',
          nextAttemptAt: null
        }
      },
      { new: true }
    );
    await ContentPlanChannelModel.updateOne(
      { _id: channel._id },
      { $set: { status: 'connected', canPost: true, error: '', lastCheckedAt: new Date() } }
    );
    return toPostDto(updated);
  } catch (error) {
    const domain = error instanceof DomainError
      ? error
      : new DomainError('Telegram не подтвердил отправку. Проверьте канал перед повтором.', {
        status: 502,
        code: 'TELEGRAM_SEND_UNKNOWN'
      });
    await failPost(post, domain);

    if (domain.code === 'TELEGRAM_BOT_UNAUTHORIZED') {
      await ContentPlanChannelModel.updateOne(
        { _id: channel._id },
        { $set: { status: 'needs_reauth', canPost: false, error: domain.message, lastCheckedAt: new Date() } }
      );
    } else if (domain.code === 'TELEGRAM_BOT_NOT_ADMIN' || domain.code === 'TELEGRAM_CHANNEL_NOT_FOUND') {
      await ContentPlanChannelModel.updateOne(
        { _id: channel._id },
        { $set: { status: 'error', canPost: false, error: domain.message, lastCheckedAt: new Date() } }
      );
    }
    throw domain;
  }
}

/** Ручная публикация: разрешена для черновика, запланированного и упавшего поста. */
export async function publishNow(userId: string, postId: string): Promise<ContentPlanPostDto> {
  if (!mongoose.isValidObjectId(postId)) {
    throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
  }
  const post = await ContentPlanPostModel.findOneAndUpdate(
    { _id: postId, userId, status: { $in: ['draft', 'scheduled', 'failed'] } },
    { $set: { status: 'publishing', error: '' }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!post) {
    const existing = await ContentPlanPostModel.findOne({ _id: postId, userId }).lean();
    if (!existing) {
      throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
    }
    throw new DomainError('Пост уже публикуется или опубликован.', { status: 409, code: 'CONTENT_PLAN_POST_LOCKED' });
  }
  return sendAndUpdate(post);
}

/** Вызывается планировщиком: атомарно забирает созревший пост и отправляет. */
export async function publishDuePost(postId: string): Promise<ContentPlanPostDto | null> {
  const now = new Date();
  const post = await ContentPlanPostModel.findOneAndUpdate(
    {
      _id: postId,
      $or: [
        { status: 'scheduled', autoPublish: true, scheduledAt: { $lte: now } },
        { status: 'failed', nextAttemptAt: { $lte: now }, attempts: { $lt: MAX_AUTO_ATTEMPTS } }
      ]
    },
    { $set: { status: 'publishing', error: '' }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!post) return null;
  return sendAndUpdate(post);
}
