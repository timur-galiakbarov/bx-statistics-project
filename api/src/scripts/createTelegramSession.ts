import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/StringSession.js';
import { env } from '../config/env.js';

if (!env.telegramApiId || !env.telegramApiHash) {
  throw new Error('Сначала заполните TELEGRAM_API_ID и TELEGRAM_API_HASH в api/.env.');
}

const rl = createInterface({ input, output });
const client = new TelegramClient(new StringSession(''), env.telegramApiId, env.telegramApiHash, { connectionRetries: 5 });

try {
  await client.start({
    phoneNumber: () => rl.question('Номер телефона в международном формате: '),
    phoneCode: () => rl.question('Код от Telegram: '),
    password: () => rl.question('Пароль 2FA (если включён): '),
    onError: (error) => console.error(error.message)
  });
  output.write('\nСкопируйте значение ниже в TELEGRAM_SESSION в api/.env:\n\n');
  output.write(`${client.session.save()}\n`);
} finally {
  rl.close();
  await client.disconnect();
}
