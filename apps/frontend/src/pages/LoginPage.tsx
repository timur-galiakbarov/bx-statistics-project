import { KeyRound } from 'lucide-react';
import { apiPost } from '../api/client';

type Props = {
  onDevLogin: () => Promise<void>;
};

export function LoginPage({ onDevLogin }: Props) {
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <strong>socstat.ru</strong>
          <span>Аналитика групп ВКонтакте</span>
        </div>
        <div className="login-actions">
          <a className="primary-button" href="/api/auth/vk/start">
            <KeyRound size={18} />
            Войти через VK
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
