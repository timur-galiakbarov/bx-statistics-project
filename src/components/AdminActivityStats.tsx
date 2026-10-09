import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiGet } from '../api/client';
import type { AdminActivityDay, AdminActivityStats, AdminActivitySummary, AdminPreviewStats, AdminPushStats } from '../api/types';

const periodOptions = [7, 30, 90] as const;

const chartModes = [
  { key: 'users', label: 'Пользователи' },
  { key: 'visits', label: 'Визиты и отказы' },
  { key: 'groups', label: 'Добавлено каналов' },
  { key: 'revenue', label: 'Выручка' }
] as const;

type ChartMode = (typeof chartModes)[number]['key'];

const chartSeries: Record<ChartMode, Array<{ key: string; name: string; color: string }>> = {
  users: [
    { key: 'returning', name: 'Вернувшиеся', color: '#4caf50' },
    { key: 'newUsers', name: 'Новые', color: '#a5d6a7' }
  ],
  visits: [
    { key: 'engaged', name: 'Без отказа', color: '#4caf50' },
    { key: 'bounces', name: 'Отказы', color: '#ef9a9a' }
  ],
  groups: [{ key: 'groupsAdded', name: 'Каналов', color: '#4caf50' }],
  revenue: [{ key: 'revenue', name: 'Выручка, ₽', color: '#4caf50' }]
};

const actionLabels: Record<string, string> = {
  login: 'Вход через VK',
  registration: 'Регистрация',
  source_search: 'Искал источник',
  group_added: 'Добавил канал',
  group_removed: 'Удалил канал',
  analytics_view: 'Открыл аналитику',
  compare_run: 'Запустил сравнение',
  posts_analyze: 'Анализ публикаций',
  collection_saved: 'Сохранил подборку',
  payment_started: 'Перешёл к оплате',
  competitors_widget: 'Виджет конкурентов',
  competitors_saved: 'Сохранил конкурентов',
  ad_return: 'Вернулся по рекламе',
  push_prompt: 'Запрос уведомлений',
  push_click: 'Кликнул по уведомлению',
  analytics_preview: 'Открыл краткий отчёт',
  preview_unlock: 'Клик по закрытому блоку',
  payment: 'Оплатил'
};

const pageLabels: Record<string, string> = {
  '/dashboard': 'Главная',
  '/analytics': 'Аналитика',
  '/compare': 'Сравнение',
  '/posts': 'Публикации',
  '/account': 'Профиль и оплата',
  '/admin': 'Админка'
};

const platformLabels: Record<string, string> = {
  vk: 'ВКонтакте',
  youtube: 'YouTube',
  telegram: 'Telegram',
  mixed: 'Несколько площадок'
};

const sourceLabels: Record<string, string> = {
  free: 'Бесплатный слот',
  bonus: 'Бонусный слот',
  bookmark: 'Отслеживаемые',
  managed: 'Свои сообщества',
  favorite: 'Избранное'
};

