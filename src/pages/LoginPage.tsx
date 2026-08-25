import { KeyRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiPost } from '../api/client';

type Props = {
  onDevLogin: () => Promise<void>;
};

export function LoginPage({ onDevLogin }: Props) {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('authError');
  const details = searchParams.get('details');
  const authErrorMessage =
    authError === 'VK_TOKEN_EXCHANGE_FAILED'
      ? 'VK не принял код авторизации. Обычно это значит, что ссылка была открыта повторно, код устарел или вход был начат в другой вкладке.'
      : null;

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <strong>socstat.ru</strong>
          <span>Аналитика групп ВКонтакте</span>
        </div>
        {authErrorMessage && (
          <div className="login-error">
            <strong>{authErrorMessage}</strong>
            {details && <span>{details}</span>}
          </div>
        )}
        <div className="login-actions">
          <a className="primary-button" href="/api/auth/vk/start">
            <KeyRound size={18} />
            Войти через VK
          </a>
          <a className="secondary-button" href="/api/auth/vk/implicit-start">
            <KeyRound size={18} />
            VK legacy token
          </a>
          <button
            className="secondary-button"
            onClick={() => {
              apiPost('/api/auth/dev').then(onDevLogin);
            }}
          >
            Dev-вход
          </button>
        </div>
      </section>
    </main>
  );
}
