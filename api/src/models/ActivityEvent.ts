import { Schema, model } from 'mongoose';

export const activityEventTypes = [
  'login',
  'source_search',
  'group_added',
  'group_removed',
  'analytics_view',
  'compare_run',
  'posts_analyze',
  'collection_saved',
  'payment_started',
  // Клик по виджету конкурентов на главной; label — что именно нажали.
  'competitors_widget',
  'competitors_saved',
  // Уже зарегистрированный пользователь пришёл с рекламными метками.
  'ad_return',
  // Мягкий запрос на уведомления в браузере; label — shown / accepted / dismissed / denied.
  'push_prompt',
  // Клик по push-уведомлению; label — вид напоминания.
  'push_click'
] as const;

export type ActivityEventType = (typeof activityEventTypes)[number];

const activityEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visitId: { type: String },
    type: { type: String, enum: activityEventTypes, required: true },
    platform: { type: String },
    label: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

activityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 86_400, name: 'activity_event_ttl' });

export const ActivityEventModel = model('ActivityEvent', activityEventSchema);
