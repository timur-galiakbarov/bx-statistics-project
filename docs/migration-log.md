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

## 2026-08-23 - Бэкенд-слой VK API

Запрос пользователя:

- Перейти к этапу переноса backend-слоя VK API.

Результат:

- Добавлен общий VK API клиент `apps/api/src/services/vkClient.ts`.
- Добавлена нормализация VK-ошибок через `VkApiError`.
- Добавлены маршруты `apps/api/src/routes/vk.ts`.
- API берёт access token из MongoDB, из коллекции `vkTokens`.
- Подключён router `/api/vk`.
- В `apps/README.md` добавлено описание VK API routes.

Добавленные маршруты:

- `GET /api/vk/groups/search?q=...`
- `GET /api/vk/groups/:groupId`
- `GET /api/vk/groups/:groupId/stats`
- `GET /api/vk/groups/:groupId/wall`
- `GET /api/vk/groups/:groupId/photos`
- `GET /api/vk/groups/:groupId/videos`

Изменённые файлы:

- `apps/api/src/services/vkClient.ts`
- `apps/api/src/routes/vk.ts`
- `apps/api/src/repositories/accountRepository.ts`
- `apps/api/src/app.ts`
- `apps/api/src/routes/auth.ts`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- `curl -s -c /tmp/socstat-vk-cookies.txt -X POST http://localhost:4000/api/auth/dev`
- `curl -s -b /tmp/socstat-vk-cookies.txt 'http://localhost:4000/api/vk/groups/search?q=socstat'` вернул `VK_TOKEN_REQUIRED`.
- `curl -s -o /tmp/socstat-vk-no-cookie.json -w '%{http_code}' 'http://localhost:4000/api/vk/groups/search?q=socstat'` вернул `401`.

Ограничения проверки:

- Реальный вызов VK API нужно проверить после входа через VK, чтобы у пользователя был сохранённый `vkTokens.accessToken`.

Следующие шаги:

- Проверить `/api/vk/groups/search` в браузере после реального VK-входа.
- Начать подключать новый VK API слой к React-экрану поиска и добавления группы.

## 2026-08-23 - Успешная проверка VK API route

Запрос пользователя:

- Проверить новый backend-слой VK API после реального VK-входа.

Результат:

- В MongoDB найден сохранённый `vkTokens` для пользователя после VK OAuth.
- Найдена активная сессия этого пользователя.
- `/api/vk/groups/search?q=socstat` успешно отработал через новый backend-слой.
- Ответ VK API пришёл через Node backend со статусом `200`.
- Токены и session id в вывод не печатались.

Проверка:

- `curl -s -o /tmp/socstat-health.json -w '%{http_code}' http://localhost:4000/api/health`
- Node-скрипт подключился к MongoDB, нашёл пользователя с VK token и сделал локальный запрос к `/api/vk/groups/search?q=socstat`.

Итог проверки:

- `status: 200`
- `success: true`
- `dataKeys: ["count", "items"]`

Следующие шаги:

- Подключить `/api/vk/groups/search` к React-экрану поиска группы.
- Сделать добавление выбранной группы в `savedGroups`.

## 2026-08-23 - React-поиск и добавление VK-группы

Запрос пользователя:

- Подключить backend VK API к React-экрану поиска и добавления группы.

Результат:

- На dashboard добавлена форма поиска групп ВКонтакте.
- Фронт вызывает `GET /api/vk/groups/search?q=...`.
- Результаты поиска отображаются списком с названием, ссылочным именем и аватаром.
- Добавлена кнопка сохранения группы в бесплатные группы через `POST /api/account/groups/free`.
- После добавления фронт обновляет список групп через `onGroupsChanged`.
- Добавление группы на backend сделано идемпотентным: повторное добавление той же группы обновляет и возвращает существующую запись, а не падает из-за уникального индекса.

Изменённые файлы:

- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `apps/api/src/repositories/accountRepository.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Node-скрипт проверил путь `VK search -> POST /api/account/groups/free -> GET /api/account/groups`.
- Повторное добавление той же группы вернуло успешный ответ `201`, без ошибки уникального индекса.

Следующие шаги:

- Проверить новый UI вручную в браузере.
- Добавить удаление/управление сохранёнными группами.
- Начать перенос dashboard summary на новые VK endpoints.

## 2026-08-23 - Управление сохранёнными группами

Запрос пользователя:

- Начать следующий этап после поиска и добавления групп.

Решение:

- Сначала добавлено управление сохранёнными группами, потому что это закрывает базовый CRUD перед переносом summary dashboard.

Результат:

- Во фронтовый API client добавлен `apiDelete`.
- В блок бесплатных групп на dashboard добавлены кнопки открыть VK и удалить группу.
- Добавлено пустое состояние для списка бесплатных групп.
- Удаление вызывает `DELETE /api/account/groups/:groupId`.
- После удаления фронт обновляет список групп.

Изменённые файлы:

- `apps/frontend/src/api/client.ts`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Node-скрипт создал тестовую free-группу, удалил её через `DELETE /api/account/groups/:groupId` и проверил, что она больше не возвращается в `/api/account/groups`.

Итог runtime-проверки:

- `addStatus: 201`
- `deleteStatus: 200`
- `stillExists: false`
- `groupsStatus: 200`

Следующие шаги:

- Проверить удаление вручную в браузере.
- Начать перенос dashboard summary на новые VK endpoints.

## 2026-08-23 - Лимит бесплатных групп

Запрос пользователя:

- Количество бесплатных групп не может быть больше 3.

Решение:

- Ограничение добавлено на backend, чтобы правило нельзя было обойти с фронта.
- Повторное добавление уже существующей группы не считается новой четвёртой группой.
- Фронт теперь показывает текст ошибки из API, а не только `API 409`.

Результат:

- Добавлена доменная ошибка `DomainError`.
- В `addGroup` добавлена проверка лимита `free` групп.
- При превышении лимита API возвращает `409 FREE_GROUP_LIMIT_REACHED`.
- Текст ошибки: `Можно добавить не больше 3 бесплатных групп.`
- На frontend добавлен счётчик бесплатных групп `N из 3`.

Изменённые файлы:

- `apps/api/src/errors/domainError.ts`
- `apps/api/src/repositories/accountRepository.ts`
- `apps/api/src/app.ts`
- `apps/frontend/src/api/client.ts`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка через API: при двух существующих бесплатных группах третья добавилась, следующие попытки вернули `409 FREE_GROUP_LIMIT_REACHED`.

Итог runtime-проверки:

- `before: 2`
- `after: 3`
- первая попытка: `201`
- следующие попытки: `409 FREE_GROUP_LIMIT_REACHED`

Следующие шаги:

- Показать на фронте счётчик `доступно N из 3`.
- Начать перенос dashboard summary на новые VK endpoints.

## 2026-08-23 - Первый dashboard summary на backend

Запрос пользователя:

- Попробовать считать dashboard summary на backend.

Решение:

- Расчёт dashboard summary вынесен на backend.
- Фронт получает готовый DTO и только отображает таблицу.
- Ошибка VK по отдельной группе не роняет весь dashboard: ошибка возвращается внутри элемента группы.

Результат:

- Добавлен сервис `apps/api/src/services/dashboardService.ts`.
- Добавлен маршрут `GET /api/dashboard/summary?period=...`.
- Поддержаны периоды `today`, `yesterday`, `last7days`, `currentMonth`.
- Summary собирает данные из VK `groups.getById`, `stats.get`, `wall.get`.
- Фронт dashboard подключён к `/api/dashboard/summary`.
- Добавлены переключатели периода и таблица метрик: участники, прирост, посещения, охват, активность.
- Исправлено форматирование дат периода без UTC-сдвига.

Изменённые файлы:

- `apps/api/src/services/dashboardService.ts`
- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/app.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `GET /api/dashboard/summary?period=last7days` через активную VK-сессию.

Итог runtime-проверки:

- `status: 200`
- `success: true`
- `period: 2026-08-16 - 2026-08-23`
- `groupsCount: 3`
- первая группа вернулась без ошибки VK

Следующие шаги:

- Проверить dashboard UI вручную в браузере.
- Добавить кэширование summary, чтобы не делать VK-запросы при каждом открытии страницы.
- Уточнить формулы метрик по старому dashboard и расширить wall pagination.

## 2026-08-23 - Обработка VK rate limit

Запрос пользователя:

- На dashboard появилась ошибка `too many requests per second`.

Причина:

- Dashboard summary делал `Promise.all` по группам.
- Внутри каждой группы параллельно выполнялись `stats.get` и `wall.get`.
- Для нескольких групп это создавало всплеск запросов на один пользовательский VK token.

Решение:

- В `vkClient` добавлен retry для VK `error_code: 6`.
- Retry использует backoff `450ms`, `900ms`, `1500ms`.
- Dashboard summary теперь обрабатывает группы последовательно.
- Между тяжёлыми VK-запросами добавлены небольшие паузы.

Изменённые файлы:

- `apps/api/src/services/vkClient.ts`
- `apps/api/src/services/dashboardService.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `GET /api/dashboard/summary?period=last7days` через активную VK-сессию.

