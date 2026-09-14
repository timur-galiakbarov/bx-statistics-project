# Socstat

Новая версия является основной частью репозитория:

- `/` — React + Vite фронтенд;
- `api/` — Node.js + Express API;
- `legacy/` — прежнее PHP/Bitrix-приложение.

## Установка зависимостей

Из корня проекта:

```bash
npm install
```

## MongoDB

Перед запуском API нужна MongoDB.

Локально её можно поднять через Docker:

```bash
npm run mongo:start
```

Остановить MongoDB:

```bash
npm run mongo:stop
```

Для API можно скопировать пример env-файла:

```bash
cp api/.env.example api/.env
```

По умолчанию API использует:

```env
MONGO_URI=mongodb://localhost:27017/socstat
```

При первом запуске API создаст demo-пользователя, dev-сессию и несколько тестовых записей, если база пустая.

## Запуск бэкенда

```bash
npm run dev:api
```

API будет доступен на:

```text
http://localhost:4000
```

Проверка:

```bash
curl http://localhost:4000/api/health
```

## Запуск фронта

В отдельном терминале:

```bash
npm run dev
```

Фронт будет доступен на:

```text
http://localhost:5173
```

Vite проксирует `/api` и `/controllers` на бэкенд.

## Запуск всего сразу

```bash
npm run dev
```

## Production-сборка

```bash
npm run build
```

Команда собирает API и фронтенд.

## Переменные окружения

Для API можно скопировать пример:

```bash
cp api/.env.example api/.env
```

Основные переменные:

- `PORT` - порт API, по умолчанию `4000`
- `WEB_ORIGIN` - адрес фронта для CORS, по умолчанию `http://localhost:5173`
- `SESSION_COOKIE` - имя cookie сессии
- `OAUTH_STATE_COOKIE` - имя cookie для проверки OAuth state
- `MONGO_URI` - строка подключения к MongoDB
- `MONGO_SERVER_SELECTION_TIMEOUT_MS` - таймаут подключения к MongoDB, по умолчанию `5000`
- `VK_CLIENT_ID` - ID VK-приложения
- `VK_CLIENT_SECRET` - секрет VK-приложения для обмена code на token
- `VK_AUTH_SCOPE` - права VK, по умолчанию `stats,groups,photos,video,offline`
- `VK_FORCE_REVOKE` - `1`, чтобы VK заново показал экран согласия и выдал token с обновлёнными правами
- `VK_REDIRECT_URL` - callback URL для VK OAuth
- `VK_PUBLIC_REDIRECT_URL` - публичный callback URL, который отправляется в VK authorize
- `VK_IMPLICIT_REDIRECT_URL` - frontend callback для legacy VK implicit flow
- `YOUTUBE_API_KEY` - серверный ключ YouTube Data API v3 (не должен попадать во frontend)
- `YOUTUBE_API_TIMEOUT_MS` - таймаут запросов к YouTube API, по умолчанию `10000`
- `YOUTUBE_CACHE_TTL_MS` - TTL кэша ответов YouTube API, по умолчанию `300000`
- `AUTH_SUCCESS_REDIRECT_URL` - куда вернуть пользователя после успешного входа
- `YOOMONEY_RECEIVER` - номер кошелька ЮMoney, который принимает платежи
- `YOOMONEY_NOTIFICATION_URL` - URL HTTP-уведомлений, который нужно указать в кабинете ЮMoney
- `YOOMONEY_SUCCESS_URL` - URL возврата пользователя после оплаты
- `YOOMONEY_NOTIFICATION_SECRET` - секрет HTTP-уведомлений ЮMoney для проверки подписи `sign` (HMAC-SHA256) в callback оплаты
- `ADMIN_VK_IDS` - список VK id администраторов через запятую, по умолчанию `30647716`

