import { CalendarClock, CreditCard, LockKeyhole, Ticket } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { apiPost } from '../api/client';
import type { ReportPassState } from '../api/types';
import { formatDate } from '../utils/date';
import { formatPassDay, formatPassMoment, reportPassLink, tariffLabel, useMonthPrice } from './ReportPass';
import { TelegramLogo } from './TelegramLogo';

export function isAccessActive(activeTo?: string) {
  if (!activeTo) {
    return false;
  }

  const accessEnd = new Date(`${activeTo}T23:59:59.999Z`);

  return !Number.isNaN(accessEnd.getTime()) && accessEnd.getTime() >= Date.now();
}

/**
 * Full-width lock for a YouTube or Telegram report: these platforms have no free short report.
 * YouTube offers the free full report when it is available; Telegram only points to VK.
 */
export function PlatformAccessLock({ platform, activeTo, reportPass = null, isActivatingPass = false, onActivatePass }: {
  platform: 'youtube' | 'telegram';
  activeTo?: string;
  reportPass?: ReportPassState | null;
  isActivatingPass?: boolean;
  onActivatePass?: () => void;
}) {
  const platformName = platform === 'youtube' ? 'YouTube' : 'Telegram';
  const price = useMonthPrice();
  const canUsePass = platform === 'youtube' && reportPass?.status === 'available' && Boolean(onActivatePass);

  useEffect(() => {
    apiPost('/api/account/ui-event', { event: 'access_lock', label: platform }).catch(() => undefined);
  }, [platform]);

  return (
    <section className="panel span-2 platform-access-lock">
      <div className="platform-access-lock-card">
        <span className="platform-access-lock-icon">
          {canUsePass ? <Ticket size={28} /> : <LockKeyhole size={28} />}
          {platform === 'telegram'
            ? <TelegramLogo className="platform-access-lock-badge" size={22} />
            : <img className="platform-access-lock-badge" src="/youtube-logo.png" alt="" />}
        </span>
        <h2>С возвращением! Доступ к аналитике закончился</h2>
        {platform === 'telegram'
          ? <p>Аналитика Telegram — на тарифе. ВКонтакте можно смотреть бесплатно: краткий отчёт за неделю, а раз в 30 дней — полный отчёт по одному сообществу.</p>
          : canUsePass
            ? <p>Раз в 30 дней один полный отчёт можно открыть бесплатно — на 24 часа, с любым периодом до 90 дней.</p>
            : reportPass?.status === 'active'
              ? <p>Бесплатный полный отчёт сейчас открыт для «{reportPass.sourceName || 'другого источника'}» — до {formatPassMoment(reportPass.expiresAt)}. Следующий — {formatPassDay(reportPass.nextAt)}.</p>
              : reportPass?.status === 'used'
                ? <p>Бесплатный полный отчёт снова будет доступен {formatPassDay(reportPass.nextAt)}. Без ожидания — на тарифе.</p>
                : <p>Аналитика {platformName} — на тарифе.</p>}
        {activeTo && <span className="platform-access-lock-date"><CalendarClock size={14} />Доступ действовал до {formatDate(activeTo)}</span>}
        <div className="platform-access-lock-actions">
          {canUsePass
            ? <>
              <button className="primary-button" disabled={isActivatingPass} type="button" onClick={onActivatePass}>
                <Ticket size={18} />
                {isActivatingPass ? 'Открываем…' : 'Открыть этот канал бесплатно'}
              </button>
              <Link className="secondary-button" to="/account">{tariffLabel(price)}</Link>
            </>
            : <>
              <Link className="primary-button" to="/account">
                <CreditCard size={18} />
                {tariffLabel(price)}
              </Link>
              {reportPass?.status === 'active'
                ? <Link className="secondary-button" to={reportPassLink(reportPass)}>Вернуться к «{reportPass.sourceName || 'источнику'}»</Link>
                : <Link className="secondary-button" to="/analytics?platform=vk">Открыть сообщество ВКонтакте</Link>}
            </>}
        </div>
        <div className="platform-access-lock-hint">
          <img src="/vk-network-logo.png" alt="" />
          <span><strong>ВКонтакте — бесплатно.</strong> Краткий отчёт по любому сообществу за последнюю неделю.</span>
        </div>
      </div>
    </section>
  );
}
