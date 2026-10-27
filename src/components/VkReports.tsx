import { Check, MessageCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import type { VkReportSettings as Settings } from '../api/types';

const DISMISSED_KEY = 'socstat_vk_report_prompt_dismissed_at';
// После «Не сейчас» плашка возвращается через 3 недели, как и запрос push.
const DISMISS_FOR_MS = 21 * 86_400_000;

export function isVkReportPromptDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY));
    return Boolean(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function dismissVkReportPrompt() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Без localStorage плашка просто покажется в следующий раз.
  }
}

// Не больше одной просьбы за визит: показали плашку отчёта — запрос push ждёт следующего визита.
const PROMPT_THIS_VISIT_KEY = 'socstat_vk_report_prompt_this_visit';

export function wasVkReportPromptShownThisVisit() {
  try {
    return sessionStorage.getItem(PROMPT_THIS_VISIT_KEY) === '1';
  } catch {
    return false;
  }
}

function markVkReportPromptShownThisVisit() {
  try {
    sessionStorage.setItem(PROMPT_THIS_VISIT_KEY, '1');
  } catch {
    // Без sessionStorage запрос push может появиться в том же визите.
  }
}

/** Где нажали «Подключить» — для статистики точек входа в админке. */
export type VkReportPlace = 'banner' | 'dashboard' | 'competitors' | 'profile';

/** Кнопка «Подключить» открывает диалог с сообществом, «Проверить» спрашивает VK, разрешены ли сообщения. */
function useVkConnect(settings: Settings, onChanged: (next: Settings) => void | Promise<void>, place: VkReportPlace) {
  const [isWaiting, setIsWaiting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    window.open(settings.connectUrl, '_blank', 'noopener,noreferrer');
    apiPost('/api/account/ui-event', { event: 'vk_report_connect', label: place }).catch(() => undefined);
    setIsWaiting(true);
    setError(null);
  };

  const check = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const next = await apiPost<Settings>('/api/notifications/vk/check');
      if (!next.vkConnected) setError('Пока не видим сообщения от вас. Напишите сообществу любое слово и нажмите «Проверить» ещё раз.');
      await onChanged(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось проверить.');
    } finally {
      setIsChecking(false);
    }
  };

  return { isWaiting, isChecking, error, connect, check };
}

/** Плашка после добавления первого источника: предлагает получать итоги недели во VK. */
export function VkReportPrompt({ settings, onChanged }: { settings: Settings; onChanged: () => Promise<void> }) {
  const [isVisible, setIsVisible] = useState(true);
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged, 'banner');

  useEffect(() => {
    markVkReportPromptShownThisVisit();
  }, []);

  if (!isVisible || settings.vkConnected) return null;

  const dismiss = () => {
    dismissVkReportPrompt();
    setIsVisible(false);
  };

  return (
    <div className="push-prompt" role="region" aria-label="Отчёт во VK">
      <span className="push-prompt-icon">
        <MessageCircle size={18} />
      </span>
      <div className="push-prompt-text">
        <strong>{isWaiting ? 'Напишите сообществу socstat любое сообщение' : 'Присылать итоги недели во VK?'}</strong>
        <span>
          {isWaiting
            ? 'Например, «привет» — подключим отчёт автоматически. Если плашка не исчезла, нажмите «Проверить».'
            : 'Каждый понедельник: прирост подписчиков, лучший пост и место среди конкурентов. Сообщением от сообщества socstat.'}
        </span>
        {error && <span className="vk-report-error">{error}</span>}
      </div>
      <div className="push-prompt-actions">
        {isWaiting ? (
          <button className="primary-button push-prompt-accept" type="button" onClick={check} disabled={isChecking}>
            Проверить
          </button>
        ) : (
          <button className="primary-button push-prompt-accept" type="button" onClick={connect}>
            Подключить
          </button>
        )}
        <button className="push-prompt-dismiss" type="button" onClick={dismiss} disabled={isChecking}>
          Не сейчас
        </button>
      </div>
    </div>
  );
}