Итог runtime-проверки:

- `status: 200`
- `success: true`
- `groupsCount: 3`
- `errors: []`
- время ответа около `5.3s`

Следующие шаги:

- Добавить кэш dashboard summary.
- Добавить refresh cooldown, чтобы пользователь не мог спамить обновление.

## 2026-08-23 - Уточнение источника групп dashboard

Запрос пользователя:

- Уточнить, что блок `Статистика моих сообществ` должен показывать именно мои сообщества, то есть сообщества с админским доступом, а не сохранённые/free-группы.

Найденная старая логика:

- Старый dashboard вызывает VK `groups.get`.
- Параметры: `extended: 1`, `filter: "moder"`, `count: 100`, `fields: "members_count"`.
- Полученный список записывался в `adminGroups`.
- `statList` использовался только как выбранный subset этих admin/moder групп.

Решение:

- `GET /api/dashboard/summary` теперь берёт группы через VK `groups.get` с `filter: "moder"`.
- `savedGroups` больше не используются как источник для блока `Статистика моих сообществ`.
- Бесплатные группы остаются отдельным блоком dashboard.
- Ошибка `VK_GROUP_NOT_FOUND` теперь не прерывает весь summary.

Изменённые файлы:

- `apps/api/src/services/dashboardService.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `GET /api/dashboard/summary?period=last7days` через активную VK-сессию.

Итог runtime-проверки:

- `status: 200`
- `success: true`
- `groupsCount: 7`
- первые группы вернулись с `source: managed`
- `errors: 0`

Следующие шаги:

- Добавить сохранение выбранного subset admin-групп, аналог старого `statList`.
- Добавить кэширование dashboard summary.

## 2026-08-23 - Уточнение нулевых метрик dashboard

Запрос пользователя:

- Проверить, правильно ли считаются столбцы `Прирост`, `Посещения`, `Охват`, `Активность`, потому что они выглядят нулевыми.

Проверка старой логики:

- Старый mapper `stats.get` превращал VK поля в `subscribed`, `unsubscribed`, `reach`, `reach_subscribers`, `views`, `visitors`.
- Старый `calculateStat` суммировал эти поля.
- Старый `calculateWallStat` суммировал лайки, репосты и комментарии по постам за выбранный период.

Найденные причины нулей:

- Для первой managed-группы VK `stats.get` вернул `error_code: 7`, `Permission to perform this action is denied`.
- Старый код в таком случае тоже подставлял пустую статистику.
- `wall.get` по первой группе вернул посты, но последние посты старые и не попали в выбранный период, поэтому активность за период равна нулю.
- Период `last7days` в новой версии был на день шире старого поведения.

Решение:

- `last7days` исправлен на сегодня + 6 предыдущих дней, как в старом dashboard.
- Если VK не отдаёт `stats.get` с `error_code: 7`, summary добавляет предупреждение `Статистика группы недоступна в VK.`
- Фронт показывает предупреждения по группе рядом с названием.

Изменённые файлы:

- `apps/api/src/services/dashboardService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `GET /api/dashboard/summary?period=last7days`.

Итог runtime-проверки:

- `period: 2026-08-17 - 2026-08-23`
- `groupsCount: 7`
- первая группа вернула warning `Статистика группы недоступна в VK.`
- метрики stats по этой группе остались нулевыми из-за недоступности VK stats.

Следующие шаги:

- Проверить группы, где VK `stats.get` доступен, чтобы сравнить численные метрики со старым dashboard.
- Добавить отдельный UI-статус для недоступной статистики, чтобы визуально отличать `0` от `нет доступа`.

## 2026-08-23 - Диагностика прав VK token

Запрос пользователя:

- Уточнить, почему `stats.get` недоступен, если раньше работал; возможно, новый token запрошен с другими правами.

Результат диагностики:

- Текущий сохранённый VK token проверен через `account.getAppPermissions`.
- VK вернул permission mask `20`.
- Расшифровка mask `20`: `photos: true`, `video: true`.
- В текущем token отсутствуют `groups`, `stats`, `wall`, `offline`.
- Это объясняет ошибку `stats.get`: token действительно не содержит права `stats`.
- Ранее в Mongo сохранялись ожидаемые scopes, а не фактические scopes из VK token response.

Решение:

- В OAuth start добавлен scope `offline`, как в старом flow.
- Добавлен endpoint `GET /api/vk/permissions` для диагностики прав текущего token.
- Сохранение token scopes исправлено: теперь backend сохраняет фактический `scope` из ответа VK.
- Если VK вернёт numeric permission mask, backend расшифрует его в список scopes.

Изменённые файлы:

- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/vk.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Прямая диагностика текущего token через `account.getAppPermissions` без вывода token.

Следующие шаги:

- Перезапустить API.
- Выйти и заново войти через VK, чтобы получить token с обновлёнными scopes.
- Проверить `GET /api/vk/permissions`: `stats`, `groups`, `wall` должны стать `true`.
- После этого повторить `GET /api/dashboard/summary`.

## 2026-08-23 - Кнопка logout во фронте

Запрос пользователя:

- Сделать кнопку logout.

Результат:

- В верхнюю панель React-приложения добавлена icon-кнопка выхода.
- Кнопка вызывает `POST /api/auth/logout`.
- После успешного выхода frontend очищает пользователя и группы и показывает экран входа.

Изменённые файлы:

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- `POST /api/auth/dev` создал cookie-сессию.
- `/api/account/me` с cookie вернул `200`.
- `POST /api/auth/logout` вернул `success: true`.
- Повторный `/api/account/me` с той же cookie вернул `401`.

Следующие шаги:

- Проверить logout вручную в браузере.

## 2026-08-23 - Исправление OAuth state для локального callback

Запрос пользователя:

- После повторного входа через VK возникла ошибка `INVALID_OAUTH_STATE`.

Причина:

- Callback пришёл без совпадающей OAuth state cookie.
- Для локальной разработки это чаще всего происходит, когда старт авторизации и callback идут через разные origin/host, например frontend proxy на `localhost:5173`, а redirect URL на `localhost:4000`, либо используется смесь `localhost`, `127.0.0.1` и LAN IP.

Решение:

- Добавлен `VK_PUBLIC_REDIRECT_URL`.
- В authorize-запрос к VK теперь отправляется `VK_PUBLIC_REDIRECT_URL`.
- В token exchange используется тот же public redirect URL.
- В `.env.example` локальный callback переведён на frontend origin через Vite proxy: `http://localhost:5173/api/auth/vk/callback`.
- В README добавлено пояснение, что OAuth state cookie должна ставиться и читаться на одном origin.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/.env.example`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Проверен текущий redirect запущенного API: он всё ещё использует старый `localhost:4000`, значит API нужно перезапустить после обновления `.env`.

Следующие шаги:

- Обновить `apps/api/.env`.
- Добавить новый callback URL в настройках VK-приложения.
- Перезапустить API.
- Повторить вход через VK.

## 2026-08-23 - Принудительное обновление VK permissions

Запрос пользователя:

- После успешной авторизации token всё ещё не получил нужные права `groups`, `stats`, `wall`.

Диагностика:

- Текущий authorize URL содержит scope `groups,stats,photos,video,wall,offline`.
- Проверка текущего token через `account.getAppPermissions` показала, что VK выдал только `photos` и `video`.
- Вероятная причина: VK не пере-показал экран согласия для уже авторизованного приложения и вернул token со старыми правами.

Решение:

- Добавлена переменная `VK_AUTH_SCOPE`.
- Добавлена переменная `VK_FORCE_REVOKE`.
- Если `VK_FORCE_REVOKE=1`, backend добавляет `revoke=1` в authorize URL, чтобы VK заново запросил согласие и выдал token с обновлёнными правами.
- В `.env.example` добавлен рекомендуемый scope `stats,groups,photos,video,wall,offline`.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/.env.example`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- В `apps/api/.env` поставить `VK_AUTH_SCOPE=stats,groups,photos,video,wall,offline`.
- В `apps/api/.env` поставить `VK_FORCE_REVOKE=1`.
- Перезапустить API.
- Выйти и заново войти через VK.
- Проверить `GET /api/vk/permissions`.

## 2026-08-23 - Подтверждение ограничения VK permissions

Запрос пользователя:

- Проверить результат повторной авторизации через VK после `VK_FORCE_REVOKE=1`.

Результат:

- Повторная авторизация прошла успешно.
- `GET /api/vk/permissions` вернул mask `65556`.
- Расшифровка mask: `photos: true`, `video: true`, `offline: true`.
- Права `groups`, `stats`, `wall` всё ещё не выданы.

Вывод:

