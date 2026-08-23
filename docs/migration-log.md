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

## 2026-08-23 - Runtime-проверка MongoDB слоя

Запрос пользователя:

- Проверить MongoDB-слой вживую.

Результат:

- Проверено, что MongoDB на `27017` не запущена.
- Проверено, что Docker daemon в текущем окружении недоступен.
- Проверено, что локальные команды `mongod`, `mongosh` и `mongo` не установлены.
- API запущен для проверки поведения без MongoDB.
- API ожидаемо не открыл HTTP-порт и упал на `ECONNREFUSED` к `localhost:27017`.
- Добавлена настройка `MONGO_SERVER_SELECTION_TIMEOUT_MS`, чтобы ошибка подключения появлялась быстро.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/db/database.ts`
- `apps/api/.env.example`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `lsof -i :27017`
- `docker ps --format '{{.Names}} {{.Ports}}'`
- `command -v mongod`
- `command -v mongosh`
- `command -v mongo`
- `npm run dev:api`
- `npm run build`

Следующие шаги:

- Поднять MongoDB локально через Docker Desktop или установленный `mongod`.
- После запуска MongoDB повторить проверку endpoints `/api/health`, `/api/account/me` и `/api/account/groups`.

## 2026-08-23 - Успешная проверка MongoDB runtime

Запрос пользователя:

- Повторить проверку после запуска MongoDB и API.

Результат:

- API успешно запустился на `http://localhost:4000`.
- Dev seed создал demo-пользователя и тестовые группы в MongoDB.
- `/api/health` вернул статус `ok`.
- `/api/account/me` вернул demo-пользователя из MongoDB.
- `/api/account/groups` вернул управляемую и бесплатную группы из MongoDB.

Проверка:

- `curl -s http://localhost:4000/api/health`
- `curl -s -H 'x-socstat-session: dev' http://localhost:4000/api/account/me`
- `curl -s -H 'x-socstat-session: dev' http://localhost:4000/api/account/groups`

Следующие шаги:

- Запустить frontend и проверить, что React shell читает профиль и группы через Vite proxy.
- После этого переходить к VK-авторизации и реальным сессиям.

## 2026-08-23 - Проверка frontend через Vite proxy

Запрос пользователя:

- Проверить, что запущенный frontend читает данные.

Результат:

- Vite frontend отвечает на `http://localhost:5173`.
- Запросы `/api/account/me` и `/api/account/groups` через порт `5173` успешно проксируются на API.
- React shell получает профиль demo-пользователя и группы из MongoDB через frontend dev server.

Проверка:

- `curl -s -I http://localhost:5173`
- `curl -s -H 'x-socstat-session: dev' http://localhost:5173/api/account/me`
- `curl -s -H 'x-socstat-session: dev' http://localhost:5173/api/account/groups`

Следующие шаги:

- Переходить к VK-авторизации и реальным сессиям.

## 2026-08-23 - VK OAuth skeleton и cookie-сессии

Запрос пользователя:

- Сделать следующий шаг после проверки MongoDB: перейти к авторизации и реальным сессиям.

Решение:

- Добавлены маршруты авторизации в `apps/api/src/routes/auth.ts`.
- Реальная сессия хранится в MongoDB и выдаётся через HTTP-only cookie.
- Фронт больше не отправляет постоянный dev-заголовок `x-socstat-session: dev`.
- Для локальной разработки добавлен `POST /api/auth/dev`, который создаёт cookie-сессию для demo-пользователя.
- Добавлены VK OAuth маршруты `GET /api/auth/vk/start` и `GET /api/auth/vk/callback`.

Изменённые файлы:

- `apps/api/.env.example`
- `apps/api/src/config/env.ts`
- `apps/api/src/repositories/accountRepository.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/account.ts`
- `apps/api/src/routes/legacy.ts`
- `apps/api/src/app.ts`
- `apps/frontend/src/api/client.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/pages/LoginPage.tsx`
- `apps/frontend/src/styles.css`
- `apps/README.md`

Проверка:

- `npm run build`
- `curl -s -o /tmp/socstat-no-cookie.json -w '%{http_code}' http://localhost:4000/api/account/me` вернул `401`.
- `curl -s -c /tmp/socstat-cookies.txt -X POST http://localhost:4000/api/auth/dev` создал dev-сессию.
- `curl -s -b /tmp/socstat-cookies.txt http://localhost:4000/api/account/me` вернул demo-пользователя.
- `curl -s -b /tmp/socstat-cookies.txt http://localhost:4000/api/account/groups` вернул группы.
- `curl -s -b /tmp/socstat-cookies.txt -X POST http://localhost:4000/api/auth/logout` удалил сессию.
- Повторный `/api/account/me` с той же cookie вернул `401`.

Ограничения проверки:

- VK OAuth callback не проверялся с реальным VK-приложением, потому что для этого нужны актуальные `VK_CLIENT_SECRET` и redirect URL в настройках VK.
- Проверка через `http://localhost:5173` не выполнена, потому что frontend dev server на момент проверки не отвечал.

Следующие шаги:

- Запустить frontend и проверить экран входа.
- Указать реальные `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URL`.
- Проверить полный VK OAuth flow в браузере.

## 2026-08-23 - Успешная проверка VK OAuth

Запрос пользователя:

- Проверить вход через VK после добавления `VK_CLIENT_SECRET`.

Результат:

- VK redirect URI настроен корректно.
- Callback дошёл до нового backend.
- После добавления `VK_CLIENT_SECRET` server-side OAuth flow сработал.
- Новый backend смог пройти обмен `code -> access_token`.

Проверка:

- Ручная проверка входа через VK в браузере.

Следующие шаги:

- Проверить, что после VK-входа frontend показывает кабинет без dev-входа.
- Начать перенос backend-слоя для VK API: группы, wall, stats, photos, video.

## 2026-08-23 - Gitignore для dist новых приложений

Запрос пользователя:

- Добавить в `.gitignore` пути `apps/api/dist` и `apps/frontend/dist`.

Результат:

- В `.gitignore` добавлены правила для `apps/api/dist/` и `apps/frontend/dist/`.

Проверка:

- Правила добавлены в файл `.gitignore`.

Следующие шаги:

- Если `dist` уже был добавлен в git index, удалить его из индекса отдельной командой `git rm --cached`, не удаляя локальные файлы.

## 2026-08-23 - Gitignore для env-файлов новых приложений

Запрос пользователя:

- Добавить `apps/api/.env` в `.gitignore`.

Результат:

- В `.gitignore` добавлены env-файлы для `apps/api` и `apps/frontend`.
- `.env.example` не игнорируется и остаётся шаблоном для git.
- `apps/api/.env` был снят с git index без удаления локального файла.
- `apps/api/.env.example` восстановлен как шаблон без секретов.

Проверка:

- Правила добавлены в `.gitignore`.
- `git status --short --ignored apps/api/.env apps/api/.env.example apps/frontend/.env`
- `git ls-files apps/api/.env apps/api/.env.example apps/frontend/.env apps/frontend/.env.example`

Следующие шаги:

- Перед коммитом убедиться, что `apps/api/.env` отображается только как ignored.
