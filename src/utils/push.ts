import { apiGet, apiPost } from '../api/client';

export type PushPromptEvent = 'shown' | 'accepted' | 'dismissed' | 'denied';
export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'available';

type PushConfig = { enabled: boolean; publicKey: string | null; subscriptions: number; returningVisit: boolean };

const DISMISSED_KEY = 'socstat_push_prompt_dismissed_at';
// После «Не сейчас» спрашиваем снова не раньше чем через три недели.
const DISMISS_FOR_MS = 21 * 86_400_000;

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

/** Whether the user came back after an earlier visit: the first visit is for the product, not for asks. */
export async function isReturningVisit() {
  return (await apiGet<PushConfig>('/api/push/config')).returningVisit;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const config = await apiGet<PushConfig>('/api/push/config');
  if (!config.enabled || !config.publicKey) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const subscription = Notification.permission === 'granted' ? await currentSubscription() : null;
  if (subscription) {
    // Подписка браузера жива, а на сервере её нет (например, вход под другим аккаунтом) — восстанавливаем.
    await apiPost('/api/push/subscribe', subscription.toJSON());
    return 'subscribed';
  }
  return 'available';
}

/** Asks the browser for permission and stores the subscription on the server. */
export async function subscribeToPush(): Promise<PushState> {
  const config = await apiGet<PushConfig>('/api/push/config');
  if (!config.publicKey) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'available';

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey)
    }));
  await apiPost('/api/push/subscribe', subscription.toJSON());
  return 'subscribed';
}

export async function unsubscribeFromPush() {
  const subscription = await currentSubscription();
  await apiPost('/api/push/unsubscribe', subscription ? { endpoint: subscription.endpoint } : {});
  await subscription?.unsubscribe();
}

export function trackPushPrompt(label: PushPromptEvent) {
  apiPost('/api/push/prompt', { label }).catch(() => undefined);
}

export function isPushPromptDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY));
    return Boolean(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function dismissPushPrompt() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Без localStorage баннер просто покажется в следующий раз.
  }
}
