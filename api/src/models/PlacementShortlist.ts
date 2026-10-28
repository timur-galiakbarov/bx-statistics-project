import { Schema, model } from 'mongoose';

export const shortlistStatuses = ['new', 'contacted', 'answered', 'agreed', 'published', 'declined'] as const;

// Площадка в подборке пользователя: снимок строки подбора на момент добавления и его записи о переговорах.
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: Number, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  photo: { type: String, default: null },
  members: { type: Number, default: 0 },
  views: { type: Number, default: null },
  viewsToSubscribers: { type: Number, default: null },
  sellsAds: { type: String, default: 'unknown' },
  contacts: { type: [{ _id: false, label: String, url: String }], default: [] },
  messageUrl: { type: String, required: true },
  // Задача, из подбора по которой площадка добавлена: название своей группы или описание.
  task: { type: String, default: '' },
  status: { type: String, enum: shortlistStatuses, default: 'new' },
  price: { type: Number, default: null },
  note: { type: String, default: '' }
}, { timestamps: true });
schema.index({ userId: 1, groupId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
export const PlacementShortlistModel = model('PlacementShortlist', schema);
