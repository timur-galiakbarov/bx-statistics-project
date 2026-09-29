import { CreditCard, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { formatDate } from '../utils/date';

type Props = {
  activeTo?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function AccessExpiredModal({ activeTo, isOpen, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="access-expired-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="access-expired-modal-title"
        aria-modal="true"
        className="access-expired-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Закрыть" className="icon-button" ref={closeButtonRef} type="button" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id="access-expired-modal-title">Срок доступа к аналитике закончился</h2>
        <p>Ваш доступ действовал до {formatDate(activeTo, 'указанной даты')}. Продлите тариф, чтобы получить анализ сообщества.</p>
        <div className="access-expired-modal-actions">
          <Link className="primary-button" to="/account" onClick={onClose}>
            <CreditCard size={17} />
            Перейти к оплате
          </Link>
          <button className="secondary-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </section>
    </div>
  );
}
