# Вопросы о состоянии Socstat

Когда спрашивают, как дела с Socstat (выручка, регистрации, реклама, воронка, планы), сначала забери свежую выгрузку аналитики с прода и отвечай по ней, а не по памяти:

```bash
set -a; source .env.local; set +a
curl -sf -H "Authorization: Bearer $SOCSTAT_EXPORT_TOKEN" "https://socstat-lab.ru/api/account/admin/export?days=30" -o exports/socstat-latest.json
```

- Токен лежит в `.env.local` в корне (`SOCSTAT_EXPORT_TOKEN`, файл в `.gitignore`); на сервере тот же токен — `ADMIN_EXPORT_TOKEN` в `api/.env`. Токен не выводи в ответах и не коммить.
- `days` — 7, 30 или 90: период воронки, источников и списка платежей. Помесячная история (`monthly`) всегда за 12 месяцев.
- Смысл полей описан в самом файле (`about.notes`) и в `docs/features/admin-export.md`.
- Если запрос вернул 401 — токена нет или он не совпадает с серверным; попроси пользователя проверить оба места. Не подставляй старые выгрузки молча: если пришлось взять файл из `exports/`, назови его дату.
