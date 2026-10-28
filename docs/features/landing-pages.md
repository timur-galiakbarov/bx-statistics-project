# Лендинги

Статические страницы до входа в приложение: главная `/` и рекламные `/promo`, `/promo-custom`. Приложение живёт под `/app/`, все кнопки лендингов ведут на `/app/login`.

## Страницы

- **`/` — `public/landing.html`.** Основная страница для поиска и рекламы: три площадки, кому пригодится, функции, как начать, цены, FAQ. Индексируется, canonical `https://socstat.ru/`, единственная страница в `public/sitemap.xml`. Картинки — `public/landing/*.webp`, превью для соцсетей — `public/landing/og-image.jpg`.
- **`/promo` — `public/promo.html`.** Короткая рекламная страница: первый экран, что показывает сервис, лучшие посты, сравнение с конкурентами, пробный период. Без цен по тарифам и FAQ. Картинки — `public/landing/vk.webp` (сводка и охват по дням), `public/promo-posts.png`, `public/promo-compare.png`.
- **`/promo-custom` — `public/promo-custom.html`.** Второй вариант рекламной страницы.

Рекламные страницы закрыты от индексации (`noindex,follow`), чтобы не дублировать главную в поиске; canonical и `og:url` указывают на них же на `socstat.ru`. Зеркало `socstat-lab.ru` отдаёт те же файлы, но в canonical его не ставим.

## Как отдаются

nginx отдаёт файлы напрямую, без React-приложения: `location = /`, `location = /promo`, `location = /promo-custom` в `deploy/nginx/app.conf`. Поэтому правка страницы — это правка HTML-файла в `public/`, сборка приложения на неё не влияет.

## Счётчики и метки

- Яндекс Метрика (счётчик 38791285) и Top.Mail.Ru на всех страницах. Клик по ссылке с атрибутом `data-goal` отправляет цель Метрики с этим именем: на главной `landing_trial`, `landing_login`, `landing_plan_*`, `landing_final`; на `/promo` — `promo_start_analysis`, `promo_trial_click`.
- `public/acquisition.js` при первом заходе запоминает в cookie `socstat_utm` метки `utm_*`, `rb_clickid`, `yclid`, внешний referrer и путь страницы входа. При регистрации API переносит их в `User.acquisition` (`parseAcquisitionCookie` в `api/src/repositories/accountRepository.ts`), путь — в `landingPath`. По этому полю можно сравнить регистрации с разных лендингов; в выгрузку и админку разбивка по нему пока не выведена.

## Ограничения

- Цены на лендингах зашиты в HTML и при смене тарифов правятся вручную (см. [Оплата](payments.md)).
