# Контент-план

Новый раздел для планирования и публикации постов. Сейчас — **этап 0**: флаг доступа, страница-каркас, API-заглушка и модели. Календаря, подключённых каналов и публикации ещё нет.

## Доступ

- Фича включается ключом `contentPlan` в «Админка → Настройки → Фичи»: `Выключено / Только администраторам / Всем пользователям`.
- По умолчанию `off`. Для проверки поставьте «Только администраторам»: пункт меню и маршрут появятся только у администраторов.
- В `/api/account/me` приходит `contentPlanEnabled`; по нему показывается пункт меню «Контент-план» (сразу под «Аналитикой») и открывается маршрут `/content-plan`.
- API `/api/content-plan` отвечает `403 FEATURE_OFF`, если фича выключена или недоступна пользователю.
- Идеи для постов пока остаются отдельным разделом и в контент-план не переезжают.

## Что уже работает

- Страница `/content-plan`: каркас с заголовком, статусом этапа и пустым состоянием.
- `GET /api/content-plan` возвращает `{ channels: [], posts: [], serverTime }` — проверка доступа и связи с API.
- Модели для следующего этапа:
  - `ContentPlanChannel` — подключённая группа ВК или Telegram-канал;
  - `ContentPlanPost` — черновик/запланированный/опубликованный пост.
- Флаг фичи и переключатель в админке.

## Модели

`ContentPlanChannel` (`api/src/models/ContentPlanChannel.ts`):
- `userId`, `platform` (`vk`/`telegram`), `externalId`, `title`, `handle`;
- `status` (`connected`/`needs_reauth`/`error`), `canPost`, `lastCheckedAt`, `error`.

`ContentPlanPost` (`api/src/models/ContentPlanPost.ts`):
- `userId`, `channelId`, `platform`, `title`, `text`;
- `status` (`draft`/`scheduled`/`publishing`/`published`/`failed`);
- `scheduledAt` в UTC и `timeZone` — IANA-зона автора, чтобы показывать местное время и не ломаться на переходе на летнее время;
- `autoPublish` по умолчанию `true`;
- `publishedAt`, `externalPostId`, `externalUrl`, `error`, `attempts`, `nextAttemptAt`.

## Код

- Флаг: `api/src/services/featureFlags.ts`.
- `/me`: `api/src/routes/account.ts`.
- Маршрут: `api/src/routes/contentPlan.ts`, подключение — `api/src/app.ts`.
- Модели: `api/src/models/ContentPlanChannel.ts`, `ContentPlanPost.ts`.
- Страница: `src/pages/ContentPlanPage.tsx`, `src/pages/content-plan.css`.
- Меню и маршрут: `src/App.tsx`; текст переключателя — `src/components/AdminFeatureFlags.tsx`.

## Что дальше

1. Календарь, подключение Telegram-канала и черновики.
2. Редактор с markdown и предпросмотром; время — в часовом поясе пользователя.
3. Публикация в Telegram через бота и автопубликация по расписанию.
4. Публикация в ВК: scope `wall`, переавторизация, `wall.post`.
5. Открытие всем пользователям через тот же флаг.

## Ограничения этапа 0

- Публикации нет.
- Каналы не подключаются.
- Календаря и формы поста нет.
- Идеи ИИ в разделе не используются.
- Лимитов на генерацию и публикацию нет — по решению продукта.
