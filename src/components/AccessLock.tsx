import { CalendarClock, CreditCard, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatDate } from '../utils/date';
import { TelegramLogo } from './TelegramLogo';

export function isAccessActive(activeTo?: string) {
  if (!activeTo) {
    return false;
  }

  const accessEnd = new Date(`${activeTo}T23:59:59.999Z`);

  return !Number.isNaN(accessEnd.getTime()) && accessEnd.getTime() >= Date.now();
}

/** Full-width lock for a YouTube or Telegram report: these platforms have no free short report. */
export function PlatformAccessLock({ platform, activeTo }: { platform: 'youtube' | 'telegram'; activeTo?: string }) {
  const platformName = platform === 'youtube' ? 'YouTube' : 'Telegram';
  return (
    <section className="panel span-2 platform-access-lock">
      <div className="platform-access-lock-card">
        <span className="platform-access-lock-icon">
          <LockKeyhole size={28} />
          {platform === 'telegram'
            ? <TelegramLogo className="platform-access-lock-badge" size={22} />
            : <img className="platform-access-lock-badge" src="/youtube-logo.png" alt="" />}
        </span>
        <h2>Доступ к аналитике истёк</h2>
        <p>Продлите доступ в разделе оплаты, чтобы смотреть аналитику {platformName}.</p>
        {activeTo && <span className="platform-access-lock-date"><CalendarClock size={14} />Доступ действовал до {formatDate(activeTo)}</span>}
        <div className="platform-access-lock-actions">
          <Link className="primary-button" to="/account">
            <CreditCard size={18} />
            Перейти к оплате
          </Link>
          <Link className="secondary-button" to="/analytics?platform=vk">
            Открыть сообщество ВКонтакте
          </Link>
        </div>
        <div className="platform-access-lock-hint">
          <img src="/vk-network-logo.png" alt="" />
          <span><strong>ВКонтакте — бесплатно.</strong> Краткий отчёт по любому сообществу за последнюю неделю.</span>
        </div>
      </div>
    </section>
  );
}
