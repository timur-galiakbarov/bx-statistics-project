# Деплой production через GitHub Actions

Workflow `.github/workflows/deploy.yml` запускается после каждого push в `master`.
Он загружает на VPS только новую версию приложения, поэтому `legacy/` на сервер не
синхронизируется и не удаляется.

## Один раз на сервере

Нужны Docker Engine, Docker Compose plugin, Nginx, Certbot и пользователь с правом
запускать `docker` без `sudo`.

Создайте каталог приложения. Значения секретов вводятся только на сервере, не в
репозитории:

```bash
sudo mkdir -p /opt/socstat
sudo chown -R "$USER" /opt/socstat
```

Первый запуск workflow загрузит шаблон и остановится, если `api/.env` ещё нет.
На сервере заполните созданный `/opt/socstat/api/.env`: задайте
`VK_CLIENT_SECRET`, `YOOMONEY_RECEIVER` (номер кошелька ЮMoney) и
`YOOMONEY_NOTIFICATION_SECRET`. Затем перезапустите workflow.

Скопируйте `deploy/nginx/socstat.conf.example` в `/etc/nginx/sites-available/socstat`,
укажите домен, включите конфигурацию и получите сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/socstat /etc/nginx/sites-enabled/socstat
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d socstat-lab.ru -d www.socstat-lab.ru
```

Настройте DNS-запись домена на IP VPS и добавьте production callback URL в настройках
VK-приложения.

## Оплата ЮMoney

В кабинете ЮMoney включите HTTP-уведомления и укажите адрес:

```text
значение YOOMONEY_NOTIFICATION_URL из /opt/socstat/api/.env
```

Секрет уведомлений из кабинета должен в точности совпадать со значением
`YOOMONEY_NOTIFICATION_SECRET` в `/opt/socstat/api/.env`. ЮMoney подписывает уведомления параметром `sign`
по HMAC-SHA256. Укажите номер кошелька
получателя в `YOOMONEY_RECEIVER`. После деплоя проверьте создание тестового платежа:
после возврата пользователь попадёт на адрес из `YOOMONEY_SUCCESS_URL`,
а подтверждённое уведомление продлит подписку автоматически.

## GitHub

В repository **Settings → Environments → production** добавьте secrets:

- `DEPLOY_HOST` — IP или имя VPS;
- `DEPLOY_PORT` — SSH-порт, обычно `22`;
- `DEPLOY_USER` — пользователь на VPS;
- `DEPLOY_SSH_KEY` — приватный ключ этого пользователя.

В том же окружении добавьте variable `DEPLOY_PATH` со значением `/opt/socstat`.
Публичную часть SSH-ключа добавьте в `~/.ssh/authorized_keys` этого пользователя на
сервере.

После push в `master` Actions пересобирает контейнеры. Проверка успешного деплоя:

```bash
curl https://socstat-lab.ru/api/health
```
