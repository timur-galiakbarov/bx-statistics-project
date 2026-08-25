import { CreditCard, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  activeTo?: string;
};

export function isAccessActive(activeTo?: string) {
  if (!activeTo) {
    return false;
  }

  const accessEnd = new Date(`${activeTo}T23:59:59.999Z`);

  return !Number.isNaN(accessEnd.getTime()) && accessEnd.getTime() >= Date.now();
}

export function AccessLock({ activeTo }: Props) {
  return (
    <section className="page-grid">
      <div className="panel span-2 access-lock">
        <div className="access-lock-icon">
          <LockKeyhole size={26} />
        </div>
        <div>
          <h2>Доступ к аналитике истёк</h2>
          <p>
            Анализ сообществ, сравнение, публикации, каналы и сводная статистика доступны после продления.
            Текущий доступ до {activeTo ?? 'не указан'}.
          </p>
        </div>
        <Link className="primary-button" to="/account">
          <CreditCard size={18} />
          Перейти к оплате
        </Link>
      </div>
    </section>
  );
}
