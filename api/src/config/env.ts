import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  sessionCookie: process.env.SESSION_COOKIE ?? 'socstat_session',
  oauthStateCookie: process.env.OAUTH_STATE_COOKIE ?? 'socstat_oauth_state',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/socstat',
  mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? 5000),
  vkClientId: process.env.VK_CLIENT_ID ?? '5358505',
  vkClientSecret: process.env.VK_CLIENT_SECRET ?? '',
  // Сервисный ключ приложения: основной ключ ночных срезов VK, запросы идут от имени приложения.
  vkServiceKey: process.env.VK_SERVICE_KEY?.trim() ?? '',
  vkAuthScope: process.env.VK_AUTH_SCOPE ?? 'stats,groups,photos,video,offline',
  socstatVkGroupId: process.env.SOCSTAT_VK_GROUP_ID ?? '125792332',
  socstatVkGroupUrl: process.env.SOCSTAT_VK_GROUP_URL ?? 'https://vk.com/socstat',
  vkForceRevoke: process.env.VK_FORCE_REVOKE === '1',
  vkRedirectUrl: process.env.VK_REDIRECT_URL ?? 'http://localhost:4000/api/auth/vk/callback',
  vkPublicRedirectUrl:
    process.env.VK_PUBLIC_REDIRECT_URL ??
    process.env.VK_REDIRECT_URL ??
    'http://localhost:4000/api/auth/vk/callback',
  vkImplicitRedirectUrl:
    process.env.VK_IMPLICIT_REDIRECT_URL ?? 'http://localhost:5173/app/auth/vk/implicit-callback',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
  youtubeApiTimeoutMs: Number(process.env.YOUTUBE_API_TIMEOUT_MS ?? 10_000),
  youtubeCacheTtlMs: Number(process.env.YOUTUBE_CACHE_TTL_MS ?? 300_000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  telegramApiId: Number(process.env.TELEGRAM_API_ID ?? 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? '',
  telegramSession: process.env.TELEGRAM_SESSION ?? '',
  telegramProxyHost: process.env.TELEGRAM_PROXY_HOST?.trim() ?? '',
  telegramProxyPort: Number(process.env.TELEGRAM_PROXY_PORT ?? 0),
  telegramProxyUsername: process.env.TELEGRAM_PROXY_USERNAME ?? '',
  telegramProxyPassword: process.env.TELEGRAM_PROXY_PASSWORD ?? '',
  telegramProxyType: Number(process.env.TELEGRAM_PROXY_TYPE ?? 5),
  telegramCacheTtlMs: Number(process.env.TELEGRAM_CACHE_TTL_MS ?? 300_000),
  telegramMaxPosts: Number(process.env.TELEGRAM_MAX_POSTS ?? 2_000),
  telegramRequestIntervalMs: Number(process.env.TELEGRAM_REQUEST_INTERVAL_MS ?? 350),
  // Аренда слота MTProto в Redis продлевается, пока задача жива, поэтому короткая: после перезапуска API
  // слот убитого процесса освобождается быстро.
  telegramTaskLockTtlMs: Number(process.env.TELEGRAM_TASK_LOCK_TTL_MS ?? 120_000),
  // Задача MTProto дольше этого считается зависшей: очередь идёт дальше, клиент сессии переподключается.
  telegramTaskTimeoutMs: Number(process.env.TELEGRAM_TASK_TIMEOUT_MS ?? 300_000),
  telegramAnalyticsLockTtlMs: Number(process.env.TELEGRAM_ANALYTICS_LOCK_TTL_MS ?? 900_000),
  telegramAnalyticsWaitMs: Number(process.env.TELEGRAM_ANALYTICS_WAIT_MS ?? 120_000),
  telegramUserRequestsPerMinute: Number(process.env.TELEGRAM_USER_REQUESTS_PER_MINUTE ?? 20),
  telegramIpRequestsPerMinute: Number(process.env.TELEGRAM_IP_REQUESTS_PER_MINUTE ?? 60),
  telegramMediaRequestsPerMinute: Number(process.env.TELEGRAM_MEDIA_REQUESTS_PER_MINUTE ?? 30),
  telegramRefreshCooldownMs: Number(process.env.TELEGRAM_REFRESH_COOLDOWN_MS ?? 60_000),
  // Отдельная сессия для проверки каналов перед рекламой; пусто — проверки идут через TELEGRAM_SESSION.
  telegramAdCheckSession: process.env.TELEGRAM_ADCHECK_SESSION?.trim() ?? '',
  // Проверка канала перед рекламой: разных источников в сутки на пользователя, кэш результата
  // и суточный бюджет новых загрузок Telegram на весь сервис.
  adCheckDailyLimitFree: Number(process.env.AD_CHECK_DAILY_LIMIT_FREE ?? 5),
  adCheckDailyLimitPaid: Number(process.env.AD_CHECK_DAILY_LIMIT_PAID ?? 50),
  adCheckCacheTtlMs: Number(process.env.AD_CHECK_CACHE_TTL_MS ?? 12 * 3_600_000),
  adCheckTelegramMaxPerDay: Number(process.env.AD_CHECK_TELEGRAM_MAX_PER_DAY ?? 150),
  // DeepSeek: классификация сообществ и расширение темы в подборе площадок. Пустой ключ — подбор по простым правилам.
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? '',
  deepseekModel: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
  deepseekTimeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 25_000),
  // Подбор площадок VK: подборов в сутки на пользователя, сколько строк видно без тарифа, кэш выдачи,
  // суточный бюджет подборов с DeepSeek на весь сервис.
  placementDailyLimitFree: Number(process.env.PLACEMENT_DAILY_LIMIT_FREE ?? 1),
  placementDailyLimitPaid: Number(process.env.PLACEMENT_DAILY_LIMIT_PAID ?? 10),
  placementFreeRows: Number(process.env.PLACEMENT_FREE_ROWS ?? 5),
  placementSearchCacheTtlMs: Number(process.env.PLACEMENT_SEARCH_CACHE_TTL_MS ?? 24 * 3_600_000),
  placementAiEnabled: (process.env.PLACEMENT_AI_ENABLED ?? '1') === '1',
  placementAiMaxPerDay: Number(process.env.PLACEMENT_AI_MAX_PER_DAY ?? 300),
  // Ежедневные срезы подписчиков и публикаций. По умолчанию включены только в production.
  snapshotsEnabled: (process.env.SNAPSHOTS_ENABLED ?? (process.env.NODE_ENV === 'production' ? '1' : '0')) === '1',
  snapshotStartHour: Number(process.env.SNAPSHOT_START_HOUR ?? 3),
  snapshotPostWindowDays: Number(process.env.SNAPSHOT_POST_WINDOW_DAYS ?? 7),
  snapshotPostMaxAttempts: Number(process.env.SNAPSHOT_POST_MAX_ATTEMPTS ?? 5),
  snapshotTelegramDelayMs: Number(process.env.SNAPSHOT_TELEGRAM_DELAY_MS ?? 3_000),
  // Служебные VK-аккаунты (через запятую), чьи токены подхватывают срезы после сервисного ключа и админов.
  snapshotVkIds: (process.env.SNAPSHOT_VK_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  snapshotTelegramMaxPerRun: Number(process.env.SNAPSHOT_TELEGRAM_MAX_PER_RUN ?? 200),
  snapshotTelegramMaxPerDay: Number(process.env.SNAPSHOT_TELEGRAM_MAX_PER_DAY ?? 400),
  authSuccessRedirectUrl: process.env.AUTH_SUCCESS_REDIRECT_URL ?? 'http://localhost:5173/app/dashboard',
  yoomoneyReceiver: process.env.YOOMONEY_RECEIVER ?? '',
  yoomoneyNotificationUrl: process.env.YOOMONEY_NOTIFICATION_URL ?? 'http://localhost:4000/api/payments/callback',
  yoomoneySuccessUrl: process.env.YOOMONEY_SUCCESS_URL ?? 'http://localhost:5173/app/account?payment=success',
  yoomoneyNotificationSecret: process.env.YOOMONEY_NOTIFICATION_SECRET ?? '',
  // Web Push: ключи VAPID генерируются один раз (npx web-push generate-vapid-keys).
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:support@socstat.ru',
  // Напоминания об окончании доступа. По умолчанию включены только в production.
  pushRemindersEnabled: (process.env.PUSH_REMINDERS_ENABLED ?? (process.env.NODE_ENV === 'production' ? '1' : '0')) === '1',
  // Сообщения от сообщества socstat (SOCSTAT_VK_GROUP_ID): ключ сообщества с правом «сообщения»
  // и Callback API — строка подтверждения адреса и секретный ключ из настроек сообщества.
  vkGroupToken: process.env.VK_GROUP_TOKEN?.trim() ?? '',
  vkCallbackConfirmation: process.env.VK_CALLBACK_CONFIRMATION?.trim() ?? '',
  vkCallbackSecret: process.env.VK_CALLBACK_SECRET?.trim() ?? '',
  // Планировщик еженедельного отчёта. По умолчанию включён только в production; кому он уходит,
  // решает переключатель фичи в админке.
  weeklyReportsEnabled: (process.env.WEEKLY_REPORTS_ENABLED ?? (process.env.NODE_ENV === 'production' ? '1' : '0')) === '1',
  adminVkIds: (process.env.ADMIN_VK_IDS ?? '30647716')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  // Токен для выгрузки аналитики агентом без входа через VK (GET /api/account/admin/export). Пустой — доступ только из админки.
  adminExportToken: process.env.ADMIN_EXPORT_TOKEN?.trim() ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development'
};