- Проблема не в потере OAuth state и не в отсутствии `revoke=1`.
- VK фильтрует запрошенные права для текущего типа приложения/способа авторизации.
- Старый Socstat работал через implicit flow `response_type=token`, где token приходил в браузер.
- Новый server-side code flow не эквивалентен старому flow по выдаваемым правам.

Следующие варианты:

- Проверить настройки типа VK-приложения и доступность scopes для текущей платформы.
- Рассмотреть legacy-compatible implicit flow для получения пользовательского token, если VK не выдаёт нужные права через server-side code flow.
- Перед финальным решением изучить ограничения VK по user scopes для сайта/server-side OAuth.

## 2026-08-23 - Уточнение backend-запросов к VK с пользовательским token

Запрос пользователя:

- Уточнить, можно ли получить браузерный token, сохранить его на backend и продолжать выполнять запросы к VK API с backend.
- Проверить официальную документацию по `stats.get`, а не опираться только на поведение старого фронта.

Найдено в старом Socstat:

- `login/index.php` использовал VK OAuth `response_type=token`.
- Старый scope: `stats,groups,photos,video,offline`.
- `front/src/js/bl/stat/statDataContext.js` вызывал `https://api.vk.com/method/stats.get` из браузера с пользовательским `access_token`.

Проверка документации:

- Официальная схема VK API для `stats.get` указывает `access_token_type: ["user"]`.
- Значит для `stats.get` нужен пользовательский access token.
- Service token или community token для этого метода не подходят.

Вывод:

- Запросы к `stats.get` можно выполнять с backend, если backend использует действующий пользовательский token с правом `stats` и пользователь имеет доступ к статистике сообщества.
- VK не должен отклонять запрос только из-за того, что он отправлен с backend, потому что API-запрос авторизуется token, а не браузером.
- Текущая проблема в том, что server-side code flow выдал token без `groups`, `stats`, `wall`.

Следующие варианты:

- Оставить backend как единый слой VK API, но получить пользовательский token способом, который реально выдаёт нужные права.
- Проверить legacy-compatible implicit flow и сразу после входа проверить `account.getAppPermissions`.
- Если implicit flow тоже не выдаст `stats`, дальше смотреть настройки VK-приложения, тип платформы и ограничения/модерацию прав.

## 2026-08-23 - Повторный INVALID_OAUTH_STATE

Запрос пользователя:

- После повторной попытки входа VK снова вернул `{"success":false,"error":"INVALID_OAUTH_STATE"}`.

Причина:

- В локальном `apps/api/.env` callback всё ещё был настроен на `http://localhost:4000/api/auth/vk/callback`.
- Текущая локальная схема рассчитана на вход через frontend `http://localhost:5173`, где Vite proxy прокидывает `/api` на backend.
- При смеси origin/host cookie `socstat_oauth_state` может не оказаться в callback-запросе.

Решение:

- В `apps/api/.env` callback URL переведён на `http://localhost:5173/api/auth/vk/callback`.
- Добавлен `VK_PUBLIC_REDIRECT_URL=http://localhost:5173/api/auth/vk/callback`.
- Ошибка `INVALID_OAUTH_STATE` теперь возвращает безопасные диагностические поля: пришёл ли `code`, пришёл ли `state`, была ли state-cookie, совпала ли она, host callback и ожидаемый callback URL.

Изменённые файлы:

- `apps/api/.env`
- `apps/api/src/routes/auth.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API, потому что `.env` читается только при старте процесса.
- Убедиться, что в настройках VK-приложения добавлен callback `http://localhost:5173/api/auth/vk/callback`.
- Начинать вход именно с `http://localhost:5173`, не с `127.0.0.1` и не напрямую с `localhost:4000`.

## 2026-08-23 - Debug-панель permissions в админке

Запрос пользователя:

- Добавить на страницу админки debug-панель.
- В панели должна быть кнопка, которая возвращает текущие VK permissions.

Решение:

- Вместо заглушки `/admin` добавлена страница `AdminPage`.
- В debug-панель добавлена кнопка `Получить permissions`.
- Кнопка вызывает `GET /api/vk/permissions`.
- Результат показывается в виде краткой сводки по `mask` и dashboard-правам, а также полным JSON.
- Добавлены состояния загрузки и ошибки.

Изменённые файлы:

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AdminPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Запустить frontend и API.
- Открыть `/admin`.
- Нажать `Получить permissions` после VK-авторизации.

## 2026-08-23 - Гипотеза о типе VK-приложения

Запрос пользователя:

- Проверить гипотезу, что `groups`, `stats`, `wall` не выдаются из-за неправильного типа VK-приложения.

Наблюдение:

- После повторных авторизаций текущий token стабильно получает mask `65556`.
- Это соответствует только `photos`, `video`, `offline`.
- Запрошенные права `groups`, `stats`, `wall` VK не выдаёт.

Проверка документации:

- В официальной схеме VK API `stats.get` требует `access_token_type: ["user"]`.
- В официальной схеме VK API перечислены типы приложений, включая `site` и `standalone`.
- В списке user scopes есть `groups`, `stats`, `wall`.

Вывод:

- Гипотеза о неверном типе приложения правдоподобна.
- Для миграции старого Socstat нужно проверить тип текущего приложения `5358505` в кабинете VK.
- Если приложение имеет тип `site`, стоит протестировать отдельное приложение типа `standalone` и implicit flow `response_type=token`.

Следующие шаги:

- Проверить тип текущего приложения в VK Apps Manage.
- Если возможно, создать тестовое VK-приложение типа `standalone`.
- Подставить его `client_id` в `.env` и проверить permissions через debug-панель.

## 2026-08-23 - Debug-проверка информации о VK-приложении

Запрос пользователя:

- Добавить в админскую debug-панель проверку информации о текущем VK-приложении.

Решение:

- Добавлен backend endpoint `GET /api/vk/app`.
- Endpoint вызывает VK `apps.get` для текущего `VK_CLIENT_ID`.
- В админке добавлена кнопка `Информация о приложении`.
- Результат показывает краткую сводку `title`, `type`, `id` и полный JSON.

Изменённые файлы:

- `apps/api/src/routes/vk.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AdminPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API.
- Открыть `/admin`.
- Нажать `Информация о приложении`.
- Проверить поле `type`; если там `site`, протестировать отдельное VK-приложение типа `standalone`.

## 2026-08-23 - Legacy-compatible VK implicit flow

Запрос пользователя:

- После подтверждения, что VK-приложение имеет тип `standalone`, добавить проверку старого способа авторизации через `response_type=token`.

Причина:

- Текущий server-side OAuth code flow стабильно выдаёт mask `65556`.
- Это только `photos`, `video`, `offline`.
- Старый Socstat использовал implicit flow `response_type=token`.

Решение:

- Добавлена переменная `VK_IMPLICIT_REDIRECT_URL`.
- Добавлен backend route `GET /api/auth/vk/implicit-start`.
- Route отправляет пользователя в VK OAuth с `response_type=token`, текущим `VK_AUTH_SCOPE`, `state` и опциональным `revoke=1`.
- Добавлен backend route `POST /api/auth/vk/implicit-callback`.
- Frontend callback читает token из URL fragment и отправляет его на backend.
- Backend сверяет `state` с HTTP-only cookie, проверяет token через `users.get`, сохраняет token в Mongo и создаёт Socstat-сессию.
- На странице входа добавлена кнопка `VK legacy token`.
- Добавлена frontend-страница `/auth/vk/implicit-callback`.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/.env`
- `apps/api/.env.example`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/pages/LoginPage.tsx`
- `apps/frontend/src/pages/VkImplicitCallbackPage.tsx`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API и frontend.
- В настройках VK-приложения добавить redirect URL `http://localhost:5173/auth/vk/implicit-callback`.
- Открыть `http://localhost:5173`.
- Войти через кнопку `VK legacy token`.
- В `/admin` нажать `Получить permissions` и проверить, появились ли `groups`, `stats`, `wall`.

## 2026-08-23 - Повторный mask 65556 после implicit flow

Запрос пользователя:

- После входа через legacy implicit flow permissions снова вернули mask `65556`.

Наблюдение:

- Mask снова соответствует только `photos`, `video`, `offline`.
- В локальном `apps/api/.env` не были явно заданы `VK_AUTH_SCOPE` и `VK_FORCE_REVOKE`.
- `VK_AUTH_SCOPE` в коде имеет корректный default, но `VK_FORCE_REVOKE` без env остаётся `false`.

Вывод:

- VK мог переиспользовать ранее выданные права приложения и не показать повторный экран согласия.
- Для проверки implicit flow нужно обязательно включить `revoke=1`.

Решение:

- В локальный `apps/api/.env` добавлены:
  - `VK_AUTH_SCOPE=stats,groups,photos,video,wall,offline`
  - `VK_FORCE_REVOKE=1`

Следующие шаги:

- Перезапустить API.
- Выйти из приложения.
- Войти через `VK legacy token`.
- На экране VK проверить, что запрашиваются права на статистику/сообщества/стену.
- Снова проверить `/admin` -> `Получить permissions`.

