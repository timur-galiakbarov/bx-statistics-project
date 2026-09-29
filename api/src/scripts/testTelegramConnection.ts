import { Api, TelegramClient } from 'telegram';
import { Logger, LogLevel } from 'telegram/extensions/Logger.js';
import { StringSession } from 'telegram/sessions/StringSession.js';
import { env } from '../config/env.js';

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!Number.isInteger(env.telegramApiId) || env.telegramApiId <= 0) {
  fail('TELEGRAM_API_ID is missing or invalid.');
}

if (!/^[a-f\d]{32}$/i.test(env.telegramApiHash)) {
  fail('TELEGRAM_API_HASH is missing or invalid.');
}

const client = new TelegramClient(
  new StringSession(env.telegramSession),
  env.telegramApiId,
  env.telegramApiHash,
  { connectionRetries: 3, requestRetries: 1, baseLogger: new Logger(LogLevel.NONE) }
);

try {
  await client.connect();
  console.log('OK: connected to Telegram MTProto.');

  if (env.telegramSession) {
    const authorized = await client.isUserAuthorized();
    if (!authorized) fail('TELEGRAM_SESSION is present but is not authorized.');
    const me = await client.getMe();
    console.log(`OK: session is authorized (user id ${me.id.toString()}).`);
  } else {
    await client.invoke(new Api.auth.ExportLoginToken({
      apiId: env.telegramApiId,
      apiHash: env.telegramApiHash,
      exceptIds: []
    }));
    console.log('OK: Telegram accepted TELEGRAM_API_ID and TELEGRAM_API_HASH.');
    console.log('INFO: TELEGRAM_SESSION is not configured; run npm run telegram:login --workspace @socstat/api to authorize an account.');
  }
} catch (error) {
  const code = error && typeof error === 'object' && 'errorMessage' in error
    ? String(error.errorMessage)
    : error instanceof Error
      ? error.name
      : 'UNKNOWN_ERROR';
  fail(`Telegram connection check failed (${code}).`);
} finally {
  await client.disconnect();
}
