# Журнал миграции Socstat

В этом файле фиксируются результаты промптов, связанных с переездом проекта.

## 2026-08-23 - Начальный каркас React и Node.js

Запрос пользователя:

- Начать перенос старого проекта AngularJS/PHP Bitrix на React и Node.js.

Результат:

- Добавлены npm workspaces для `apps/api` и `apps/frontend`.
- Добавлен React/Vite shell с маршрутами dashboard, analytics, compare, posts, account и admin.
- Добавлен Express/TypeScript API shell.
- Добавлены новые маршруты `/api/*` и legacy-совместимые маршруты `/controllers/*/*.php`.
- Добавлены demo-данные пользователя и сохранённых групп во временное хранилище.
- Добавлен `apps/README.md` с инструкциями запуска.
- Добавлен `docs/migration-plan.md`.

Проверка:

- `npm install`
- `npm run build`
- Проверен health endpoint API.
- Проверен proxy с frontend на API.

Следующие шаги:

- Заменить временное хранилище на MongoDB и Mongoose.
- Добавить VK-авторизацию и хранение сессий.

## 2026-08-23 - Решение использовать MongoDB

Запрос пользователя:

- Использовать MongoDB как базу данных.

Решение:

- База backend будет MongoDB.
- ODM будет Mongoose.
- Основные коллекции: `users`, `sessions`, `vkTokens`, `savedGroups`, `payments`, `reports`, `news`.

Результат:

- Обновлён `docs/migration-plan.md`: добавлены MongoDB/Mongoose стек, коллекции, этапы миграции, локальная Docker-команда и стратегия переключения.

Проверка:

- Изменение только в документации.

Следующие шаги:

- Добавить зависимость Mongoose, модуль подключения, модели и dev seed.

## 2026-08-23 - Правило журнала миграции

Запрос пользователя:

- Добавить правило фиксировать результаты промптов по переезду.

Результат:

- Правило журнала добавлено в `docs/migration-plan.md`.
- Создан `docs/migration-log.md`.

Проверка:

- Изменение только в документации.

Следующие шаги:

- После каждого migration-related промпта добавлять запись в этот файл.

## 2026-08-23 - Русский язык документации

Запрос пользователя:

- Всё нужно писать на русском.

Решение:

- Документация по переезду и журнал миграции ведутся на русском языке.

Результат:

- `docs/migration-plan.md` переведён на русский.
- `docs/migration-log.md` переведён на русский.
- В правило журнала добавлено требование вести записи и документацию по переезду на русском языке.

Проверка:

- Изменение только в документации.

Следующие шаги:

- В дальнейших промптах по переезду фиксировать результаты в `docs/migration-log.md` на русском.

## 2026-08-23 - Подключение MongoDB и Mongoose

Запрос пользователя:

- Добавить MongoDB-фундамент для нового backend.

Решение:

- Используем `mongoose` в `apps/api`.
- API подключается к MongoDB перед запуском HTTP-сервера.
- Dev seed создаёт demo-пользователя, dev-сессию, сохранённые группы и новость, если база пустая.
- Старый временный dev store удалён, текущие account/groups routes читают данные через MongoDB.

Изменённые файлы:

- `apps/api/package.json`
- `apps/api/.env.example`
- `apps/api/src/config/env.ts`
- `apps/api/src/db/database.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/models/User.ts`
- `apps/api/src/models/Session.ts`
- `apps/api/src/models/SavedGroup.ts`
- `apps/api/src/models/Payment.ts`
- `apps/api/src/models/VkToken.ts`
- `apps/api/src/models/Report.ts`
- `apps/api/src/models/News.ts`
- `apps/api/src/repositories/accountRepository.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/account.ts`
- `apps/api/src/routes/legacy.ts`
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/store/devStore.ts`
- `apps/README.md`
- `docs/migration-plan.md`
- `package-lock.json`

Проверка:

- `npm install mongoose --workspace @socstat/api`
- `npm run build`

Следующие шаги:

- Поднять локальную MongoDB и проверить runtime endpoints через `npm run dev:api`.
- Перенести полноценную VK-авторизацию и хранение реальных сессий.

## 2026-08-23 - Gitignore для новых node_modules

Запрос пользователя:

- Добавить `node_modules` новых проектов в gitignore, чтобы они не попали в git.

Результат:

- В `.gitignore` добавлены явные правила для `apps/*/node_modules/`.

Проверка:

- До изменения `apps/api/node_modules/` и `apps/frontend/node_modules/` уже отображались как ignored.
- Явные правила добавлены для читаемости и защиты новых workspaces.

Следующие шаги:

- Перед коммитом проверить `git status --short --ignored apps`.
