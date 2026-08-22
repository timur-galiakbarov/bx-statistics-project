# Приложения Socstat

Новый фронт и бэкенд лежат рядом со старым проектом:

- `apps/frontend` - React + Vite
- `apps/api` - Node.js + Express + TypeScript

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
cp apps/api/.env.example apps/api/.env
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
npm run dev:frontend
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

Команда собирает оба workspace: `apps/api` и `apps/frontend`.

## Переменные окружения

Для API можно скопировать пример:

```bash
cp apps/api/.env.example apps/api/.env
```

Основные переменные:

- `PORT` - порт API, по умолчанию `4000`
- `WEB_ORIGIN` - адрес фронта для CORS, по умолчанию `http://localhost:5173`
- `SESSION_COOKIE` - имя cookie сессии
- `MONGO_URI` - строка подключения к MongoDB
- `MONGO_SERVER_SELECTION_TIMEOUT_MS` - таймаут подключения к MongoDB, по умолчанию `5000`
- `VK_CLIENT_ID` - ID VK-приложения
