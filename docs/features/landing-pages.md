# Лендинги

Статические страницы до входа в приложение: главная `/` и рекламные `/promo`, `/promo-custom`, `/promo-placements`. Приложение живёт под `/app/`, кнопки лендингов ведут на `/app/login` (с `/promo-placements` — на `/app/login?next=/placements`, см. [Куда попадают после входа](#куда-попадают-после-входа)).

## Страницы

- **`/` — `public/landing.html`.** Основная страница для поиска и рекламы: три площадки, кому пригодится, функции, как начать, цены, FAQ. Индексируется, canonical `https://socstat.ru/`, единственная страница в `public/sitemap.xml`. Картинки — `public/landing/*.webp`, превью для соцсетей — `public/landing/og-image.jpg`.
- **`/promo` — `public/promo.html`.** Короткая рекламная страница: первый экран, что показывает сервис, лучшие посты, сравнение с конкурентами, пробный период. Без цен по тарифам и FAQ. Картинки — `public/landing/vk.webp` (сводка и охват по дням), `public/promo-posts.png`, `public/promo-compare.png`.
- **`/promo-custom` — `public/promo-custom.html`.** Второй вариант рекламной страницы.
- **`/promo-placements` — `public/promo-placements.html`.** Рекламная страница [подбора площадок](placements.md) для отдельной кампании в Директе по запросам вида «подбор пабликов для рекламы вк». Первый экран с примером запроса и выдачи, «Как это работает» (`#how`), пример подборки (`#example`), что видно по каждой группе, кому подойдёт, цены (`#price`), финальный призыв (`#start`). Якоря — для быстрых ссылок в объявлениях. Пример выдачи свёрстан в HTML, названия и цифры в нём условные, о чём сказано под таблицей.

Рекламные страницы закрыты от индексации (`noindex,follow`), чтобы не дублировать главную в поиске; canonical и `og:url` указывают на них же на `socstat.ru`. Зеркало `socstat-lab.ru` отдаёт те же файлы, но в canonical его не ставим.

## Как отдаются

nginx отдаёт файлы напрямую, без React-приложения: `location = /`, `location = /promo`, `location = /promo-custom`, `location = /promo-placements` в `deploy/nginx/app.conf`. Поэтому правка страницы — это правка HTML-файла в `public/`, сборка приложения на неё не влияет. Локально те же адреса отдаёт плагин `landingDevServer` в `vite.config.ts`: новую страницу нужно добавить и туда.

## Счётчики и метки

- Яндекс Метрика (счётчик 38791285) и Top.Mail.Ru на всех страницах. Клик по ссылке с атрибутом `data-goal` отправляет цель Метрики с этим именем: на главной `landing_trial`, `landing_login`, `landing_plan_*`, `landing_final`; на `/promo` — `promo_start_analysis`, `promo_trial_click`; на `/promo-placements` — `promo_placements_start`, `promo_placements_trial`.
- `public/acquisition.js` при первом заходе запоминает в cookie `socstat_utm` метки `utm_*`, `rb_clickid`, `yclid`, внешний referrer и путь страницы входа. При регистрации API переносит их в `User.acquisition` (`parseAcquisitionCookie` в `api/src/repositories/accountRepository.ts`), путь — в `landingPath`. По этому полю можно сравнить регистрации с разных лендингов; в выгрузку и админку разбивка по нему пока не выведена.

## Куда попадают после входа

После входа через VK сервер всегда возвращает на `/app/dashboard` (`AUTH_SUCCESS_REDIRECT_URL`). Чтобы с лендинга попасть на нужную страницу, ссылка передаёт её в `next`: `/app/login?next=/placements`.

- `LoginPage` запоминает `next` в localStorage (`socstat-after-login`), `App` после загрузки пользователя один раз переходит туда и забывает адрес. Код — `src/utils/afterLogin.ts`.
- Разрешены только адреса из списка `ALLOWED_PATHS` (сейчас `/placements`), чтобы ссылкой нельзя было увести на чужой сайт.
- Запомненный адрес живёт 30 минут: брошенный вход не уведёт человека туда при следующем обычном входе.
- Если человек уже вошёл, `/login?next=/placements` сразу открывает подбор. Если подбор у пользователя выключен, остаётся дашборд.

## Ограничения

- Цены на лендингах зашиты в HTML и при смене тарифов правятся вручную (см. [Оплата](payments.md)).
