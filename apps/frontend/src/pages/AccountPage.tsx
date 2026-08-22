import { LogOut, WalletCards } from 'lucide-react';
import type { SavedGroup, User } from '../api/types';

type Props = {
  user: User | null;
  groups: SavedGroup[];
};

export function AccountPage({ user, groups }: Props) {
  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Оплата</h2>
            <p>Подписка открывает аналитику любых групп без ограничений.</p>
          </div>
          <WalletCards size={24} />
        </div>
        <div className="plans">
          <button>1 месяц</button>
          <button>3 месяца</button>
          <button>12 месяцев</button>
        </div>
      </section>

      <section className="panel">
        <h2>Мой аккаунт</h2>
        <div className="account-card">
          <div className="avatar">{user?.first_name?.[0] ?? 'S'}</div>
          <div>
            <strong>{user?.userFullName ?? 'Гость'}</strong>
            <span>Безлимитная аналитика до {user?.activeTo ?? '-'}</span>
            <span>{groups.length} сохраненных групп</span>
          </div>
        </div>
        <button className="secondary-button">
          <LogOut size={17} />
          Выйти
        </button>
      </section>
    </div>
  );
}