## 2026-08-23 - Сравнение с рабочим production Socstat

Запрос пользователя:

- Пользователь уточнил, что текущий `socstat.ru` работает и там нужные права VK выдаются.

Найдено в старом Socstat:

- Production использует тот же `client_id=5358505`.
- VK-приложение имеет тип `standalone`.
- Рабочий production authorize URL:
  - `response_type=token`
  - `scope=stats,groups,photos,video,offline`
  - `redirect_uri=https://socstat.ru/login/getCode.php?site=auth`
- Старый flow через `login/getCode.php` переносит URL fragment в query string и передаёт token в `login/vkAuth.php`.
- `login/vkAuth.php` сохраняет `access_token` в Bitrix user field `UF_VK_TOKEN`.

Вывод:

- Проблема не в VK-приложении как таковом.
- Проблема, вероятнее всего, в отличиях нового локального OAuth flow от production:
  - локальный redirect на `http://localhost:5173/...`;
  - новый scope ранее включал лишний `wall`;
  - production использует HTTPS-домен `socstat.ru`.

Решение:

- Default `VK_AUTH_SCOPE` приведён к старому production scope: `stats,groups,photos,video,offline`.
- Локальный `apps/api/.env` и `.env.example` обновлены на тот же scope.
- В админскую debug-панель добавлена кнопка `OAuth debug`.
- Добавлен endpoint `GET /api/vk/oauth-debug`.
- Debug показывает текущие OAuth settings, локальные authorize URL и production legacy authorize URL.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/vk.ts`
- `apps/api/.env`
- `apps/api/.env.example`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AdminPage.tsx`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API.
- В `/admin` нажать `OAuth debug`.
- Сравнить локальный `implicitAuthorizeUrl` с `productionLegacyAuthorizeUrl`.
- Если локальный URL корректен, но permissions всё равно урезаны, тестировать callback на HTTPS-домене, максимально похожем на production.

## 2026-08-23 - Поиск информации по VK OAuth permissions

Запрос пользователя:

- Найти информацию в интернете по причине, почему локальный OAuth не выдаёт `stats/groups`, хотя текущий `socstat.ru` работает.

Найдено:

- В официальной VK API schema метод `stats.get` требует `access_token_type: ["user"]`.
- В официальной VK API schema ошибка `api_error_method_permission`, code `20`, описана как запрет действия для non-standalone приложений.
- В официальной VK API schema есть ошибка `api_error_auth_https`, code `16`, `HTTP authorization failed`.
- В SDK/обсуждениях вокруг VK API повторяется практическая рекомендация: для standalone-токенов и методов, доступных только standalone-приложениям, использовать `redirect_uri=https://oauth.vk.com/blank.html`.

Вывод:

- Прямого официального подтверждения “localhost режет scopes `stats/groups`” не найдено.
- Более сильная гипотеза: для standalone-sensitive методов локальный custom redirect может давать ограниченный token, а правильный тестовый flow должен использовать `https://oauth.vk.com/blank.html`.
- Так как production Socstat с `https://socstat.ru/login/getCode.php?site=auth` работает, нужно отдельно проверить, является ли это сохранённым legacy-поведением/разрешением старого приложения или там реально каждый раз выдаётся новый token с `stats/groups`.

Следующие шаги:

- Добавить отдельный debug/manual flow для `redirect_uri=https://oauth.vk.com/blank.html`.
- Пользователь вручную скопирует fragment/token с blank.html в debug-панель.
- Backend сохранит token и проверит `account.getAppPermissions`.

## 2026-08-23 - Ручная проверка произвольного VK token

Запрос пользователя:

- Добавить в debug-панель возможность проверить token из старого `socstat.ru` или другого VK OAuth flow.

Решение:

- Добавлен backend endpoint `POST /api/vk/debug/permissions`.
- Endpoint принимает `accessToken`, вызывает `account.getAppPermissions` и возвращает mask с расшифровкой.
- Добавлен backend endpoint `POST /api/vk/debug/stats`.
- Endpoint принимает `accessToken` и `groupId`, вызывает `stats.get` за последние два дня и возвращает сырой ответ VK или точную VK-ошибку через общий обработчик.
- Token в этом debug-сценарии не сохраняется в Mongo.
- В админке добавлен блок `Ручная проверка VK token`.
- Добавлены поля для token и ID сообщества.
- Добавлены кнопки `Проверить permissions` и `Проверить stats.get`.

Изменённые файлы:

- `apps/api/src/routes/vk.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AdminPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API и frontend.
- Получить token из старого `socstat.ru` после авторизации.
- Вставить token в `/admin`.
- Проверить permissions.
- Указать ID администрируемого сообщества и проверить `stats.get`.

## 2026-08-23 - Первый срез страницы “Анализ сообществ”

Запрос пользователя:

- Основной раздел миграции не dashboard, а страница `Анализ сообществ`.
- Начать перенос этого раздела.

Изученные старые файлы:

- `front/src/js/route.js`
- `front/src/js/ui/analytics/controllers/analyticsDashboardController.js`
- `front/src/js/ui/analytics/controllers/analyticsDashboardController.html`
- `front/src/js/ui/analytics/controllers/commonAnalytics/commonAnalyticsController.js`
- `front/src/js/ui/analytics/controllers/commonAnalytics/commonAnalyticsController.html`
- `front/src/js/ui/app/factories/vkApi/vkApiFactory.js`

Что было в старом flow:

- `/analytics` - выбор сообщества через поиск или список групп пользователя.
- `/analytics/group/:gid` - детальная аналитика сообщества.
- Детальная аналитика грузила:
  - `groups.getById`
  - `stats.get`
  - `wall.get`
  - `photos.getAll`
  - `photos.getAllComments`
  - `video.get`
- `stats.get` отвечал за прирост, посещения и охват.
- `wall.get` отвечал за публикации, реакции, ER и топ постов.

Решение:

- Добавлен backend service `analyticsService`.
- Добавлен route `GET /api/analytics/community/:groupId`.
- Первый backend-срез собирает:
  - период `week`, `twoWeek`, `month`;
  - информацию о группе через `groups.getById`;
  - статистику через `stats.get`, если VK token имеет право `stats`;
  - warning, если VK вернул `Permission to perform this action is denied`;
  - стену через `wall.get`;
  - суммарные реакции и топ публикаций.
- Добавлена React-страница `AnalyticsPage`.
- `/analytics` заменён с заглушки на рабочий экран:
  - поиск сообщества;
  - выбор периода;
  - запуск анализа;
  - карточки метрик по публикациям;
  - честное состояние `Недоступно` для `stats.get`-метрик;
  - таблица топ публикаций.

Изменённые файлы:

- `apps/api/src/app.ts`
- `apps/api/src/routes/analytics.ts`
- `apps/api/src/services/analyticsService.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Запустить API и frontend.
- Проверить поиск и анализ реального сообщества.
- Добавить в analytics второй срез: фото, комментарии к фото и видео.
- Позже перенести графики и более детальный отчёт ER из старого `commonAnalyticsController`.

## 2026-08-23 - Второй срез “Анализа сообществ”: фото и видео

Запрос пользователя:

- Продолжить перенос страницы `Анализ сообществ`.

Изучено в старом AngularJS:

- `calculatePhotoStat`
- `calculatePhotoCommentsStat`
- `calculateVideoStat`
- методы `photos.getAll`, `photos.getAllComments`, `video.get` в `vkApiFactory`.

Что считалось раньше:

- Фотографии:
  - всего фото;
  - фото за период;
  - лайки за период;
  - репосты за период.
- Комментарии к фото:
  - всего;
  - за период;
  - список.
- Видео:
  - всего видео;
  - видео за период;
  - лайки за период;
  - репосты за период.

Решение:

- `analyticsService` теперь дополнительно вызывает:
  - `photos.getAll`
  - `photos.getAllComments`
  - `video.get`
- Добавлена мягкая деградация: если VK метод недоступен, endpoint возвращает warning и нулевые media-метрики, а не валит всю страницу.
- В ответ `/api/analytics/community/:groupId` добавлены блоки `photos` и `videos`.
- В `AnalyticsPage` добавлены секции `Фотографии` и `Видео`.

Изменённые файлы:

- `apps/api/src/services/analyticsService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить runtime на реальном сообществе.
- Перенести расчёт ER и дневные группировки активности.
- После этого добавить графики или табличные аналоги графиков из старого отчёта.

## 2026-08-23 - Третий срез “Анализа сообществ”: ER и дневная активность

Запрос пользователя:

- Продолжить перенос страницы `Анализ сообществ`.

Изучено в старом AngularJS:

- `calculateWallStat`
- `calcERByMembers`
- блоки старого шаблона с `ERAverage`, `ERMax`, `averagePostsByDay`, `actionsAverageByPost`, `actionsAverageByDay`, `dayGroups`.

Что считалось раньше:

- ER поста: `(likes + reposts + comments) / membersCount * 100`.
- Средний ER за период.
- Максимальный ER.
- Среднее число постов в день.
- Среднее число реакций на пост.
- Среднее число реакций в день.
- Дневные группы активности:
  - посты;
  - лайки;
  - репосты;
  - комментарии;
  - суммарные реакции;
  - ER;
  - средний охват.

Решение:

- В `analyticsService` добавлен расчёт:
  - `erAverage`;
  - `erMax`;
  - `averageActionsPerDay`;
  - `averageActionsPerPost`;
  - `averagePostsPerDay`;
  - `averageViewsPerPost`;
  - `maxViews`;
  - `minViews`;
  - `adsPosts`;
  - `dayGroups`;
  - `er` для топ публикаций.
- В `AnalyticsPage` добавлены:
  - блок ER-метрик;
  - таблица дневной активности;
  - колонка ER в таблице топ публикаций.
- Графики пока не переносились; добавлены табличные аналоги, чтобы сохранить смысл отчёта без Chart.js.

Изменённые файлы:

- `apps/api/src/services/analyticsService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить runtime на реальном сообществе.
- Добавить детальную вкладочную структуру страницы, если текущий единый отчёт станет слишком плотным.
- Решить, нужны ли графики через Chart.js/Recharts или достаточно таблиц на первом этапе миграции.

## 2026-08-23 - Вкладочная структура “Анализа сообществ”

Запрос пользователя:

- После runtime-проверки продолжить перенос страницы `Анализ сообществ`.
- Следующий шаг: сделать структуру страницы ближе к старому Socstat.

Решение:

- В `AnalyticsPage` добавлена вкладочная структура:
  - `Сводный отчет`
  - `Активность`
  - `Вовлеченность`
  - `Контент`
  - `Публикации`
- Данные не запрашиваются повторно при переключении вкладок.
- Уже готовые метрики разложены по разделам:
  - сводка: базовые wall/stat/ER метрики;
  - активность: реакции и дневная таблица;
  - вовлеченность: ER и дневная таблица;
  - контент: фото и видео;
  - публикации: топ публикаций.
- Backend-контракт не менялся.

Изменённые файлы:

- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить вкладки в браузере на реальных данных.
- Решить, какие графики переносить первыми: активность по дням, ER или охват.

## 2026-08-23 - Первый график в “Анализе сообществ”

Запрос пользователя:

- Начать поэтапный перенос графиков.
- Пока добавить один любой график.

Решение:

- Для графиков выбрана библиотека `Recharts`.
- В workspace `@socstat/frontend` добавлена зависимость `recharts`.
- Во вкладку `Активность` добавлен первый график `Активность по дням`.
- График строится по уже существующим `analytics.wall.dayGroups`:
  - линия `reactions` показывает суммарные реакции за день;
  - пунктирная линия `average` показывает среднюю активность за день за период.
- Добавлен фиксированный responsive-контейнер, чтобы график не схлопывался по высоте.

Изменённые файлы:

- `apps/frontend/package.json`
- `package-lock.json`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Примечание:

- После добавления `Recharts` Vite предупредил, что основной JS chunk больше 500 kB.
- Для текущего этапа это допустимо, но позже графики стоит вынести в lazy-loaded chunk.

Следующие шаги:

- Проверить график в браузере на реальных данных.
- Следующим графиком перенести ER по дням или охват по дням.

## 2026-08-23 - Второй этап графиков в “Анализе сообществ”

Запрос пользователя:

- Сделать пункт 2 из плана: добавить ещё два графика из уже готовых данных.

Решение:

- В `AnalyticsPage` добавлен график `Охват постов по дням`.
- График размещён во вкладке `Сводный отчет`.
- Использует `analytics.wall.dayGroups`:
  - `averageViews` как средний охват постов за день;
  - `views` как суммарные просмотры постов за день.
- В `AnalyticsPage` добавлен график `ER по дням`.
- График размещён во вкладке `Вовлеченность`.
- Использует `analytics.wall.dayGroups.er` и средний `analytics.wall.erAverage`.
- Общие стили tooltip вынесены в общий объект внутри компонента.

Изменённые файлы:

- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Примечание:

- Предупреждение Vite про JS chunk больше 500 kB осталось ожидаемым после добавления `Recharts`.
- Позже графики стоит вынести в lazy-loaded chunk.

Следующие шаги:

- Проверить графики в браузере на реальных данных.
- Перенести графики лайков/репостов/комментариев по дням или заняться lazy-loading графиков.

## 2026-08-23 - Lazy-loading графиков

Запрос пользователя:

- Сделать пункт 3 из плана: разделить графики в lazy chunk.

Причина:

- После добавления `Recharts` Vite предупреждал, что основной JS chunk больше 500 kB.

Решение:

- Создан компонент `AnalyticsChart`.
- Все прямые импорты `recharts` вынесены из `AnalyticsPage` в `AnalyticsChart`.
- `AnalyticsChart` подключён через `React.lazy`.
- В `AnalyticsPage` добавлен `Suspense` fallback `Загружаем графики...`.
- Графики грузятся отдельным chunk только когда нужна страница/вкладка аналитики.

Изменённые файлы:

- `apps/frontend/src/components/AnalyticsChart.tsx`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Результат сборки:

- Основной frontend chunk: около `208.62 kB`.
- Отдельный chunk графиков: около `362.85 kB`.
- Предупреждение Vite про chunk больше 500 kB исчезло.

Следующие шаги:

- Проверить графики в браузере после lazy-loading.
- Продолжить перенос графиков лайков/репостов/комментариев по дням.

## 2026-08-23 - MVP-доработка страницы “Анализ сообществ”

Запрос пользователя:

- Выполнить пункт 4 плана: довести страницу `Анализ сообществ` до MVP.

Решение:

- Backend теперь возвращает для публикаций ссылку на VK-пост.
- Backend больше не обрезает публикации до top-10; frontend получает все загруженные посты периода из текущего `wall.get` с лимитом 100.
- В `AnalyticsPage` добавлена сортировка публикаций:
  - по реакциям;
  - по лайкам;
  - по комментариям;
  - по просмотрам;
  - по ER;
  - по дате.
- В таблицу публикаций добавлена кнопка открытия VK-поста.
- Добавлены пустые состояния:
  - нет публикаций за период;
  - недостаточно данных для графика активности;
  - недостаточно данных для графика охвата;
  - недостаточно данных для графика ER.
- Добавлены стили для toolbar сортировки и новой колонки со ссылкой.

Изменённые файлы:

- `apps/api/src/services/analyticsService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Результат сборки:

- Основной frontend chunk: около `210.27 kB`.
- Отдельный chunk графиков: около `362.85 kB`.

Следующие шаги:

- Проверить MVP в браузере на периоде без постов и на периоде с постами.
- После этого перейти к следующему разделу миграции или продолжить детализацию `Анализа сообществ`.

## 2026-08-23 - Runtime-проверка MVP “Анализа сообществ”

Запрос пользователя:

- Выполнить первичную runtime-проверку страницы `/analytics`.

Проверка окружения:

- API уже слушал порт `4000`.
- Frontend dev-сервер уже слушал порт `5173`.
- `GET /api/health` вернул `{"status":"ok","service":"socstat-api"}`.
- `POST /api/auth/dev` создал dev-сессию.
- `GET /api/account/me` с cookie dev-сессии вернул пользователя `Demo User`.

Проверка frontend:

- `GET http://localhost:5173/analytics` вернул HTML приложения.
- Vite отдаёт модуль `AnalyticsPage.tsx`.
- Vite отдаёт lazy-модуль `AnalyticsChart.tsx`.

Проверка API аналитики:

- `GET /api/analytics/community/125792332?period=week` под dev-сессией вернул ожидаемую ошибку `VK_TOKEN_REQUIRED`.
- Это корректно для dev-пользователя без сохранённого VK token.

Проверка сборки:

- `npm run build`
- Основной frontend chunk: около `210.27 kB`.
- Lazy chunk графиков: около `362.85 kB`.

Ограничение проверки:

- Браузерный коннектор в текущей среде недоступен.
- Поэтому автоматический click-test вкладок/tooltip/ссылок VK не выполнен.
- Пользователь ранее проверил runtime на реальных данных вручную и подтвердил, что данные есть.

Следующие шаги:

- Пользователю проверить клики вкладок, сортировку публикаций и ссылки VK на реальной авторизованной сессии.
- После подтверждения перейти к следующему разделу миграции или продолжить детализацию `/analytics`.

## 2026-08-23 - Первый срез “Сравнение сообществ”

Запрос пользователя:

- Начать перенос следующего раздела миграции: `Сравнение сообществ`.

Изученные старые файлы:

- `front/src/js/ui/analytics/controllers/compareDashboardController/compareDashboardController.js`
- `front/src/js/ui/analytics/controllers/compareDashboardController/compareDashboardController.html`
- `front/src/js/ui/analytics/controllers/compareController/compareController.js`
- `front/src/js/ui/analytics/controllers/compareController/compareController.html`

Что было в старом flow:

- Страница выбора добавляла сообщества в список сравнения.
- Детальная страница последовательно грузила по каждой группе:
  - `groups.getById`
  - `wall.get`
  - `stats.get`
  - `photos.getAll`
  - `photos.getAllComments`
  - `video.get`
- Отчёт показывал таблицы сравнения:
  - активность;
  - охват;
  - вовлеченность;
  - контент.

Решение:

- Добавлен backend service `compareService`.
- Добавлен endpoint `GET /api/compare?groupIds=1,2,3&period=month`.
- Endpoint переиспользует `getCommunityAnalytics` для каждой группы.
- Ошибка одной группы не ломает весь отчёт; для группы возвращается `error`.
- Добавлена React-страница `ComparePage`.
- `/compare` заменён с заглушки на рабочий экран:
  - поиск сообществ;
  - добавление в список сравнения;
  - удаление из списка;
  - выбор периода;
  - запуск сравнения;
  - таблицы активности, охвата, вовлеченности и контента.

Изменённые файлы:

- `apps/api/src/app.ts`
- `apps/api/src/routes/compare.ts`
- `apps/api/src/services/compareService.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/ComparePage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- `POST /api/auth/dev`
- `GET /api/compare?groupIds=125792332&period=week` под dev-сессией вернул `success: true` и item-level ошибку `VK_TOKEN_REQUIRED`.

Следующие шаги:

- Проверить `/compare` в браузере на реальной VK-сессии.
- Добавить график сравнения активности или ER по группам.
- Добавить сортировку таблиц сравнения.

## 2026-08-23 - MVP страницы сравнения сообществ

Запрос пользователя:

- Продолжить развитие страницы сравнения после переноса MVP анализа сообществ.

Результат:

- На странице `Сравнение` добавлена сортировка результатов по реакциям, среднему ER, среднему охвату, количеству постов и участникам.
- Добавлена кнопка очистки списка сравнения.
- Добавлена защита от запуска сравнения меньше чем для двух сообществ.
- Добавлен первый график сравнения: реакции по группам.
- График вынесен в отдельный lazy-loaded компонент `CompareChart`, чтобы основной экран не тащил Recharts до появления результатов.

Изменённые файлы:

- `apps/frontend/src/pages/ComparePage.tsx`
- `apps/frontend/src/components/CompareChart.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить страницу в runtime на реальных VK-данных.
- После подтверждения перейти к странице `Анализ публикаций`.

## 2026-08-23 - Первый срез “Анализа публикаций”

Запрос пользователя:

- После подтверждения MVP страницы сравнения перейти к странице `Анализ публикаций`.

Изучено в старом AngularJS:

- `postsDashboardController` отвечал за поиск и выбор нескольких сообществ.
- `postsController` последовательно загружал по каждой группе `groups.getById` и `wall.get`.
- Старый экран показывал:
  - анализируемые группы;
  - количество публикаций за период;
  - среднее количество реакций на пост;
  - общий список публикаций;
  - сортировку по лайкам, репостам, комментариям и ER.

Решение:

- Для публикаций добавлен отдельный backend endpoint без зависимости от `stats.get`, чтобы экран работал независимо от текущих проблем с правом `stats`.
- Новый endpoint анализирует до 10 сообществ за период `week`, `twoWeek` или `month`.
- Фронт получил полноценную страницу `/posts` вместо заглушки.

Результат:

- Добавлен сервис `apps/api/src/services/postsService.ts`.
- Добавлен маршрут `GET /api/posts/analyze?groupIds=...&period=...`.
- Маршрут подключён в Express app как `/api/posts`.
- Добавлены типы `PostsAnalysisResult`, `PostsAnalysisGroup`, `PostsAnalysisPost`.
- Добавлена React-страница `PostsPage`:
  - поиск сообществ;
  - добавление и удаление групп из списка;
  - очистка списка;
  - выбор периода;
  - запуск анализа;
  - таблица анализируемых групп;
  - список публикаций с метриками;
  - сортировка публикаций по лайкам, репостам, комментариям, всем реакциям, просмотрам, ER и дате;
  - ссылки на оригинальные VK-посты.

Изменённые файлы:

- `apps/api/src/app.ts`
- `apps/api/src/routes/posts.ts`
- `apps/api/src/services/postsService.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/PostsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- `POST /api/auth/dev`
- `GET /api/posts/analyze?groupIds=125792332&period=week` под dev-сессией вернул ожидаемую ошибку `VK_TOKEN_REQUIRED`, без 500.

Следующие шаги:

- Проверить `/posts` в браузере на реальной VK-сессии.
- Добавить постраничный показ или лимит отображения, если на реальных данных список будет тяжёлым.
- Затем перенести избранные публикации или фильтры публикаций из старого Socstat.

## 2026-08-23 - Визуальные карточки публикаций

Запрос пользователя:

- Улучшить внешний вид списка публикаций на странице `Анализ публикаций`: добавить картинки/фото и сделать посты компактнее, желательно плитками одинакового размера.

Изучено в старом AngularJS:

- Директива `postDefault` показывала первое фото, GIF или видео-превью как основную картинку поста.
- Остальные фото могли отображаться как дополнительные миниатюры.
- Внизу карточки были дата, ссылка на VK и основные реакции.

Решение:

- Backend нормализует media-вложения из `wall.get`.
- Для каждого поста возвращается до 4 media-элементов:
  - `photo`;
  - `video`;
  - `gif`.
- Frontend показывает посты плиточной сеткой одинаковой ширины.
- У карточки теперь есть фиксированная media-зона, компактная шапка с группой, обрезанный текст и метрики внизу.

Изменённые файлы:

- `apps/api/src/services/postsService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/PostsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить `/posts` в браузере на реальных постах с фото, видео и без вложений.
- При необходимости добавить режим раскрытия полного текста или модальное окно просмотра поста.

## 2026-08-23 - Иконки метрик в карточках публикаций

Запрос пользователя:

- В карточке публикации заменить текстовые подписи `Лайки`, `Репосты` и прочие на иконки, чтобы освободить место.

Результат:

- В карточках публикаций метрики заменены на иконки:
  - лайки;
  - репосты;
  - комментарии;
  - просмотры;
  - ER.
- Для доступности добавлены `aria-label`.
- Для подсказок добавлены `title`.
- Стили метрик сделаны компактнее через inline-flex.

Изменённые файлы:

- `apps/frontend/src/pages/PostsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить визуально карточки `/posts` на реальных данных.

## 2026-08-23 - Положение сортировки публикаций

Запрос пользователя:

- Перенести сортировку публикаций с правого края в левый.

Результат:

- Toolbar сортировки публикаций на странице `/posts` выровнен по левому краю.

Изменённые файлы:

- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

## 2026-08-23 - Единый шаблон карточек публикаций

Запрос пользователя:

- На странице `Анализ сообществ` для вкладки публикаций использовать тот же шаблон карточек, что и на странице `Анализ публикаций`.

Результат:

- `analyticsService` теперь возвращает для публикаций media-вложения из `wall.get`.
- В `CommunityAnalytics.wall.topPosts` добавлены `media` и `isAd`.
- Вкладка `Публикации` на странице `/analytics` переведена с таблицы на тот же плиточный шаблон карточек, что используется на `/posts`.
- Карточки показывают превью фото/видео/GIF, группу, дату, обрезанный текст, иконки метрик, ER, рекламу и ссылку на VK.

Изменённые файлы:

- `apps/api/src/services/analyticsService.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить `/analytics` в браузере на сообществе с постами и вложениями.

## 2026-08-24 - Фильтры и дозагрузка публикаций

Запрос пользователя:

- Приступить к следующему шагу после MVP страницы `Анализ публикаций`: добавить пагинацию/дозагрузку и фильтры.

Результат:

- На странице `/posts` добавлены фильтры публикаций:
  - все;
  - с вложениями;
  - фото;
  - видео;
  - GIF;
  - реклама;
  - без вложений.
- Добавлен локальный показ карточек пачками по 18 публикаций.
- Добавлен счётчик `Показано N из M`.
- Добавлена кнопка `Показать ещё`.
- При смене анализа, сортировки или фильтра список снова начинается с первой пачки.

Изменённые файлы:

