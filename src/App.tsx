import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  GitCompare,
  Home,
  MapPin,
  LogOut,
  Menu,
  Newspaper,
  Shield,
  ShieldCheck,
  Users
} from 'lucide-react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from './api/client';
import type { SavedGroup, User } from './api/types';
import { isAccessActive } from './components/AccessLock';
import { CompareShowcase, PostsShowcase } from './components/FeatureShowcase';
import { PushPrompt } from './components/PushPrompt';
import { isVkReportPromptDismissed, VkReportPrompt, wasVkReportPromptShownThisVisit } from './components/VkReports';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { AdCheckPage } from './pages/AdCheckPage';
import { AdminPage } from './pages/AdminPage';
import { PlacementsPage } from './pages/PlacementsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComparePage } from './pages/ComparePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PostsPage } from './pages/PostsPage';
import { VkImplicitCallbackPage } from './pages/VkImplicitCallbackPage';
import { formatDate } from './utils/date';
import { startVisitHeartbeat, trackPageView } from './utils/visit';

type NavItem = { to: string; label: string; icon: typeof Home; description?: string; adminOnly?: boolean; feature?: 'placements' };

// Подпись под пунктом объясняет, зачем он нужен. feature — пункт показывается, только когда переключатель фичи
// включён этому пользователю.
const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд', icon: Home, description: 'Ваши источники за период' },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3, description: 'Отчёты по сообществам и каналам' },
  { to: '/placements', label: 'Площадки для рекламы', icon: MapPin, description: 'AI подберёт площадки ВК', feature: 'placements' },
  { to: '/compare', label: 'Сравнение', icon: GitCompare, description: 'Метрики до 10 сообществ рядом' },
  { to: '/posts', label: 'Идеи для постов', icon: Newspaper, description: 'Лучшие посты в вашей нише' },
  { to: '/ad-check', label: 'Проверка канала', icon: ClipboardCheck, adminOnly: true },
  { to: '/account', label: 'Профиль и оплата', icon: CreditCard }
];

const adminNavItem: NavItem = { to: '/admin', label: 'Админка', icon: Shield, adminOnly: true };
function TelegramAnalyticsRedirect() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.set('platform', 'telegram');
  return <Navigate replace to={`/analytics?${searchParams.toString()}`} />;
}

