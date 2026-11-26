import { Schema, model } from 'mongoose';

export const contentPlanStatuses = ['draft', 'scheduled', 'publishing', 'published', 'failed'] as const;
export type ContentPlanStatus = (typeof contentPlanStatuses)[number];

/**
 * Запланированный или опубликованный пост. scheduledAt хранится в UTC,
 * timeZone — IANA-зона автора на момент планирования (для показа и DST).
 */
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'ContentPlanChannel', required: true, index: true },
    platform: { type: String, enum: ['vk', 'telegram'], required: true },
    title: { type: String, default: '' },
    text: { type: String, required: true },
    status: { type: String, enum: contentPlanStatuses, default: 'draft', index: true },
    scheduledAt: { type: Date, default: null },
    timeZone: { type: String, default: 'UTC' },
    autoPublish: { type: Boolean, default: true },
    publishedAt: { type: Date, default: null },
    externalPostId: { type: String, default: '' },
    externalUrl: { type: String, default: '' },
    error: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    sourceIdeaId: { type: Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

schema.index({ userId: 1, scheduledAt: 1 });
schema.index({ status: 1, nextAttemptAt: 1, scheduledAt: 1 });

export const ContentPlanPostModel = model('ContentPlanPost', schema);
