import { Schema, model } from 'mongoose';

const savedGroupSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: {
      type: String,
      enum: ['free', 'bonus', 'bookmark', 'favorite', 'managed'],
      required: true,
      index: true
    },
    isTracked: { type: Boolean, default: true },
    platform: { type: String, enum: ['vk', 'youtube'], default: 'vk', required: true, index: true },
    externalId: { type: String, index: true },
    // Kept for zero-downtime compatibility with existing documents and legacy clients.
    vkGroupId: { type: String, required: true },
    name: { type: String, required: true },
    handle: { type: String },
    url: { type: String },
    photo: { type: String },
    membersCount: { type: Number }
  },
  { timestamps: true }
);

savedGroupSchema.index({ userId: 1, source: 1, vkGroupId: 1 }, { unique: true });
savedGroupSchema.index({ userId: 1, source: 1, platform: 1, externalId: 1 });

export const SavedGroupModel = model('SavedGroup', savedGroupSchema);