- `apps/frontend/src/pages/PostsPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Проверить `/posts` в браузере на реальных данных.
- Если фильтры удобны, вынести карточку/панель фильтров в общий компонент и переиспользовать во вкладке `/analytics`.

## 2026-08-24 - Общий компонент карточки публикации

Запрос пользователя:

- Одобрить следующий шаг: вынести карточку публикации в общий компонент, чтобы `/posts` и вкладка публикаций `/analytics` использовали один код.

Результат:

- Создан компонент `apps/frontend/src/components/PostCard.tsx`.
- В компонент перенесены:
  - media-превью фото/видео/GIF;
  - заглушка для постов без вложений;
  - группа и дата;
  - текст;
  - ссылка на VK;
  - иконки метрик;
  - бейдж рекламы.
- Страница `/posts` использует `PostCard`.
- Вкладка `Публикации` на странице `/analytics` использует `PostCard`.
- Дублирующая JSX-разметка карточки удалена из страниц.

Изменённые файлы:

- `apps/frontend/src/components/PostCard.tsx`
- `apps/frontend/src/pages/PostsPage.tsx`
- `apps/frontend/src/pages/AnalyticsPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Вынести фильтры/сортировку публикаций в общий компонент или добавить раскрытие полного текста в `PostCard`.

## 2026-08-24 - Первый MVP раздела оплаты

Запрос пользователя:

- Перейти к разделу оплаты после завершения текущего этапа публикаций.

Изучено в старом AngularJS:

- Страница `accountController.html` показывала блок оплаты, информацию о продлении и карточку аккаунта.
- Директива `radTariff` строила форму ЮMoney quickpay.
- Старые тарифы:
  - 1 месяц: 299 ₽;
  - 3 месяца: 499 ₽;
  - 1 год: 1399 ₽.
- Старый способ оплаты:
  - ЮMoney / Яндекс.Деньги;
  - банковская карта;
  - hidden form POST на `https://yoomoney.ru/quickpay/confirm.xml`;
  - label содержал пользователя.

Решение:

- Тарифы отдаёт backend через `/api/payments/plans`.
- Создание платежа вынесено в `/api/payments/create`.
- При создании платежа backend создаёт запись `Payment` со статусом `pending`.
- Backend возвращает frontend intent для отправки формы в ЮMoney.
- Callback и автоматическое продление тарифа не включены в этот шаг: их нужно переносить отдельно с проверкой безопасности.

Результат:

- Обновлён `paymentsRouter`:
  - планы приведены к старым ценам;
  - добавлен `POST /api/payments/create`;
  - генерируются поля формы ЮMoney.
- Страница `Профиль и оплата` теперь:
  - загружает тарифы с backend;
  - показывает текущую дату доступа;
  - позволяет выбрать тариф;
  - позволяет выбрать способ оплаты: банковская карта или ЮMoney;
  - создаёт pending-платёж;
  - отправляет пользователя на страницу оплаты ЮMoney в новой вкладке.
- Добавлены типы `PaymentPlan` и `PaymentIntent`.
- Добавлены стили тарифных карточек и блока оплаты.

Изменённые файлы:

- `apps/api/src/routes/payments.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AccountPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Ограничение runtime-проверки:

- `curl` к `http://localhost:4000/api/payments/plans` и dev-login не выполнены, потому что API dev-сервер не был запущен на порту `4000`.

Следующие шаги:

- Запустить API и frontend, проверить `/account`.
- После этого переносить callback оплаты: проверка payload, поиск payment по label, смена статуса и продление `User.activeTo`.

## 2026-08-24 - Callback оплаты ЮMoney

Запрос пользователя:

- Продолжить перенос раздела оплаты после первого MVP.

Изучено в старом PHP:

- Старый `payment_result.php` проверял `sha1_hash`.
- Подпись строилась из полей ЮMoney:
  - `notification_type`;
  - `operation_id`;
  - `amount`;
  - `currency`;
  - `datetime`;
  - `sender`;
  - `codepro`;
  - notification secret;
  - `label`.
- После успешной проверки старый код определял период по сумме оплаты и продлевал `UF_ACTIVE_TO`.

Решение:

- Новый callback принимает только платежи с label формата `socstat-payment:<paymentId>`.
- Для проверки подписи добавлена переменная окружения `YOOMONEY_NOTIFICATION_SECRET`.
- Без секрета callback не подтверждает платежи.
- Повторный callback по уже оплаченному платежу не продлевает подписку второй раз.
- Повторное использование одного `operation_id` на другом платеже блокируется.

Результат:

- `POST /api/payments/callback`:
  - проверяет `sha1_hash`;
  - находит `Payment` по label;
  - сверяет сумму с тарифом;
  - переводит платеж в `paid`;
  - сохраняет `providerTransactionId` и сырой payload;
  - продлевает `User.activeTo` от текущего активного периода или от сегодняшней даты.
- В `.env.example` добавлен `YOOMONEY_NOTIFICATION_SECRET`.
- В `apps/README.md` добавлено описание payment routes и env-переменной.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/routes/payments.ts`
- `apps/api/.env.example`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Ограничение runtime-проверки:

- Реальный callback ЮMoney не проверялся, потому что для этого нужен публичный callback URL и настроенный секрет уведомлений.

Следующие шаги:

- Запустить API и проверить локально негативные сценарии callback: нет секрета, неверная подпись, неизвестный label.
- Для production настроить публичный HTTPS callback и `YOOMONEY_NOTIFICATION_SECRET`.

## 2026-08-24 - Локальная проверка callback оплаты

Запрос пользователя:

- Выполнить шаг 1 дальнейшего плана по оплате: локально проверить callback.

Проверка окружения:

- MongoDB была запущена на `27017`.
- Основной API пользователя был запущен на `4000`.
- В `apps/api/.env` `YOOMONEY_NOTIFICATION_SECRET` не был заполнен.
- Чтобы не трогать основной API, временно запущен второй API на `4010` с тестовым секретом `local-test-secret`.

Сценарий проверки:

- Создана dev-сессия через `POST /api/auth/dev`.
- Получена дата доступа dev-пользователя до оплаты: `2026-12-31`.
- Создан pending-платёж через `POST /api/payments/create`.
- Сформирован тестовый payload ЮMoney с корректным `sha1_hash`.
- Отправлен `POST /api/payments/callback`.
- Проверена дата доступа после callback.
- Повторно отправлен тот же callback.
- Проверены негативные сценарии:
  - неверная подпись;
  - неизвестный label.

Результат:

- Первый callback вернул `status: paid`.
- `activeTo` dev-пользователя продлился с `2026-12-31` до `2027-01-31`.
- Повторный callback вернул `status: already_paid`.
- После повторного callback `activeTo` остался `2027-01-31`, повторного продления не было.
- Неверная подпись вернула `403 INVALID_YOOMONEY_SIGNATURE`.
- Неизвестный label с корректной подписью вернул `404 PAYMENT_NOT_FOUND`.
- Временный API на `4010` остановлен.
- Основной API на `4000` не останавливался.

Проверка:

- `lsof -nP -iTCP:4000 -sTCP:LISTEN`
- `lsof -nP -iTCP:27017 -sTCP:LISTEN`
- `PORT=4010 YOOMONEY_NOTIFICATION_SECRET=local-test-secret npm run dev:api`
- Node HTTP-script для позитивного и повторного callback.
- Node HTTP-script для негативных сценариев.
- `lsof -nP -iTCP:4010 -sTCP:LISTEN`

Следующие шаги:

- Добавить историю платежей на `/account`.
- Заполнить `YOOMONEY_NOTIFICATION_SECRET` в production env перед реальными оплатами.

## 2026-08-24 - История оплат

Запрос пользователя:

- Добавить историю платежей после проверки callback оплаты.

Результат:

- Добавлен backend route `GET /api/payments/history`.
- Route возвращает последние 20 платежей текущего пользователя:
  - дату создания;
  - провайдера;
  - сумму;
  - период;
  - статус;
  - `providerTransactionId`;
  - дату обновления.
- На странице `/account` добавлен блок `История оплат`.
- Добавлено пустое состояние для пользователя без платежей.
- После создания нового pending-платежа он сразу добавляется в начало истории на frontend.
- Для статусов добавлены русские подписи и цветовые бейджи:
  - `pending` - `Ожидает оплаты`;
  - `paid` - `Оплачен`;
  - `failed` - `Ошибка`.

Изменённые файлы:

- `apps/api/src/routes/payments.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AccountPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `POST /api/auth/dev` + `GET /api/payments/history` на API `4000`.

Итог runtime-проверки:

- `historyStatus: 200`
- `count: 1`
- первый платёж:
  - `amount: 299`
  - `period: 1 месяц`
  - `status: paid`
  - `hasOperationId: true`

Следующие шаги:

- Добавить сообщение после возврата с ЮMoney на `/account?payment=success`.
- Добавить ручное обновление профиля/истории оплаты после возврата.

## 2026-08-24 - Возврат после оплаты

Запрос пользователя:

- Реализовать следующий шаг по оплате: обработать возврат пользователя с ЮMoney на `/account?payment=success`.

Результат:

- `AccountPage` читает query-параметр `payment=success`.
- После возврата с оплаты показывается информационный блок.
- Добавлена кнопка `Обновить статус оплаты`.
- Кнопка одновременно:
  - перезагружает историю платежей;
  - вызывает обновление аккаунта через `loadAccount`;
  - обновляет дату доступа в профиле и верхней панели.
