# Деплой

Каждый пуш в `master` сразу выкатывается на прод (socstat-lab.ru). Отдельного шага релиза нет: что попало в `master`, через несколько минут работает у пользователей. Деплой можно запустить и вручную — `workflow_dispatch` в GitHub Actions.

## Как проходит

Workflow `.github/workflows/deploy.yml`, окружение `production`:

1. По SSH заливает репозиторий на сервер в `DEPLOY_PATH` (по умолчанию `/opt/socstat`) через `rsync --delete`. Не копируются `.git`, `.github`, `node_modules`, сборки `dist` и `api/.env` — секреты живут только на сервере.
2. Если на сервере нет `api/.env`, создаёт его из `deploy/api.env.production.example` и падает: секреты нужно заполнить и перезапустить workflow.
3. `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans` пересобирает и перезапускает контейнеры.
4. До минуты ждёт `GET /api/health` на `127.0.0.1:4000`. Не дождался — выводит состояние и последние 200 строк логов `api`, `mongo`, `redis` и помечает деплой упавшим.

Новый пуш, пока предыдущий деплой идёт, отменяет его (`concurrency: socstat-production`) — выкатывается последний коммит.

## Что работает на сервере

`docker-compose.prod.yml`: `frontend` (nginx со сборкой фронта, порт 8080), `api` (порт 4000), `mongo` 7 и `redis` 7 с данными в томах `mongo-data` и `redis-data`. Порты открыты только на `127.0.0.1`, снаружи запросы принимает nginx сервера (пример конфига — `deploy/nginx/socstat.conf.example`). Миграции данных выполняются при старте API (`api/src/db/migrations.ts`).

## Настройки

- Секреты репозитория: `DEPLOY_HOST`, `DEPLOY_PORT` (по умолчанию 22), `DEPLOY_USER`, `DEPLOY_SSH_KEY`; переменная `DEPLOY_PATH`.
- Переменные API на сервере — `api/.env`, шаблон в `deploy/api.env.production.example`.

## Ограничения

- Отката нет: вернуть прошлую версию — это revert и новый пуш в `master`.
- Перед пушем в `master` изменение должно быть готово к проду; проверить, что деплой прошёл, можно во вкладке Actions на GitHub или по `https://socstat-lab.ru/api/health`.
