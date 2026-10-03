import { Schema, model } from 'mongoose';

// Счётчики свежей публикации на день среза: из них строится кривая набора
// просмотров (сколько пост набрал за 24/48/72 часа).
const postSnapshotSchema = new Schema(
  {
    platform: { type: String, enum: ['vk', 'youtube', 'telegram'], required: true },
    externalId: { type: String, required: true },
    postId: { type: String, required: true },
    date: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    hoursSincePublished: { type: Number, required: true },
    views: { type: Number, default: null },
    reactions: { type: Number, default: null },
    comments: { type: Number, default: null },
    forwards: { type: Number, default: null }
  },
  { timestamps: true }
);

postSnapshotSchema.index({ platform: 1, externalId: 1, postId: 1, date: 1 }, { unique: true });
postSnapshotSchema.index({ platform: 1, externalId: 1, date: 1 });

export const PostSnapshotModel = model('PostSnapshot', postSnapshotSchema);