const deviceLabels: Record<string, string> = { desktop: 'Компьютер', mobile: 'Телефон' };

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const feedTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
  // Без timeZone: в часовом поясе браузера, как и время в списках пользователей.
});
const sinceFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${numberFormatter.format(value * 100)}%`;
}

function formatShare(part: number, total: number) {
  return total > 0 ? formatPercent(part / total) : '—';
}

const reminderLabels: Record<string, string> = {
  expiry_before: 'За 3 дня',
  expiry_today: 'В день',
  expiry_after: 'Спустя 3–7 дн.'
};

const previewTargetLabels: Record<string, string> = {
  banner: 'Баннер',
  kpi: 'Показатели',
  chart: 'График',
  insights: 'Инсайты',
  posts: 'Ещё публикации',
  section: 'Вкладки',
  period: 'Период',
  refresh: 'Обновить',
  compare: 'Витрина «Сравнение»',
  posts_page: 'Витрина «Публикации»'
};

function PreviewStatsPanel({ days }: { days: number }) {
  const [stats, setStats] = useState<AdminPreviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    apiGet<AdminPreviewStats>(`/api/analytics/admin/preview-stats?days=${days}`)
      .then(setStats)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить статистику краткого отчёта.'));
  }, [days]);

  return (
    <div className="panel activity-panel span-2">
      <div className="panel-header compact">
        <div>
          <h2>Краткий отчёт без доступа</h2>
          <p className="activity-note">{stats ? `За ${days} дней, без админов. Оплата засчитывается, если пришла после первого просмотра` : 'Загрузка…'}</p>
        </div>
      </div>
      {error && <div className="form-message">{error}</div>}
      {stats && (stats.viewers === 0 ? <div className="empty-state">Краткий отчёт за период никто не открывал.</div> : (
        <div className="push-stats-grid">
          <div>
            <h3>Воронка</h3>
            <ul className="activity-funnel">
              {[
                { label: `Открыли краткий отчёт (${formatNumber(stats.views)} просм.)`, value: stats.viewers },
                { label: 'Кликнули по закрытому блоку', value: stats.unlockUsers },
                { label: `Оплатили после просмотра${stats.revenue ? ` · ${formatNumber(stats.revenue)} ₽` : ''}`, value: stats.paidUsers }
              ].map((step) => (
                <li key={step.label}>
                  <span>{step.label}</span>
                  <strong>{formatNumber(step.value)} <small>{formatShare(step.value, stats.viewers)}</small></strong>
                  <i style={{ width: `${Math.min(1, step.value / stats.viewers) * 100}%` }} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Что хотели открыть</h3>
            {stats.unlockTargets.length === 0 ? <div className="empty-state">Кликов по закрытым блокам не было.</div> : (
              <div className="activity-mini-table two">
                <div className="head"><span>Блок</span><span>Польз.</span></div>
                {stats.unlockTargets.map((row) => (
                  <div key={row.label}><span>{previewTargetLabels[row.label] ?? row.label}</span><span>{formatNumber(row.users)}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PushStatsPanel({ days }: { days: number }) {
  const [stats, setStats] = useState<AdminPushStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    apiGet<AdminPushStats>(`/api/push/admin/stats?days=${days}`)
      .then(setStats)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить статистику уведомлений.'));
  }, [days]);

  const prompt = stats?.prompt;
  const sentTotal = stats?.reminders.reduce((sum, row) => sum + row.sent, 0) ?? 0;

  return (
    <div className="panel activity-panel span-2">
      <div className="panel-header compact">
        <div>
          <h2>Уведомления в браузере</h2>
          <p className="activity-note">
            {stats
              ? `Подписаны сейчас: ${formatNumber(stats.subscribedUsers)} польз. (${formatNumber(stats.subscribedBrowsers)} браузеров). Запрос и напоминания — за ${days} дней, без админов`
              : 'Загрузка…'}
          </p>
        </div>
      </div>
      {error && <div className="form-message">{error}</div>}
      {stats && prompt && (
        <div className="push-stats-grid">
          <div>
            <h3>Запрос разрешения</h3>
            {prompt.shown === 0 && prompt.accepted === 0 ? <div className="empty-state">Баннер за период не показывался.</div> : (
              <ul className="activity-funnel">
                {[
                  { label: 'Увидели баннер', value: prompt.shown },
                  { label: 'Нажали «Да» или включили в профиле', value: prompt.accepted },
                  { label: 'Подписались', value: prompt.subscribed },
                  { label: 'Нажали «Не сейчас»', value: prompt.dismissed },
                  { label: 'Запретили в браузере', value: prompt.denied }
                ].map((step) => (
                  <li key={step.label}>
                    <span>{step.label}</span>
                    <strong>{formatNumber(step.value)} <small>{formatShare(step.value, prompt.shown)}</small></strong>
                    <i style={{ width: `${prompt.shown ? Math.min(1, step.value / prompt.shown) * 100 : 0}%` }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Напоминания об окончании доступа</h3>
            {sentTotal === 0 ? <div className="empty-state">Напоминаний за период не отправлялось.</div> : (
              <div className="activity-mini-table four push-reminders-table">
                <div className="head"><span>Когда</span><span>Ушло</span><span>Клики</span><span title="Оплата в течение 7 дней после напоминания">Продлили</span></div>
                {stats.reminders.map((row) => (
                  <div key={row.kind}>
                    <span>{reminderLabels[row.kind] ?? row.kind}</span>
                    <span>{formatNumber(row.sent)}</span>
                    <span>{formatNumber(row.clicked)} <small>{formatShare(row.clicked, row.sent)}</small></span>
                    <span>{formatNumber(row.renewed)} <small>{row.revenue ? `${formatNumber(row.revenue)} ₽` : formatShare(row.renewed, row.sent)}</small></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин ${String(seconds % 60).padStart(2, '0')} с`;
}

