import {
  BarChart3,
  CreditCard,
  GitCompare,
  Home,
  LogOut,
  MessageSquareText,
  Newspaper,
  Shield,
  Users
} from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api/client';
import type { SavedGroup, User } from './api/types';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComparePage } from './pages/ComparePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { LoginPage } from './pages/LoginPage';
import { PostsPage } from './pages/PostsPage';
import { VkImplicitCallbackPage } from './pages/VkImplicitCallbackPage';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: Home },
  { to: '/analytics', label: 'Анализ сообществ', icon: BarChart3 },
  { to: '/compare', label: 'Сравнение', icon: GitCompare },
  { to: '/posts', label: 'Публикации', icon: Newspaper },
  { to: '/channels', label: 'Каналы', icon: MessageSquareText },
  { to: '/account', label: 'Профиль и оплата', icon: CreditCard }
];

const adminNavItem = { to: '/admin', label: 'Админка', icon: Shield };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const loadAccount = () =>
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
      .finally(() => setIsLoading(false));

  useEffect(() => {
    loadAccount();
  }, []);

  const logout = async () => {
    await apiPost('/api/auth/logout');
    setUser(null);
    setGroups([]);
    setIsUnauthorized(true);
  };

  const title = useMemo(() => {
    const path = window.location.pathname;
    return [...navItems, adminNavItem].find((item) => path.startsWith(item.to))?.label ?? 'Socstat';
  }, [window.location.pathname]);
  const visibleNavItems = user?.isAdmin ? [...navItems, adminNavItem] : navItems;

  if (window.location.pathname === '/auth/vk/implicit-callback') {
    return <VkImplicitCallbackPage />;
  }

  if (isLoading) {
    return <div className="boot">Загрузка socstat...</div>;
  }

  if (isUnauthorized || window.location.pathname === '/login') {
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
                <small>до {user.activeTo}</small>
              </div>
              <button className="icon-button" type="button" aria-label="Выйти" onClick={logout}>
                <LogOut size={17} />
              </button>
            </div>
          )}
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage groups={groups} onGroupsChanged={loadAccount} />} />
          <Route path="/account" element={<AccountPage user={user} groups={groups} onAccountChanged={loadAccount} />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/admin" element={user?.isAdmin ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
