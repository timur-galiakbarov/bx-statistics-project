import { apiPost } from '../api/client';
import { getVisitId } from './visitId';

const FIRST_HEARTBEAT_MS = 15_000;
const HEARTBEAT_MS = 30_000;
// Вкладка, забытая открытой, не должна растягивать визит: пульс идёт только при недавних действиях.
const IDLE_AFTER_MS = 2 * 60_000;

function sendActivity(type: 'page_view' | 'heartbeat', path?: string) {
  apiPost('/api/account/activity', { visitId: getVisitId(), type, path }).catch(() => undefined);
}

export type CompetitorsWidgetAction = 'open' | 'add' | 'other' | 'expand' | 'teaser';

export function trackCompetitorsWidget(label: CompetitorsWidgetAction) {
  apiPost('/api/account/ui-event', { event: 'competitors_widget', label }).catch(() => undefined);
}

export function trackPageView(path: string) {
  sendActivity('page_view', path);
}

/** Extends the current visit while the tab is visible and the user is interacting with it. */
export function startVisitHeartbeat() {
  let lastInteractionAt = Date.now();
  const markInteraction = () => { lastInteractionAt = Date.now(); };
  const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;
  interactionEvents.forEach((name) => window.addEventListener(name, markInteraction, { passive: true }));

  const beat = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastInteractionAt < IDLE_AFTER_MS) {
      sendActivity('heartbeat');
    }
  };
  let interval: number | undefined;
  const timeout = window.setTimeout(() => {
    beat();
    interval = window.setInterval(beat, HEARTBEAT_MS);
  }, FIRST_HEARTBEAT_MS);

  return () => {
    window.clearTimeout(timeout);
    window.clearInterval(interval);
    interactionEvents.forEach((name) => window.removeEventListener(name, markInteraction));
  };
}
