import { Schema, model } from 'mongoose';

const source = new Schema({
  groupId: { type: Number, required: true }, name: { type: String, required: true }, url: { type: String, required: true },
  description: { type: String, default: '' }, members: { type: Number, default: 0 },
  reason: { type: String, default: '' }, examples: { type: [String], default: [] },
  status: { type: String, enum: ['candidate', 'selected', 'excluded'], default: 'candidate' }
}, { _id: false });
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true }, brief: { type: String, required: true }, targetUrl: { type: String, default: '' },
  audience: { type: String, default: '' }, style: { type: String, default: '' }, exclusions: { type: String, default: '' },
  rubrics: { type: [{ _id: false, name: String, description: String }], default: [] },
  sources: { type: [source], default: [] },
  lastScan: { type: Date, default: null }, scanNotes: { type: [String], default: [] },
  // Общая блокировка между репликами и лимит дорогих операций на сутки.
  busyUntil: { type: Date, default: null }, usageDay: { type: String, default: '' }, usageCount: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ userId: 1, updatedAt: -1 });
export const ContentProjectModel = model('ContentProject', schema);
