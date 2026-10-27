import { MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { apiPost } from '../api/client';
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

/** Кнопка «Подключить» открывает диалог с сообществом, «Проверить» спрашивает VK, разрешены ли сообщения. */
function useVkConnect(settings: Settings, onChanged: () => Promise<void>) {
  const [isWaiting, setIsWaiting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    window.open(settings.connectUrl, '_blank', 'noopener,noreferrer');
    setIsWaiting(true);
    setError(null);
  };

  const check = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const next = await apiPost<Settings>('/api/notifications/vk/check');
      if (!next.vkConnected) setError('Пока не видим сообщения от вас. Напишите сообществу любое слово и нажмите «Проверить» ещё раз.');
      await onChanged();
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
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged);

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
  const { isWaiting, isChecking, error, connect, check } = useVkConnect(settings, onChanged);
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
