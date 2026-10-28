const STORAGE_KEY = 'socstat-after-login';
// Вход через VK занимает минуты; брошенный вход не должен через день увести человека не туда.
const MAX_AGE_MS = 30 * 60_000;
// Только свои страницы: адрес приходит из ссылки и не должен уводить на чужой сайт.
const ALLOWED_PATHS = ['/placements'];

type StoredTarget = { path: string; savedAt: number };

export function getAfterLoginPath(next: string | null) {
  return next && ALLOWED_PATHS.includes(next) ? next : null;
}

/** Remembers where to go after VK login: the server always redirects to /dashboard. */
export function rememberAfterLogin(next: string | null) {
  const path = getAfterLoginPath(next);
  if (!path) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, savedAt: Date.now() } satisfies StoredTarget));
  } catch {
    // Без хранилища человек просто попадёт на главную приложения.
  }
}

/** Returns the remembered path once and forgets it. */
export function takeAfterLogin() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredTarget | null;
    localStorage.removeItem(STORAGE_KEY);
    if (stored && Date.now() - stored.savedAt <= MAX_AGE_MS) {
      return getAfterLoginPath(stored.path);
    }
  } catch {
    // См. выше.
  }

  return null;
}
