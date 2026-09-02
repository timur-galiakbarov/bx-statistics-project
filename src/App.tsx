import {
  BarChart3,
  CreditCard,
  GitCompare,
  Home,
  LogOut,
  Newspaper,
  Shield,
  Users
} from 'lucide-react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api/client';
import type { SavedGroup, User } from './api/types';
import { AccessLock, isAccessActive } from './components/AccessLock';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComparePage } from './pages/ComparePage';
import { LoginPage } from './pages/LoginPage';
import { PostsPage } from './pages/PostsPage';
import { VkImplicitCallbackPage } from './pages/VkImplicitCallbackPage';
import { formatDate } from './utils/date';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: Home },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/compare', label: 'Сравнение', icon: GitCompare },
  { to: '/posts', label: 'Публикации', icon: Newspaper },
  { to: '/account', label: 'Профиль и оплата', icon: CreditCard }
];

const adminNavItem = { to: '/admin', label: 'Админка', icon: Shield };

export function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

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

  const logout = async () => {
    await apiPost('/api/auth/logout');
    setUser(null);
    setGroups([]);
    setIsUnauthorized(true);
  };

  const title = useMemo(() => {
    return [...navItems, adminNavItem].find((item) => location.pathname.startsWith(item.to))?.label ?? 'Socstat';
  }, [location.pathname]);
  const visibleNavItems = user?.isAdmin ? [...navItems, adminNavItem] : navItems;
  const hasPaidAccess = (user?.isAdmin && !user.enforceAccessRestrictions) || isAccessActive(user?.activeTo);
  const paidRoute = (element: JSX.Element) => (hasPaidAccess ? element : <AccessLock activeTo={user?.activeTo} />);

  if (location.pathname === '/auth/vk/implicit-callback') {
    return <VkImplicitCallbackPage />;
  }

  if (isLoading) {
    return <div className="boot">Загрузка socstat...</div>;
  }

  if (isUnauthorized || location.pathname === '/login') {
    return <LoginPage onDevLogin={loadAccount} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>socstat.ru</strong>
          <span>Аналитика групп ВКонтакте</span>
        </div>
        <nav className="nav">
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{title}</h1>
          {user && (
            <div className="topbar-actions">
              <div className="profile-pill">
                <Users size={17} />
                <span>{user.userFullName}</span>
                <small className={hasPaidAccess ? undefined : 'expired'}>до {formatDate(user.activeTo)}</small>
              </div>
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

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                groups={groups}
                hasPaidAccess={Boolean(hasPaidAccess)}
                onGroupsChanged={loadAccount}
              />
            }
          />
          <Route path="/account" element={<AccountPage user={user} groups={groups} onAccountChanged={loadAccount} />} />
          <Route
            path="/analytics"
            element={<AnalyticsPage groups={groups} hasPaidAccess={Boolean(hasPaidAccess)} activeTo={user?.activeTo} />}
          />
          <Route path="/compare" element={paidRoute(<ComparePage />)} />
          <Route path="/posts" element={paidRoute(<PostsPage />)} />
          <Route
            path="/admin"
            element={
              user?.isAdmin ? <AdminPage user={user} onAccountChanged={loadAccount} /> : <Navigate to="/dashboard" replace />
            }
          />
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
