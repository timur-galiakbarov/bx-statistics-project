# План переезда Socstat

## Текущее состояние

Старый фронт на AngularJS лежит в `front/src`. Bitrix/PHP используется как HTTP-контракт для авторизации, профиля пользователя, callback оплаты, сохранённых групп ВКонтакте, новостей, админской статистики и генерации XLSX-отчётов.

Внутренности Bitrix на первом этапе не трогаем. Для переезда считаем текущие PHP-контроллеры API-контрактом и постепенно заменяем их маршрутами Node.js.

## Новая структура

- корень репозитория — приложение на React + Vite.
- `api` — API на Node.js + Express.
- `/api/*` - новые маршруты для React.
- `/controllers/*/*.php` - совместимые маршруты, повторяющие старые вызовы AngularJS на время миграции.

## Целевой стек

- Фронт: React, Vite, TypeScript.
- Бэкенд: Node.js, Express, TypeScript.
- База данных: MongoDB.
- ODM: Mongoose.
- Отчёты: `exceljs` для генерации XLSX.
- VK API: backend service layer вместо прямых JSONP-вызовов с фронта.

## Коллекции MongoDB

- `users`
  - VK id, имя, аватар, роль, дата окончания подписки.
- `sessions`
  - id пользователя, token/hash сессии, дата истечения, дата создания.
- `vkTokens`
  - id пользователя, access token, scopes, дата истечения.
- `savedGroups`
  - id пользователя, id группы VK, источник, название, фото, количество участников.
  - `source`: `free`, `bookmark`, `favorite`, `managed`.
- `payments`
  - id пользователя, провайдер, сумма, период, статус, id транзакции провайдера, сырой payload callback.
- `reports`
  - id пользователя, тип отчёта, параметры, путь к файлу или URL, статус, дата создания.
- `news`
  - заголовок, текст, дата публикации, флаг видимости.

## Порядок миграции

1. Контракт аккаунта и сессии.
2. Подключение MongoDB, модели Mongoose и dev seed.
3. Сохранённые группы и бесплатные группы.
4. Тарифы, создание оплаты и callback платёжного провайдера.
5. VK-авторизация и хранение VK token.
6. Бэкенд-слой для VK API.
7. Сводка dashboard.
8. Экран аналитики сообществ.
9. Экран сравнения сообществ.
10. Экран анализа публикаций.
11. Генерация XLSX-отчётов.
12. Админские CRM/stat экраны.
13. Финальное переключение маршрута со старого кабинета на React-кабинет.

## Этапы

### 1. API-контракт

Оставляем совместимые маршруты в `/controllers` и параллельно строим новые маршруты в `/api`.

Критерии готовности:

- Старые маршруты возвращают форму ответа, которую ожидает AngularJS.
- Новые React-маршруты используют более чистые имена `/api/*`.
- Для каждого перенесённого endpoint есть примеры request/response.

### 2. Основа MongoDB

Заменяем текущее временное хранилище в `api` на модели Mongoose.

Критерии готовности:

- В `api/.env` поддерживается `MONGO_URI`.
- API стартует только после успешного подключения к MongoDB.
- Dev seed создаёт demo-пользователя и группы, если база пустая.
- Текущий React shell читает профиль и группы из MongoDB.

### 3. Авторизация и сессии

Переносим VK-авторизацию из PHP в Node.js.

Целевые маршруты:

- `GET /api/auth/vk/start`
- `GET /api/auth/vk/callback`
- `POST /api/auth/logout`
- `GET /api/account/me`

Критерии готовности:

- Пользователь может войти через VK.
- Сессия хранится на backend и выдаётся через HTTP-only cookie.
- Legacy routes `/controllers/account/isAuth.php` и `/controllers/account/getUserInfo.php` работают от той же сессии.

### 4. Группы

Переносим бесплатные группы, закладки, избранное и управляемые группы в MongoDB.

Целевые маршруты:

- `GET /api/account/groups`
- `POST /api/account/groups/free`
- `POST /api/account/groups/bookmarks`
- `POST /api/account/groups/favorites`
- `DELETE /api/account/groups/:groupId`

