const STORAGE_KEY = 'socstat-visit';
// Как в Метрике: перерыв дольше 30 минут начинает новый визит.
const VISIT_TIMEOUT_MS = 30 * 60_000;

type StoredVisit = { id: string; lastSeen: number };

let memoryVisit: StoredVisit | null = null;

function createVisitId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Returns the id of the current visit, shared between tabs and renewed after 30 idle minutes. */
export function getVisitId() {
  const now = Date.now();
  let visit = memoryVisit;

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredVisit | null;
    if (stored && typeof stored.id === 'string' && typeof stored.lastSeen === 'number') {
      visit = stored;
    }
  } catch {
    // Хранилище может быть недоступно (приватный режим) — тогда визит живёт в памяти вкладки.
  }

  if (!visit || now - visit.lastSeen > VISIT_TIMEOUT_MS) {
    visit = { id: createVisitId(), lastSeen: now };
  }

  visit = { ...visit, lastSeen: now };
  memoryVisit = visit;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch {
    // См. выше.
  }

  return visit.id;
}
