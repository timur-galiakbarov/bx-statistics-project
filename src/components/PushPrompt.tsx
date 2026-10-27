import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDate } from '../utils/date';
import {
  dismissPushPrompt,
  getPushState,
  isPushPromptDismissed,
  subscribeToPush,
  trackPushPrompt,
  unsubscribeFromPush,
  type PushState
} from '../utils/push';

// Баннер появляется не сразу, чтобы не встречать человека просьбой на входе.
const SHOW_DELAY_MS = 6_000;

/**
 * Soft ask before the browser permission dialog: the native prompt opens only after «Да».
 * Mounted once the user has a channel on the dashboard, so it comes after the first real action.
 */
export function PushPrompt({ activeTo, isTrial }: { activeTo?: string; isTrial: boolean }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (isPushPromptDismissed()) return;
    let isCancelled = false;
    const timeout = window.setTimeout(() => {
      getPushState()
        .then((state) => {
          if (isCancelled || state !== 'available' || Notification.permission !== 'default') return;
          setIsVisible(true);
          trackPushPrompt('shown');
        })
        .catch(() => undefined);
    }, SHOW_DELAY_MS);
    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (!isVisible) return null;

  const accept = async () => {
    setIsBusy(true);
    trackPushPrompt('accepted');
    try {
      const state = await subscribeToPush();
      if (state === 'denied') trackPushPrompt('denied');
      if (state === 'available') dismissPushPrompt();
    } catch {
      dismissPushPrompt();
    }
    setIsVisible(false);
  };

  const dismiss = () => {
    dismissPushPrompt();
    trackPushPrompt('dismissed');
    setIsVisible(false);
  };

  return (
    <div className="push-prompt" role="region" aria-label="Напоминание об окончании доступа">
      <span className="push-prompt-icon">
        <Bell size={18} />
      </span>
      <div className="push-prompt-text">
        <strong>{isTrial ? 'Напомнить о конце пробного доступа?' : 'Напомнить о конце доступа?'}</strong>
        <span>
          Пришлём уведомление в браузере за 3 дня до {activeTo ? formatDate(activeTo) : 'окончания доступа'}. Отключить
          можно в профиле.
        </span>
      </div>
      <div className="push-prompt-actions">
        <button className="primary-button push-prompt-accept" type="button" onClick={accept} disabled={isBusy}>
          Напомнить
        </button>
        <button className="push-prompt-dismiss" type="button" onClick={dismiss} disabled={isBusy}>
          Не сейчас
        </button>
      </div>
    </div>
  );
}

const stateLabels: Record<PushState, string> = {
  unsupported: 'Этот браузер не поддерживает уведомления.',
  denied: 'Уведомления запрещены в настройках браузера для socstat.ru.',
  subscribed: 'Включены: напомним за 3 дня до окончания доступа.',
  available: 'Выключены.'
};

/** Notification switch on the account page. */
export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (!state) return null;

  const toggle = async () => {
    setIsBusy(true);
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('available');
      } else {
        trackPushPrompt('accepted');
        const nextState = await subscribeToPush();
        if (nextState === 'denied') trackPushPrompt('denied');
        setState(nextState);
      }
    } catch {
      setState(await getPushState().catch(() => 'unsupported' as const));
    }
    setIsBusy(false);
  };

  return (
    <div className="push-settings">
      <div>
        <strong>Уведомления в браузере</strong>
        <span>{stateLabels[state]}</span>
      </div>
      {(state === 'subscribed' || state === 'available') && (
        <button className="secondary-button" type="button" onClick={toggle} disabled={isBusy}>
          {state === 'subscribed' ? <BellOff size={17} /> : <Bell size={17} />}
          {state === 'subscribed' ? 'Выключить' : 'Включить'}
        </button>
      )}
    </div>
  );
}