Критерии готовности:

- Ограничения на бесплатные группы проверяются на backend.
- Старые Angular endpoints возвращают данные из MongoDB до удаления AngularJS.

### 5. Оплата

Переносим тарифы и обработку callback оплаты в Node.js.

Целевые маршруты:

- `GET /api/payments/plans`
- `POST /api/payments/create`
- `POST /api/payments/callback`

Критерии готовности:

- Callback оплаты идемпотентный.
- Сырой payload провайдера сохраняется в `payments`.
- Дата окончания подписки пользователя продлевается после подтверждённой оплаты.

### 6. VK API service

Переносим прямые VK-запросы с frontend JSONP на backend.

Целевые маршруты:

- `GET /api/vk/groups/search`
- `GET /api/vk/groups/:groupId`
- `GET /api/vk/groups/:groupId/stats`
- `GET /api/vk/groups/:groupId/wall`
- `GET /api/vk/groups/:groupId/photos`
- `GET /api/vk/groups/:groupId/videos`

Критерии готовности:

- Ошибки VK нормализуются.
- Rate limit и retry обрабатываются в одном backend-сервисе.
- Фронт не знает VK access token.

### 7. React-экраны

Переносим AngularJS-экраны по одному.

Порядок:

1. Dashboard.
2. Профиль и оплата.
3. Аналитика сообществ.
4. Сравнение сообществ.
5. Анализ публикаций.
6. Админские экраны.

Критерии готовности:

- Каждый экран можно релизить отдельно.
- Общие UI-компоненты выносятся только после появления реального повторения.
- Старый экран остаётся доступен, пока React-замена не достигла паритета.

### 8. Отчёты

Переносим генерацию XLSX из PHP в Node.js.

Целевые отчёты:

- banned list
- compare list
- find analog list

Критерии готовности:

- Сгенерированные файлы совпадают с важными колонками старых отчётов.
- Метаданные отчёта сохраняются в MongoDB.
- Ссылки на скачивание отдаются через авторизованные API routes.

## Локальная разработка

MongoDB можно поднять локально через Docker:

```bash
docker run --name socstat-mongo -p 27017:27017 -d mongo:7
```

Env для API:

```env
MONGO_URI=mongodb://localhost:27017/socstat
```

Запуск backend и frontend:

```bash
npm run dev:api
npm run dev:frontend
```

## Стратегия переключения

Новый React-кабинет запускаем параллельно со старым кабинетом.

Предлагаемое разделение маршрутов:

- старый кабинет: `/lk` или `/oldlk`
- новый кабинет: `/lk-new`

Основной маршрут переключаем только после того, как авторизация, статус подписки, сохранённые группы, dashboard и ключевая аналитика работают через MongoDB и Node.js.

## Правило журнала миграции

Каждый промпт, связанный с переездом, должен оставлять короткий результат в `docs/migration-log.md`.

Каждая запись должна включать:

- дату
- запрос пользователя
- изменённые файлы
- принятые решения
- выполненную проверку
- следующие шаги

Все записи и документация по переезду ведутся на русском языке.

## Найденные legacy endpoints

- `GET /controllers/account/isAuth.php`
- `GET /controllers/account/getUserInfo.php`
- `GET /controllers/account/freeGroups/getList.php`
- `POST /controllers/account/freeGroups/add.php`
- `POST /controllers/account/statList/save.php`
- `GET /controllers/account/getNewsList.php`
- `POST /controllers/account/bookmarks/addBookmark.php`
- `GET /controllers/account/bookmarks/getBookmarksList.php`
- `POST /controllers/account/bookmarks/removeBookmark.php`
- `POST /controllers/account/favorites/add.php`
- `POST /controllers/account/favorites/getList.php`
- `POST /controllers/account/favorites/remove.php`
- `GET /controllers/account/admin/getStat.php`
- `GET /controllers/account/logout.php`
- `POST /controllers/stat/getContentSections.php`
- `POST /controllers/common/generateXLSX_getBannedList.php`
- `POST /controllers/common/generateXLSX_getCompareList.php`
- `POST /controllers/common/generateXLSX_getFindAnalogList.php`