- В блок `История оплат` добавлена отдельная кнопка обновления.
- Текст примечания к оплате обновлён с учётом работающего callback.

Изменённые файлы:

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/pages/AccountPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- `curl -s -I 'http://localhost:5173/account?payment=success'`

Итог runtime-проверки:

- Frontend dev server вернул `HTTP/1.1 200 OK` для `/account?payment=success`.

Следующие шаги:

- Проверить UX в браузере после реального перехода из ЮMoney.
- Добавить production-настройки callback URL и секрета уведомлений.

## 2026-08-24 - Админский просмотр оплат

Запрос пользователя:

- Сначала сделать пункт 3 из дальнейшего плана по оплате: админский просмотр оплат.

Результат:

- Добавлен backend route `GET /api/payments/admin/history`.
- Route доступен только пользователю с `isAdmin`.
- Возвращаются последние 100 платежей с пользователем:
  - дата создания;
  - пользователь;
  - VK id;
  - дата доступа пользователя;
  - период;
  - сумма;
  - статус;
  - `providerTransactionId`.
- Добавлены query-фильтры:
  - `status=all|pending|paid|failed`;
  - `q=...` для поиска по payment id, operation id, периоду, статусу, VK id, имени и фамилии.
- В `AdminPage` добавлен блок `Оплаты`.
- Добавлена таблица оплат, фильтр статуса, строка поиска и кнопка загрузки.
- Добавлены стили админской таблицы оплат.

Изменённые файлы:

- `apps/api/src/routes/payments.ts`
- `apps/frontend/src/api/types.ts`
- `apps/frontend/src/pages/AdminPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Runtime-проверка `POST /api/auth/dev` + `GET /api/payments/admin/history?status=all`.
- Runtime-проверка поиска `GET /api/payments/admin/history?status=paid&q=test`.

Итог runtime-проверки:

- `historyStatus: 200`
- `count: 3`
- первый платёж:
  - `amount: 299`
  - `status: paid`
  - `userName: Demo User`
  - `hasOperationId: true`
- `paidSearchStatus: 200`
- `paidSearchCount: 1`

Следующие шаги:

- Проверить блок `Оплаты` в браузере на `/admin`.
- Добавить production-настройки callback URL и секрета уведомлений.

## 2026-08-24 - User id в админской таблице оплат

Запрос пользователя:

- В админской таблице оплат вывести под именем пользователя внутренний id пользователя и VK id.

Результат:

- В блоке `Оплаты` на `/admin` под именем пользователя теперь отображаются:
  - `id`;
  - `vk id`;
  - дата доступа пользователя.

Изменённые файлы:

- `apps/frontend/src/pages/AdminPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

## 2026-08-24 - User id на странице аккаунта

Запрос пользователя:

- Вывести внутренний id пользователя и VK id не только в админской таблице оплат, но и на странице `/account`.

Результат:

- В карточке `Мой аккаунт` на `/account` под именем пользователя добавлены:
  - `id`;
  - `vk id`.

Изменённые файлы:

- `apps/frontend/src/pages/AccountPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

## 2026-08-24 - Админский VK id

Запрос пользователя:

- Сделать VK id `30647716` админским.

Решение:

- Добавлена env-настройка `ADMIN_VK_IDS`.
- По умолчанию в список администраторов входит `30647716`.
- При VK-входе `upsertVkUser` выставляет `isAdmin: true`, если `profile.vkId` входит в `ADMIN_VK_IDS`.
- Для уже существующего локального пользователя с `vkId: 30647716` поле `isAdmin` обновлено в MongoDB вручную.

Изменённые файлы:

- `apps/api/src/config/env.ts`
- `apps/api/src/repositories/accountRepository.ts`
- `apps/api/.env.example`
- `apps/README.md`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Mongo update для `vkId: 30647716`

Итог Mongo update:

- `matched: 1`
- `modified: 1`

Примечание:

- Для применения нового правила `ADMIN_VK_IDS` в уже запущенном API нужен перезапуск API. Текущая запись пользователя в MongoDB уже обновлена.

## 2026-08-24 - Скрытие админки для не-админов

Запрос пользователя:

- Страница `Админка` должна быть скрыта для не-админов.

Результат:

- Пункт меню `Админка` показывается только если `user.isAdmin === true`.
- Прямой переход на `/admin` для не-админа перенаправляет на `/dashboard`.
- Заголовок страницы по-прежнему умеет определять `Админка` для админского маршрута.

Изменённые файлы:

- `apps/frontend/src/App.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

## 2026-08-24 - Автозагрузка оплат в админке

Запрос пользователя:

- Оплаты нужно загружать сразу при входе на страницу `/admin`.

Результат:

- `AdminPage` автоматически вызывает загрузку оплат при монтировании страницы.
- Кнопка загрузки оплат оставлена для ручного обновления и применения фильтров.

Изменённые файлы:

- `apps/frontend/src/pages/AdminPage.tsx`
- `docs/migration-log.md`

Проверка:

- `npm run build`

## 2026-08-24 - Мягкая обработка ошибки VK code exchange

Запрос пользователя:

- При авторизации получена ошибка `VK_TOKEN_EXCHANGE_FAILED` с деталями `Code is invalid or expired.`

Причина:

- Ошибка возникает на этапе обмена VK `code` на `access_token`.
- Обычно это означает, что одноразовый `code` уже использован, устарел, открыт повторно из истории браузера или получен для другого redirect URL.

Результат:

- При ошибке обмена code backend больше не оставляет пользователя на JSON-ответе.
- Backend очищает OAuth state cookie.
- Backend редиректит пользователя на `/login?authError=VK_TOKEN_EXCHANGE_FAILED`.
- Login page показывает понятное сообщение и предлагает начать вход заново.
- Добавлен явный route `/login` для неавторизованного состояния.

Изменённые файлы:

- `apps/api/src/routes/auth.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/pages/LoginPage.tsx`
- `apps/frontend/src/styles.css`
- `docs/migration-log.md`

Проверка:

- `npm run build`

Следующие шаги:

- Перезапустить API и frontend dev-серверы, чтобы новая обработка вступила в силу.
- Повторить вход через кнопку `Войти через VK`, не обновляя callback URL вручную.

## 2026-08-24 - Исправление конфликта isAdmin при VK-входе

Запрос пользователя:

- При авторизации backend упал с ошибкой MongoDB `Updating the path 'isAdmin' would create a conflict at 'isAdmin'`.

Причина:

- Для админского VK id `upsertVkUser` одновременно записывал `isAdmin` в `$set` и `$setOnInsert`.
- MongoDB запрещает обновлять один и тот же путь двумя update-операторами в одном запросе.

Результат:

- Для админского VK id `isAdmin: true` пишется через `$set`.
- Для обычного нового пользователя `isAdmin: false` задаётся через `$setOnInsert`.
- Конфликт update-операторов устранён.

Изменённые файлы:

- `apps/api/src/repositories/accountRepository.ts`
- `docs/migration-log.md`

Проверка:

- `npm run build`
- Прямой вызов `upsertVkUser` для `vkId: 30647716`

Итог проверки:

- `vkId: 30647716`
- `isAdmin: true`

Примечание:

- Во время прямой проверки профиль был обновлён тестовыми именем и фамилией. Следующий вход через VK вернёт актуальные имя и фамилию из VK.

## 2026-08-24 - Исправление `VK_TOKEN_REQUIRED` после авторизации

Запрос пользователя:

- После последних правок приложение стало писать `VK token is required` везде.

Причина:

- VK token в MongoDB был сохранён, но у записи стоял истёкший `expiresAt`.
- Общая функция `getVkAccessToken` корректно фильтрует истёкшие токены и поэтому перестала возвращать token для всех VK-зависимых разделов.
- При сохранении token backend считал любое переданное `expiresIn` основанием выставить `expiresAt`, а старый `expiresAt` не удалялся, если новый token должен быть бессрочным или без срока жизни.

Решение:

- `saveVkToken` теперь приводит `expiresIn` к числу и выставляет `expiresAt` только если значение конечное и больше нуля.
- Если срок жизни token не передан или некорректен, backend удаляет старый `expiresAt` через `$unset`.
- Текущая запись VK token для пользователя с `vkId: 30647716` исправлена в MongoDB: ошибочный `expiresAt` удалён.

Изменённые файлы:

- `apps/api/src/repositories/accountRepository.ts`
- `docs/migration-log.md`

Проверка:

- MongoDB-проверка без вывода `accessToken`:
  - пользователь найден;
  - `vkId: 30647716`;
  - `isAdmin: true`;
  - VK token найден;
  - `tokenHasExpiresAt: false`.
- `npm run build`

Примечание:

- Уже запущенный API должен снова видеть текущий token сразу после исправления записи в MongoDB.
- Для применения новой логики сохранения token при следующих авторизациях API нужно перезапустить.
