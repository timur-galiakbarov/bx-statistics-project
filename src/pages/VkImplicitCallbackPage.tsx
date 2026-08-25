import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiPost } from '../api/client';

type ImplicitAuthResult = {
  redirectUrl: string;
};

function parseVkHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token') ?? undefined;
  const userId = Number(params.get('user_id'));
  const expiresInValue = params.get('expires_in');
  const scope = params.get('scope') ?? undefined;

  return {
    accessToken,
    userId: Number.isFinite(userId) && userId > 0 ? userId : undefined,
    expiresIn: expiresInValue ? Number(expiresInValue) : undefined,
    state: params.get('state') ?? undefined,
    scope
  };
}

export function VkImplicitCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Завершаем вход через VK...');

  useEffect(() => {
    const authData = parseVkHash();
    window.history.replaceState(null, '', '/auth/vk/implicit-callback');

    apiPost<ImplicitAuthResult>('/api/auth/vk/implicit-callback', authData)
      .then((result) => {
        setStatus('success');
        setMessage('VK token сохранён, открываем кабинет...');
        window.location.assign(result.redirectUrl);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Не удалось завершить вход через VK');
      });
  }, []);

  const Icon = status === 'loading' ? LoaderCircle : status === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <main className="login-page">
      <section className="login-panel callback-panel">
        <Icon className={status === 'loading' ? 'spin' : undefined} size={28} />
        <h1>VK авторизация</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
