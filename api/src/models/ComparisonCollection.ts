import { Schema, model } from 'mongoose';

const comparisonSourceSchema = new Schema({
  platform: { type: String, enum: ['vk', 'youtube', 'telegram'], required: true },
  externalId: { type: String, required: true },
  name: { type: String, required: true },
  handle: { type: String },
  photo: { type: String },
  membersCount: { type: Number }
}, { _id: false });

const comparisonCollectionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['comparison', 'posts'], default: 'comparison', index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  period: { type: String, enum: ['week', 'twoWeek', 'month'], default: 'month' },
  sources: { type: [comparisonSourceSchema], required: true }
}, { timestamps: true });

comparisonCollectionSchema.index({ userId: 1, purpose: 1, updatedAt: -1 });

export const ComparisonCollectionModel = model('ComparisonCollection', comparisonCollectionSchema);
