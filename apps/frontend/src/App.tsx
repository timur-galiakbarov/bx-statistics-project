import { BarChart3, CreditCard, GitCompare, Home, Newspaper, Shield, Users } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from './api/client';
import type { SavedGroup, User } from './api/types';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { LoginPage } from './pages/LoginPage';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: Home },
  { to: '/analytics', label: 'Анализ сообществ', icon: BarChart3 },
  { to: '/compare', label: 'Сравнение', icon: GitCompare },
  { to: '/posts', label: 'Публикации', icon: Newspaper },
  { to: '/account', label: 'Профиль и оплата', icon: CreditCard },
  { to: '/admin', label: 'Админка', icon: Shield }
];

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

  const title = useMemo(() => {
    const path = window.location.pathname;
    return navItems.find((item) => path.startsWith(item.to))?.label ?? 'Socstat';
  }, [window.location.pathname]);

  if (isLoading) {
    return <div className="boot">Загрузка socstat...</div>;
  }

  if (isUnauthorized) {
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
          {navItems.map((item) => (
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
            <div className="profile-pill">
              <Users size={17} />
              <span>{user.userFullName}</span>
              <small>до {user.activeTo}</small>
            </div>
          )}
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage groups={groups} />} />
          <Route path="/account" element={<AccountPage user={user} groups={groups} />} />
          <Route path="/analytics" element={<PlaceholderPage title="Анализ сообществ" />} />
          <Route path="/compare" element={<PlaceholderPage title="Сравнение сообществ" />} />
          <Route path="/posts" element={<PlaceholderPage title="Анализ публикаций" />} />
          <Route path="/admin" element={<PlaceholderPage title="Админка" />} />
        </Routes>
      </main>
    </div>
  );
}