/** Блок в профиле: подключение сообщений и включение отчёта. */
export function VkReportSettings({ settings, onChanged }: { settings: Settings; onChanged: () => Promise<void> }) {
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged, 'profile');
  const [isSaving, setIsSaving] = useState(false);

  const toggleWeekly = async () => {
    setIsSaving(true);
    try {
      await apiPost<Settings>('/api/notifications/settings', { weeklyReport: !settings.weeklyReport });
      await onChanged();
    } finally {
      setIsSaving(false);
    }
  };

  const status = !settings.vkConnected
    ? isWaiting
      ? 'Напишите сообществу socstat любое сообщение и нажмите «Проверить».'
      : 'Не подключён: итоги недели по вашим источникам по понедельникам сообщением во VK.'
    : settings.weeklyReport
      ? 'Включён: итоги недели приходят по понедельникам сообщением от сообщества socstat.'
      : 'Выключен.';

  return (
    <div className="push-settings">
      <div>
        <strong>Отчёт во VK</strong>
        <span>{status}</span>
        {error && <span className="vk-report-error">{error}</span>}
      </div>
      {settings.vkConnected ? (
        <button className="secondary-button" type="button" onClick={toggleWeekly} disabled={isSaving}>
          {settings.weeklyReport ? 'Выключить' : 'Включить'}
        </button>
      ) : (
        <div className="vk-report-actions">
          <button className="secondary-button" type="button" onClick={connect}>
            <MessageCircle size={17} />
            Подключить
          </button>
          {isWaiting && (
            <button className="secondary-button" type="button" onClick={check} disabled={isChecking}>
              <RefreshCw size={17} className={isChecking ? 'spin' : undefined} />
              Проверить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Ссылка рядом с заголовком источников на главной; после подключения — тихая отметка. */
export function VkReportDashboardLink({ settings, onChanged }: { settings: Settings; onChanged: () => Promise<void> }) {
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged, 'dashboard');

  if (settings.vkConnected) {
    return settings.weeklyReport
      ? <span className="vk-report-link-done"><Check size={15} aria-hidden="true" />Итоги недели приходят во VK</span>
      : null;
  }

  return (
    <span className="vk-report-link">
      {isWaiting ? (
        <button className="vk-report-link-button" type="button" onClick={check} disabled={isChecking} title="Напишите сообществу socstat любое сообщение и нажмите, чтобы проверить">
          <RefreshCw size={15} className={isChecking ? 'spin' : undefined} aria-hidden="true" />
          Проверить подключение
        </button>
      ) : (
        <button className="vk-report-link-button" type="button" onClick={connect}>
          <MessageCircle size={15} aria-hidden="true" />
          Итоги недели во VK
        </button>
      )}
      {error && <span className="vk-report-error">{error}</span>}
    </span>
  );
}

/**
 * Строка в панели конкурентов: место среди конкурентов — главное в отчёте, поэтому предлагаем его здесь.
 * Панель встроена в страницы аналитики без аккаунта, поэтому настройки отчёта загружаются здесь же.
 */
export function VkReportCompetitorsHint() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<Settings>('/api/notifications/settings').then((next) => { if (active) setSettings(next); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!settings?.enabled || settings.vkConnected) return null;
  return <CompetitorsHint settings={settings} onChanged={setSettings} />;
}

function CompetitorsHint({ settings, onChanged }: { settings: Settings; onChanged: (next: Settings) => void }) {
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged, 'competitors');

  return (
    <div className="vk-report-hint">
      <MessageCircle size={17} aria-hidden="true" />
      <span>
        {isWaiting
          ? 'Напишите сообществу socstat любое сообщение и нажмите «Проверить».'
          : 'Присылать место среди конкурентов раз в неделю во VK?'}
        {error && <span className="vk-report-error">{error}</span>}
      </span>
      {isWaiting ? (
        <button className="secondary-button inline" type="button" onClick={check} disabled={isChecking}>Проверить</button>
      ) : (
        <button className="secondary-button inline" type="button" onClick={connect}>Подключить</button>
      )}
    </div>
  );
}
