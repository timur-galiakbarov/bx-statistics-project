import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase } from '../db/database.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { UserModel } from '../models/User.js';
import { getCommunityAnalytics } from '../services/analyticsService.js';
import { getDashboardSummaryItem } from '../services/dashboardService.js';

// Проверка всех периодов аналитики и дашборда, которые считаются через partnerStats.
// Обязательно запускать и под TZ=UTC: прод-контейнер живёт в UTC, и конец периода «сегодня»
// там уезжает за московские сутки — так 12.11.2026 прод получил VK error 100 после релиза.
// npm run check:partner-stats-periods --workspace @socstat/api -- [--group <id>] [--vk-user-id <id>]

const ANALYTICS_PERIODS = ['week', 'twoWeek', 'month', 'currentMonth', 'previousMonth'];
const DASHBOARD_PERIODS = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'currentMonth'];
const CUSTOM_PERIOD_DAYS = 90;

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const [key, inlineValue] = item.split('=');
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function describe(error: unknown) {
  const typed = error as { message?: string; code?: string; vkCode?: number };
  return `${typed.code ?? 'ERROR'}${typed.vkCode ? ` vk=${typed.vkCode}` : ''}: ${typed.message ?? String(error)}`;
}

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

let failed = 0;

function report(name: string, ok: boolean, details: Record<string, unknown> = {}) {
  if (!ok) failed += 1;
  const tail = Object.entries(details)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${tail ? ` ${tail}` : ''}`);
}

async function main() {
  await connectDatabase();
  console.log(`TZ=${process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  const vkUserId = args['vk-user-id'] ?? env.adminVkIds[0];
  const user = vkUserId ? await UserModel.findOne({ vkId: vkUserId }, { _id: 1, vkId: 1 }).lean() : null;
  if (!user) {
    console.log(`Не нашёл пользователя vkId=${vkUserId ?? '(пусто)'}`);
    process.exit(1);
  }

  const userId = String(user._id);
  const groupId = args.group ?? env.socstatVkGroupId;
  console.log(`Пользователь vkId=${user.vkId}, сообщество ${groupId}\n`);

  for (const period of ANALYTICS_PERIODS) {
    try {
      const analytics = await getCommunityAnalytics(userId, groupId, period, undefined, undefined, true);
      report(`аналитика ${period}`, true, {
        unavailable: analytics.stats.unavailable,
        days: analytics.stats.dayGroups?.length ?? 0,
        views: analytics.stats.views,
        reach: analytics.stats.reach
      });
    } catch (error) {
      report(`аналитика ${period}`, false, { error: describe(error) });
    }
  }

  const customTo = new Date();
  const customFrom = new Date(customTo.getTime() - (CUSTOM_PERIOD_DAYS - 1) * 86_400_000);
  try {
    const analytics = await getCommunityAnalytics(userId, groupId, 'custom', iso(customFrom), iso(customTo), true);
    report(`аналитика custom ${CUSTOM_PERIOD_DAYS} дней`, true, {
      unavailable: analytics.stats.unavailable,
      views: analytics.stats.views
    });
  } catch (error) {
    report(`аналитика custom ${CUSTOM_PERIOD_DAYS} дней`, false, { error: describe(error) });
  }

  const savedGroup = await SavedGroupModel.findOne({ userId: user._id, platform: 'vk', externalId: groupId }, { _id: 1 }).lean()
    ?? await SavedGroupModel.findOne({ userId: user._id, platform: 'vk' }, { _id: 1 }).lean();

  if (!savedGroup) {
    console.log('\n[SKIP] дашборд: у пользователя нет VK-источников');
  } else {
    console.log('');
    for (const period of DASHBOARD_PERIODS) {
      for (const premium of [true, false]) {
        try {
          const result = await getDashboardSummaryItem(userId, String(savedGroup._id), period, true, premium);
          const row = (result as unknown as { groups?: Array<{ error?: unknown; statsAvailable?: boolean | null; traffic?: { views?: number } }> }).groups?.[0];
          const ok = !row?.error;
          report(`дашборд ${period} (${premium ? 'тариф' : 'без тарифа'})`, ok, {
            statsAvailable: row?.statsAvailable,
            views: row?.traffic?.views,
            error: row?.error ? describe(row.error) : undefined
          });
        } catch (error) {
          report(`дашборд ${period} (${premium ? 'тариф' : 'без тарифа'})`, false, { error: describe(error) });
        }
      }
    }
  }

  console.log(`\nИтог: ${failed ? `${failed} с ошибками` : 'все периоды прошли'}`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

await main();
