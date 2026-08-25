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
docker run --name socstat-mongo -p 27017:27017 -d mongo:7
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
- `AUTH_SUCCESS_REDIRECT_URL` - куда вернуть пользователя после успешного входа
- `YOOMONEY_NOTIFICATION_SECRET` - секрет уведомлений ЮMoney для проверки `sha1_hash` в callback оплаты
- `ADMIN_VK_IDS` - список VK id администраторов через запятую, по умолчанию `30647716`

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
VK_IMPLICIT_REDIRECT_URL=http://localhost:5173/auth/vk/implicit-callback
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

Без этого секрета callback не будет продлевать подписку.
