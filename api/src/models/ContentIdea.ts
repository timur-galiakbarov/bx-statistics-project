import { Schema, model } from 'mongoose';
import { ideaStatuses } from '../services/contentUtils.js';

const reference = new Schema({
  key: String, sourceId: Number, sourceName: String, url: String, date: String, text: String,
  views: Number, actions: Number, relative: { type: Number, default: null }
}, { _id: false });
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true }, projectId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true }, title: String, rubric: String, reason: String, angle: String, checks: String,
  references: { type: [reference], default: [] }, status: { type: String, enum: ideaStatuses, default: 'new' },
  feedback: { type: String, default: '' }, draft: { type: String, default: '' }
}, { timestamps: true });
schema.index({ projectId: 1, key: 1 }, { unique: true });
schema.index({ userId: 1, projectId: 1, createdAt: -1 });
export const ContentIdeaModel = model('ContentIdea', schema);
