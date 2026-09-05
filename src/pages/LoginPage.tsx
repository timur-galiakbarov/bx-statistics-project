import { useSearchParams } from 'react-router-dom';
import { apiPost } from '../api/client';

type Props = {
  onDevLogin: () => Promise<void>;
};

function VkIcon() {
  return (
    <span aria-hidden="true" className="vk-icon">
      <img alt="" src="/vk-logo.png" />
    </span>
  );
}

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
        <div className="login-logo" aria-hidden="true">
          <VkIcon />
        </div>
        <div className="login-brand">
          <span className="login-product-name">socstat.ru</span>
          <h1>Вход в систему</h1>
          <p>Отслеживайте статистику, публикации и динамику аудитории сообществ.</p>
        </div>
        {authErrorMessage && (
          <div className="login-error">
            <strong>{authErrorMessage}</strong>
            {details && <span>{details}</span>}
          </div>
        )}
        <div className="login-actions">
          <a className="vk-login-button" href="/api/auth/vk/start">
            <VkIcon />
            Войти через VK
          </a>
        </div>
        {import.meta.env.DEV && (
          <div className="login-dev-tools">
            <div className="login-dev-actions">
              <a className="secondary-button" href="/api/auth/vk/implicit-start">
                VK legacy token
              </a>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  apiPost('/api/auth/dev').then(onDevLogin);
                }}
              >
                Dev-вход
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