export function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const isSendingGoalsRef = useRef(false);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const topMailLastUrlRef = useRef(`${location.pathname}${location.search}`);

  const loadAccount = useCallback(
    () =>
      Promise.all([
        apiGet<{ user: User }>('/api/account/me'),
        apiGet<SavedGroup[]>('/api/account/groups')
      ])
        .then(([profile, nextGroups]) => {
          setUser(profile.user);
          setGroups(nextGroups);
          setIsUnauthorized(false);
        })
        .catch(() => {
          setUser(null);
          setGroups([]);
          setIsUnauthorized(true);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (import.meta.env.PROD) {
      window.ym?.(38791285, 'hit', `${location.pathname}${location.search}`);
    }

    const currentUrl = `${location.pathname}${location.search}`;
    if (topMailLastUrlRef.current !== currentUrl) {
      topMailLastUrlRef.current = currentUrl;
      window._tmr?.push({ id: '3798785', type: 'pageView', url: currentUrl });
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user) {
      trackPageView(location.pathname);
    }
  }, [location.pathname, user?.id]);

  useEffect(() => (user ? startVisitHeartbeat() : undefined), [user?.id]);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Регистрация и оплата фиксируются на сервере, а в счётчики VK Ads и Метрики уходят отсюда.
    if (isSendingGoalsRef.current) {
      return;
    }

    isSendingGoalsRef.current = true;
    apiGet<Array<{ id: string; goal: string; value?: number }>>('/api/account/goals')
      .then((goals) => {
        if (!goals.length) {
          return;
        }

        goals.forEach(({ goal, value }) => {
          window._tmr?.push({ type: 'reachGoal', id: '3798785', goal, ...(value ? { value } : {}) });
          window.ym?.(38791285, 'reachGoal', goal, value ? { order_price: value, currency: 'RUB' } : undefined);
        });

        return apiPost('/api/account/goals/ack', { ids: goals.map(({ id }) => id) });
      })
      .catch(() => undefined)
      .finally(() => {
        isSendingGoalsRef.current = false;
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const events = new EventSource('/api/account/events');
    const refreshAccount = () => void loadAccount();
    events.addEventListener('account-updated', refreshAccount);

    return () => {
      events.removeEventListener('account-updated', refreshAccount);
      events.close();
    };
  }, [loadAccount, user?.id]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !menuRef.current) return;
      const focusable = Array.from(menuRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [isMobileMenuOpen]);

  const logout = async () => {
    await apiPost('/api/auth/logout');
    setUser(null);
    setGroups([]);
    setIsUnauthorized(true);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const title = useMemo(() => {
    return [...navItems, adminNavItem].find((item) => location.pathname.startsWith(item.to))?.label ?? 'Socstat';
  }, [location.pathname]);
  const visibleNavItems = [...navItems, adminNavItem].filter((item) => (!item.adminOnly || user?.isAdmin) && (!item.feature || user?.placementsEnabled));
  const hasPaidAccess = (user?.isAdmin && !user.enforceAccessRestrictions) || isAccessActive(user?.activeTo);
  const isTrialActive = Boolean(user?.trialEndsAt && new Date(user.trialEndsAt).getTime() >= Date.now());
  // Одна плашка за раз и одна просьба за визит: пока не подключён отчёт во VK, предлагаем его,
  // а запрос push после показанной в этом визите плашки отчёта ждёт следующего визита.
  const showVkReportPrompt = Boolean(user?.vkReports?.enabled && !user.vkReports.vkConnected && groups.length > 0 && !isVkReportPromptDismissed());

  if (location.pathname === '/auth/vk/implicit-callback') {
    return <VkImplicitCallbackPage />;
  }

  if (isLoading) {
    return <div className="boot">Загрузка socstat...</div>;
  }

  if (isUnauthorized) {
    return <LoginPage onDevLogin={loadAccount} />;
  }

  if (location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-shell">
      {isMobileMenuOpen && <button aria-label="Закрыть меню" className="mobile-menu-backdrop" type="button" onClick={closeMobileMenu} />}
      <aside aria-label="Основная навигация" className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} id="main-navigation" ref={menuRef}>
        <div className="brand">
          <strong>socstat.ru</strong>
          <span>Аналитика соцсетей</span>
        </div>
        <nav className="nav">
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={closeMobileMenu}>
              <item.icon size={18} />
              <span className="nav-text">
                <span>{item.label}</span>
                {item.description && <small>{item.description}</small>}
              </span>
              {item.adminOnly && <span className="nav-admin-badge" title="Только для администратора" aria-label="Только для администратора"><ShieldCheck size={15} aria-hidden="true" /></span>}
            </NavLink>
          ))}
        </nav>
        {user && <div className="mobile-menu-account">
          <NavLink className="profile-pill" to="/account" onClick={closeMobileMenu}>
            <Users size={18} />
            <span>{user.userFullName}</span>
            <small className={`profile-access-status ${hasPaidAccess ? 'active' : 'inactive'}`}>
              {hasPaidAccess ? `Активен до ${formatDate(user.activeTo)}` : 'Доступ не активен'}
            </small>
          </NavLink>
          <button className="mobile-menu-logout" type="button" onClick={() => { closeMobileMenu(); void logout(); }}>
            <LogOut size={18} /> Выйти
          </button>
        </div>}
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button
              aria-controls="main-navigation"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              className="mobile-menu-button"
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <Menu size={24} />
            </button>
            <h1>{title}</h1>
          </div>
          {user && (
            <div className="topbar-actions">
              <NavLink className="profile-pill" to="/account">
                <Users size={17} />
                <span>{user.userFullName}</span>
                <small className={`profile-access-status ${hasPaidAccess ? 'active' : 'inactive'}`}>
                  {hasPaidAccess ? `Активен до ${formatDate(user.activeTo)}` : 'Не активен'}
                </small>
                <ChevronRight size={16} />
              </NavLink>
              <IconButton
                aria-label="Выйти"
                icon={LogOut}
                onClick={logout}
                size={40}
                view="transparent"
              />
            </div>
          )}
        </header>

        {showVkReportPrompt && user?.vkReports && <VkReportPrompt settings={user.vkReports} onChanged={loadAccount} />}
        {!showVkReportPrompt && !wasVkReportPromptShownThisVisit() && hasPaidAccess && groups.length > 0 && <PushPrompt activeTo={user?.activeTo} isTrial={isTrialActive} />}

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                groups={groups}
                hasPaidAccess={Boolean(hasPaidAccess)}
                isTrialActive={isTrialActive}
                freeGroupsDisabled={Boolean(user?.freeGroupsDisabled)}
                vkReports={user?.vkReports}
                onGroupsChanged={loadAccount}
              />
            }
          />
          <Route path="/account" element={<AccountPage user={user} groups={groups} onAccountChanged={loadAccount} />} />
          <Route
            path="/analytics"
            element={<AnalyticsPage isAdmin={Boolean(user?.isAdmin)} groups={groups} hasPaidAccess={Boolean(hasPaidAccess)} isTrialActive={isTrialActive} activeTo={user?.activeTo} reportPass={user?.reportPass ?? null} onAccountChange={loadAccount} />}
          />
          <Route path="/ad-check" element={user?.isAdmin ? <AdCheckPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/placements" element={user?.placementsEnabled ? <PlacementsPage groups={groups} /> : <Navigate to="/dashboard" replace />} />
          <Route path="/compare" element={hasPaidAccess ? <ComparePage groups={groups} user={user} /> : <CompareShowcase />} />
          <Route path="/posts" element={hasPaidAccess ? <PostsPage groups={groups} /> : <PostsShowcase />} />
          <Route path="/telegram" element={<TelegramAnalyticsRedirect />} />
          <Route
            path="/admin"
            element={
              user?.isAdmin ? <AdminPage user={user} onAccountChanged={loadAccount} /> : <Navigate to="/dashboard" replace />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <footer className="app-footer">
          Нашли ошибку?{' '}
          <a href="https://vk.com/socstat_ru" target="_blank" rel="noreferrer">
            Сообщите нам
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
