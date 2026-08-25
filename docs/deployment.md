# Деплой production через GitHub Actions

Workflow `.github/workflows/deploy.yml` запускается после каждого push в `main`.
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
На сервере заполните созданный `/opt/socstat/api/.env`: замените
`socstat.example.com` на свой домен и задайте `VK_CLIENT_SECRET` и
`YOOMONEY_NOTIFICATION_SECRET`. Затем перезапустите workflow.

Скопируйте `deploy/nginx/socstat.conf.example` в `/etc/nginx/sites-available/socstat`,
укажите домен, включите конфигурацию и получите сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/socstat /etc/nginx/sites-enabled/socstat
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d socstat.example.com
```

Настройте DNS-запись домена на IP VPS и добавьте production callback URL в настройках
VK-приложения.

## GitHub

В repository **Settings → Environments → production** добавьте secrets:

- `DEPLOY_HOST` — IP или имя VPS;
- `DEPLOY_PORT` — SSH-порт, обычно `22`;
- `DEPLOY_USER` — пользователь на VPS;
- `DEPLOY_SSH_KEY` — приватный ключ этого пользователя.

В том же окружении добавьте variable `DEPLOY_PATH` со значением `/opt/socstat`.
Публичную часть SSH-ключа добавьте в `~/.ssh/authorized_keys` этого пользователя на
сервере.

После push в `main` Actions пересобирает контейнеры. Проверка успешного деплоя:

```bash
curl https://socstat.example.com/api/health
```