Настройки HTTP-уведомлений кошелька: [ЮMoney](https://yoomoney.ru/transfer/myservices/http-notification?lang=ru).

## Авторизация

Основные маршруты:

- `GET /api/auth/vk/start` - начать вход через VK
- `GET /api/auth/vk/callback` - callback VK OAuth
- `POST /api/auth/logout` - выйти
- `POST /api/auth/dev` - локальный dev-вход, доступен только не в production

После успешного входа API выставляет HTTP-only cookie `socstat_session`.

Для локального запуска через Vite proxy лучше использовать callback на frontend origin:

```env
VK_REDIRECT_URL=http://localhost:5173/api/auth/vk/callback
VK_PUBLIC_REDIRECT_URL=http://localhost:5173/api/auth/vk/callback
VK_IMPLICIT_REDIRECT_URL=http://localhost:5173/app/auth/vk/implicit-callback
```

Так OAuth state cookie ставится и читается на одном origin.

## VK API

Новый бэкенд-слой VK API берёт access token из MongoDB, из коллекции `vkTokens`.

Маршруты:

- `GET /api/vk/groups/search?q=...` - поиск групп
- `GET /api/vk/groups/:groupId` - информация о группе
- `GET /api/vk/groups/:groupId/stats?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` - статистика группы
- `GET /api/vk/groups/:groupId/wall` - записи стены
- `GET /api/vk/groups/:groupId/photos` - фотографии
- `GET /api/vk/groups/:groupId/videos` - видео

Если пользователь вошёл через dev-вход и у него нет VK token, API вернёт `VK_TOKEN_REQUIRED`.

## YouTube Data API

Публичная аналитика YouTube работает по серверному API key, без Google OAuth. В Google Cloud включите **YouTube Data API v3**, создайте API key, ограничьте его этим API и задайте:

```env
YOUTUBE_API_KEY=your-server-api-key
```

Ключ читается только API-приложением и не включается в Vite-конфигурацию или ответы frontend. Без ключа YouTube-маршруты возвращают `YOUTUBE_API_KEY_REQUIRED` (HTTP 503).

Маршруты:

- `GET /api/youtube/channels/search?q=...` — поиск по URL, `@handle`, channel ID или тексту;
- `GET /api/youtube/channels/resolve?q=...` — получить один канал;
- `GET /api/analytics/community/:channelId?platform=youtube&period=month` — аналитика канала;
- `GET /api/posts/analyze?platform=youtube&groupIds=UC...&period=month` — публикации;
- `GET /api/compare?platform=youtube&groupIds=UC...,UC...&period=month` — сравнение каналов.

История публикаций загружается через uploads playlist (`channels.list` → `playlistItems.list` → пакетные `videos.list`, до 50 ID в запросе). HTML-скрейпинг и `search.list` для истории не используются. `search.list` применяется только как fallback при текстовом поиске канала.

Ограничения публичного MVP: просмотры, лайки и комментарии видео — текущие накопительные значения, а период выбирает видео по `publishedAt`. Публичный API не даёт репосты, исторический прирост/отток подписчиков, охват, уникальных зрителей, удержание и источники трафика. Скрытые счётчики отображаются как «Недоступно»; Shorts учитываются как обычные видео.

## Legacy VK implicit flow

Для проверки совместимости со старым Socstat добавлен отдельный вход через VK token:

- `GET /api/auth/vk/implicit-start` - начать VK OAuth с `response_type=token`
- `/auth/vk/implicit-callback` - frontend callback, который читает token из URL fragment
- `POST /api/auth/vk/implicit-callback` - backend сохраняет user token и создаёт Socstat-сессию

В настройках VK-приложения нужно добавить redirect URL:

```text
http://localhost:5173/auth/vk/implicit-callback
```

После входа через кнопку `VK legacy token` проверьте права в `/admin` кнопкой `Получить permissions`.

## Оплата

Тарифы доступны через:

- `GET /api/payments/plans`

Создание платежа:

- `POST /api/payments/create`

Callback для уведомлений ЮMoney:

- `POST /api/payments/callback`

Для обработки callback обязательно нужно заполнить:

```env
YOOMONEY_NOTIFICATION_SECRET=...
```

Без этого секрета callback не будет продлевать оплаченный период доступа. В настройках кошелька ЮMoney включите HTTP-уведомления,
укажите `YOOMONEY_NOTIFICATION_URL` и используйте тот же секрет, что в `YOOMONEY_NOTIFICATION_SECRET`.