function formatDay(date: string) {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`));
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = (current - previous) / previous;
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : '';
  return <small className={`activity-delta ${tone}`}>{change > 0 ? '+' : ''}{formatPercent(change)}</small>;
}

type SummaryRow = {
  label: string;
  hint?: string;
  value: (summary: AdminActivitySummary) => string;
};

const summaryRows: SummaryRow[] = [
  { label: 'Пользователи', hint: 'Уникальные пользователи, заходившие в кабинет', value: (s) => formatNumber(s.users) },
  { label: '— новые', hint: 'Зарегистрировались в этот период', value: (s) => formatNumber(s.newUsers) },
  { label: '— вернувшиеся', value: (s) => formatNumber(s.returningUsers) },
  { label: 'Визиты', hint: 'Серии просмотров с перерывом не дольше 30 минут', value: (s) => formatNumber(s.visits) },
  { label: 'Отказы', hint: 'Визит из одной страницы короче 15 секунд без действий', value: (s) => formatPercent(s.bounceRate) },
  { label: 'Время визита', hint: 'Среднее', value: (s) => formatDuration(s.avgVisitSeconds) },
  { label: 'Страниц за визит', value: (s) => (s.pagesPerVisit === null ? '—' : formatNumber(s.pagesPerVisit)) },
  { label: 'Действия', hint: 'Поиски, запуски аналитики, сравнения, добавления каналов', value: (s) => formatNumber(s.actions) },
  { label: 'Добавлено каналов', value: (s) => (s.groupsAdded ? `${formatNumber(s.groupsAdded)} · ${formatNumber(s.usersAddedGroups)} польз.` : '0') },
  { label: 'Оплаты', value: (s) => (s.payments ? `${formatNumber(s.payments)} · ${formatNumber(s.revenue)} ₽` : '0') }
];

function toChartData(daily: AdminActivityDay[]) {
  return daily.map((day) => ({
    ...day,
    label: formatDay(day.date),
    returning: Math.max(0, day.users - day.newUsers),
    engaged: Math.max(0, day.visits - day.bounces)
  }));
}

function ShareList({ items, total, label }: { items: Array<{ key: string; value: number }>; total: number; label: (key: string) => string }) {
  if (!items.length) return <div className="empty-state">Пока нет данных.</div>;
  return (
    <ul className="activity-share-list">
      {items.map((item) => (
        <li key={item.key}>
          <span>{label(item.key)}</span>
          <strong>{formatNumber(item.value)}</strong>
          <i style={{ width: `${total ? (item.value / total) * 100 : 0}%` }} />
        </li>
      ))}
    </ul>
  );
}

export function AdminActivityStats() {
  const [days, setDays] = useState<(typeof periodOptions)[number]>(30);
  const [chartMode, setChartMode] = useState<ChartMode>('users');
  const [stats, setStats] = useState<AdminActivityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const load = async (nextDays = days) => {
    setIsLoading(true);
    setError(null);
    try {
      setStats(await apiGet<AdminActivityStats>(`/api/account/admin/activity/stats?days=${nextDays}`));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить статистику посещений');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(days);
  }, [days]);

  // Полная сводка в JSON, чтобы обсуждать состояние сервиса с агентом.
  const exportForAgent = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const data = await apiGet<unknown>(`/api/account/admin/export?days=${days}`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `socstat-${new Date().toISOString().slice(0, 10)}-${days}d.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не удалось выгрузить данные');
    } finally {
      setIsExporting(false);
    }
  };

  const periods = stats?.periods;
  const funnel = stats?.funnel;
  const groupsTotal = stats?.groups.byPlatform.reduce((total, item) => total + item.count, 0) ?? 0;
  const devicesTotal = stats?.devices.reduce((total, item) => total + item.visits, 0) ?? 0;
  const maxHour = Math.max(1, ...(stats?.hours ?? [0]));

  return (
    <>
      <div className="panel activity-panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Посещаемость</h2>
            <p className="activity-note">
              Время московское, администраторы не учитываются.
              {stats && (stats.trackingSince
                ? ` Визиты, отказы и действия собираются с ${sinceFormatter.format(new Date(stats.trackingSince))}; регистрации, каналы и оплаты — за всю историю.`
                : ' Сбор визитов только что включён: отказы, время и действия появятся после первых заходов пользователей.')}
            </p>
          </div>
          <div className="activity-toolbar">
            <div className="admin-active-users-filters activity-period" role="group" aria-label="Период детализации">
              {periodOptions.map((option) => (
                <button className={days === option ? 'active' : ''} key={option} type="button" onClick={() => setDays(option)}>
                  {option} дней
                </button>
              ))}
            </div>
            <button className="secondary-button inline" type="button" onClick={() => load()} disabled={isLoading}>
              <RefreshCw className={isLoading ? 'spin' : undefined} size={18} />
              Обновить
            </button>
            <button className="secondary-button inline" title="Сводка аналитики в JSON для разговора с агентом" type="button" onClick={exportForAgent} disabled={isExporting}>
              <Download size={18} />
              {isExporting ? 'Выгрузка…' : 'Выгрузить'}
            </button>
          </div>
        </div>
        {error && <div className="debug-error">{error}</div>}
        {periods && (
          <div className="activity-hero">
            <div>
              <span>Сегодня</span>
              <strong>{formatNumber(periods.today.users)}</strong>
              <small>новых: {formatNumber(periods.today.newUsers)}</small>
            </div>
            <div>
              <span>Вчера</span>
              <strong>{formatNumber(periods.yesterday.users)}</strong>
              <small>новых: {formatNumber(periods.yesterday.newUsers)}</small>
            </div>
            <div>
              <span>За 7 дней</span>
              <strong>{formatNumber(periods.week.users)}</strong>
              <small>к прошлой неделе <Delta current={periods.week.users} previous={periods.previousWeek.users} /></small>
            </div>
            <div>
              <span>Отказы за 7 дней</span>
              <strong>{formatPercent(periods.week.bounceRate)}</strong>
              <small>визитов: {formatNumber(periods.week.visits)}</small>
            </div>
          </div>
        )}
      </div>

      {periods && stats && funnel && <>
        <div className="panel activity-panel span-2">
          <div className="panel-header compact"><div><h2>Сводка по периодам</h2></div></div>
          <div className="activity-summary-table" role="table">
            <div className="activity-summary-row head" role="row">
              <span role="columnheader">Показатель</span>
              <span role="columnheader">Сегодня</span>
              <span role="columnheader">Вчера</span>
              <span role="columnheader">7 дней</span>
              <span role="columnheader">30 дней</span>
            </div>
            {summaryRows.map((row) => (
              <div className="activity-summary-row" key={row.label} role="row">
                <span role="rowheader" title={row.hint}>{row.label}</span>
                <span role="cell" data-label="Сегодня">{row.value(periods.today)}</span>
                <span role="cell" data-label="Вчера">{row.value(periods.yesterday)}</span>
                <span role="cell" data-label="7 дней">{row.value(periods.week)}</span>
                <span role="cell" data-label="30 дней">{row.value(periods.month)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel activity-panel span-2">
          <div className="panel-header compact">
            <div><h2>По дням</h2></div>
            <div className="admin-active-users-filters activity-chart-modes" role="group" aria-label="Показатель графика">
              {chartModes.map((mode) => (
                <button className={chartMode === mode.key ? 'active' : ''} key={mode.key} type="button" onClick={() => setChartMode(mode.key)}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="activity-chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={toChartData(stats.daily)} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#eef1ef" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#77837b' }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#77837b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(76, 175, 80, 0.08)' }}
                  contentStyle={{ border: '1px solid #dce3ea', borderRadius: 3, boxShadow: '0 8px 24px rgba(23, 55, 47, 0.12)' }}
                  formatter={(value) => formatNumber(Number(value))}
                />
                {chartSeries[chartMode].map((series, index, all) => (
                  <Bar
                    dataKey={series.key}
                    fill={series.color}
                    key={series.key}
                    name={series.name}
                    radius={index === all.length - 1 ? [3, 3, 0, 0] : 0}
                    stackId="day"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="activity-legend">
            {chartSeries[chartMode].map((series) => (
              <span key={series.key}><i style={{ background: series.color }} />{series.name}</span>
            ))}
          </div>
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Вовлечённость</h2><p className="activity-note">За последние 30 дней</p></div></div>
          <div className="activity-kpis">
            <div><span>Средний DAU за 7 дней</span><strong>{formatNumber(stats.engagement.avgDau7)}</strong></div>
            <div><span>MAU</span><strong>{formatNumber(stats.engagement.mau)}</strong></div>
            <div title="Средний DAU / MAU: какая доля месячной аудитории заходит каждый день">
              <span>Липкость DAU/MAU</span><strong>{formatPercent(stats.engagement.stickiness)}</strong>
            </div>
            <div><span>Активных дней на пользователя</span><strong>{stats.engagement.avgActiveDays30 === null ? '—' : formatNumber(stats.engagement.avgActiveDays30)}</strong></div>
            <div><span>Визитов на пользователя</span><strong>{stats.engagement.visitsPerUser30 === null ? '—' : formatNumber(stats.engagement.visitsPerUser30)}</strong></div>
            <div title={`Из ${stats.engagement.returnCohort} зарегистрировавшихся за ${stats.days} дней (кроме сегодняшних)`}>
              <span>Вернулись после регистрации</span><strong>{formatPercent(stats.engagement.returnRate)}</strong>
            </div>
          </div>
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Воронка новых пользователей</h2><p className="activity-note">Зарегистрировались за {stats.days} дней</p></div></div>
          {funnel.registered === 0 ? <div className="empty-state">За период регистраций не было.</div> : (
            <ul className="activity-funnel">
              {[
                { label: 'Зарегистрировались', value: funnel.registered },
                { label: 'Добавили канал', value: funnel.addedGroup },
                { label: 'Открыли аналитику', value: funnel.usedAnalytics },
                { label: 'Вернулись в другой день', value: funnel.returned },
                { label: 'Оплатили', value: funnel.paid }
              ].map((step) => (
                <li key={step.label}>
                  <span>{step.label}</span>
                  <strong>{formatNumber(step.value)} <small>{formatShare(step.value, funnel.registered)}</small></strong>
                  <i style={{ width: `${(step.value / funnel.registered) * 100}%` }} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Добавленные каналы</h2><p className="activity-note">За {stats.days} дней: {formatNumber(groupsTotal)}</p></div></div>
          <div className="activity-columns">
            <div>
              <h3>Площадки</h3>
              <ShareList items={stats.groups.byPlatform.map(({ key, count }) => ({ key, value: count }))} total={groupsTotal} label={(key) => platformLabels[key] ?? key} />
            </div>
            <div>
              <h3>Как добавили</h3>
              <ShareList items={stats.groups.bySource.map(({ key, count }) => ({ key, value: count }))} total={groupsTotal} label={(key) => sourceLabels[key] ?? key} />
            </div>
          </div>
          {stats.groups.top.length > 0 && <>
            <h3>Популярные каналы</h3>
            <ol className="activity-top-list">
              {stats.groups.top.map((channel) => (
                <li key={`${channel.platform}:${channel.name}`}>
                  <span>{channel.name} <small>{platformLabels[channel.platform] ?? channel.platform}</small></span>
                  <strong>{formatNumber(channel.users)}</strong>
                </li>
              ))}
            </ol>
          </>}
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Что делали пользователи</h2><p className="activity-note">За {stats.days} дней</p></div></div>
          {stats.actions.length === 0 ? <div className="empty-state">Действий пока не записано.</div> : (
            <div className="activity-mini-table">
              <div className="head"><span>Действие</span><span>Раз</span><span>Польз.</span></div>
              {stats.actions.map((action) => (
                <div key={action.type}>
                  <span>{actionLabels[action.type] ?? action.type}</span>
                  <span>{formatNumber(action.count)}</span>
                  <span>{formatNumber(action.users)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Страницы</h2><p className="activity-note">Сколько визитов заходило на страницу и с какой начиналось</p></div></div>
          {stats.pages.length === 0 ? <div className="empty-state">Просмотров пока не записано.</div> : (
            <div className="activity-mini-table four">
              <div className="head"><span>Страница</span><span>Визиты</span><span>Польз.</span><span>Входы</span></div>
              {stats.pages.map((page) => (
                <div key={page.path}>
                  <span>{pageLabels[page.path] ?? page.path}</span>
                  <span>{formatNumber(page.visits)}</span>
                  <span>{formatNumber(page.users)}</span>
                  <span>{formatNumber(page.entries)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel activity-panel">
          <div className="panel-header compact"><div><h2>Когда и откуда заходят</h2><p className="activity-note">Начало визитов по часам (МСК) и устройства</p></div></div>
          <div className="activity-hours" aria-label="Визиты по часам">
            {stats.hours.map((count, hour) => (
              <span key={hour} title={`${hour}:00–${hour}:59 — ${count} визитов`}>
                <i style={{ height: `${(count / maxHour) * 100}%` }} />
                {hour % 3 === 0 && <small>{hour}</small>}
              </span>
            ))}
          </div>
          <ShareList items={stats.devices.map(({ key, visits }) => ({ key, value: visits }))} total={devicesTotal} label={(key) => deviceLabels[key] ?? key} />
        </div>

        <div className="panel activity-panel span-2">
          <div className="panel-header compact"><div><h2>Источники регистраций</h2><p className="activity-note">UTM-метки первого захода, регистрации за {stats.days} дней</p></div></div>
          {stats.acquisition.length === 0 ? <div className="empty-state">За период регистраций не было.</div> : (
            <div className="activity-mini-table five">
              <div className="head"><span>Источник</span><span>Кампания</span><span>Регистрации</span><span>Добавили канал</span><span>Оплатили</span></div>
              {stats.acquisition.map((row) => (
                <div key={`${row.source}:${row.campaign}`}>
                  <span>{row.source}</span>
                  <span>{row.campaign || '—'}</span>
                  <span>{formatNumber(row.registrations)}</span>
                  <span>{formatNumber(row.addedGroup)} <small>{formatShare(row.addedGroup, row.registrations)}</small></span>
                  <span>{formatNumber(row.paid)} <small>{formatShare(row.paid, row.registrations)}</small></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel activity-panel span-2">
          <div className="panel-header compact"><div><h2>Возвраты по рекламе</h2><p className="activity-note">Уже зарегистрированные пользователи, пришедшие по ссылке с метками, за {stats.days} дней; оплаты — в 30 дней после возврата</p></div></div>
          {stats.adReturns.length === 0 ? <div className="empty-state">За период возвратов по рекламе не было.</div> : (
            <div className="activity-mini-table four">
              <div className="head"><span>Источник / кампания</span><span>Вернулись</span><span>Оплатили</span><span>Выручка</span></div>
              {stats.adReturns.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <span>{formatNumber(row.users)}</span>
                  <span>{formatNumber(row.paid)} <small>{formatShare(row.paid, row.users)}</small></span>
                  <span>{formatNumber(row.revenue)} ₽</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <PushStatsPanel days={stats.days} />
        <PreviewStatsPanel days={stats.days} />

        <div className="panel activity-panel span-2">
          <div className="panel-header compact"><div><h2>Лента событий</h2><p className="activity-note">Последние действия, регистрации и оплаты</p></div></div>
          {stats.feed.length === 0 ? <div className="empty-state">Событий пока нет.</div> : (
            <ul className="activity-feed">
              {stats.feed.map((item) => (
                <li key={item.id}>
                  <time>{feedTimeFormatter.format(new Date(item.at))}</time>
                  <strong>{item.userName}</strong>
                  <span className={`activity-feed-type ${item.type}`}>{actionLabels[item.type] ?? item.type}</span>
                  <small>
                    {[
                      item.platform ? platformLabels[item.platform] ?? item.platform : null,
                      item.label,
                      item.amount ? `${formatNumber(item.amount)} ₽` : null
                    ].filter(Boolean).join(' · ')}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>}
    </>
  );
}
