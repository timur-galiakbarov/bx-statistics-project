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
  'push_click',
  // Урезанный отчёт VK для пользователя без доступа.
  'analytics_preview',
  // Клик по закрытому блоку урезанного отчёта; label — какой блок.
  'preview_unlock',
  // Включили бесплатный полный отчёт без доступа; label — id источника.
  'report_pass_used',
  // Показали заглушку «доступ закончился»; label — youtube / telegram.
  'access_lock',
  // Проверка канала перед рекламой; label — источник. ad_check_limit — упёрлись в лимит проверок.
  'ad_check_run',
  'ad_check_limit',
  // Подбор площадок VK. placement_search — label «город|задача|ai или rules|строк|group или text»; placement_limit — упёрлись в лимит;
  // placement_select — добавили в подборку, label — id сообщества; остальные — клики, label из закрытого списка.
  'placement_search',
  'placement_limit',
  'placement_select',
  // Сменили статус площадки в подборке; label — новый статус.
  'placement_status',
  'placement_open',
  'placement_price',
  'placement_filter',
  'placement_paywall_click',
  // Нажали «Подключить» отчёт во VK; label — где: banner / dashboard / competitors / profile.
  'vk_report_connect'
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
