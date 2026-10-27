import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import type { FeatureFlag, FeatureMode } from '../api/types';

const modeLabels: Record<FeatureMode, string> = {
  off: 'Выключено',
  admins: 'Только администраторам',
  all: 'Всем пользователям'
};

const featureTexts: Record<FeatureFlag['key'], { title: string; description: string }> = {
  vkReports: {
    title: 'Отчёт во VK',
    description:
      'Еженедельные итоги сообщением от сообщества socstat: плашка подключения, блок в профиле и рассылка по понедельникам. «Только администраторам» — проверка на проде до выкатки всем.'
  },
  placements: {
    title: 'Подбор площадок',
    description:
      'Страница «Подбор площадок»: сообщества VK под описание задачи — DeepSeek понимает аудиторию и отбирает площадки по постам; просмотры, реклама и CPM. «Только администраторам» — проверка на проде до выкатки всем.'
  }
};

type TestResult = { text: string | null; sent: boolean; reason?: string };

/** Переключатели фич на вкладке «Настройки». */
export function AdminFeatureFlags({ onAccountChanged }: { onAccountChanged: () => Promise<void> }) {
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    apiGet<FeatureFlag[]>('/api/account/admin/features')
      .then(setFlags)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить настройки фич.'));
  }, []);

  const changeMode = async (key: FeatureFlag['key'], mode: FeatureMode) => {
    setSavingKey(key);
    setError(null);
    try {
      setFlags(await apiPost<FeatureFlag[]>('/api/account/admin/features', { key, mode }));
      // Плашка и блок в профиле администратора зависят от режима — обновляем аккаунт.
      await onAccountChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить.');
    } finally {
      setSavingKey(null);
    }
  };

  const sendTestReport = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await apiPost<TestResult>('/api/notifications/admin/test-weekly'));
    } catch (reason) {
      setTestResult({ text: null, sent: false, reason: reason instanceof Error ? reason.message : 'Не удалось собрать отчёт.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="panel span-2">
      <div className="panel-header compact">
        <div>
          <h2>Фичи</h2>
          <p>Кому показывается функционал. Переключение доходит до всех серверов за полминуты.</p>
        </div>
      </div>
      {error && <div className="debug-error">{error}</div>}
      {flags?.map((flag) => (
        <div className="admin-feature-flag" key={flag.key}>
          <div>
            <strong>{featureTexts[flag.key].title}</strong>
            <span>{featureTexts[flag.key].description}</span>
          </div>
          <select
            aria-label={`Режим: ${featureTexts[flag.key].title}`}
            value={flag.mode}
            disabled={savingKey === flag.key}
            onChange={(event) => changeMode(flag.key, event.target.value as FeatureMode)}
          >
            {(Object.keys(modeLabels) as FeatureMode[]).map((mode) => (
              <option key={mode} value={mode}>{modeLabels[mode]}</option>
            ))}
          </select>
          {flag.key === 'vkReports' && (
            <div className="admin-feature-flag-test">
              <button className="secondary-button inline" type="button" onClick={sendTestReport} disabled={isTesting}>
                <Send size={16} />
                Отправить отчёт себе
              </button>
              {testResult && (
                <div className="admin-feature-flag-result">
                  <span>{testResult.sent ? 'Отправлено во VK.' : testResult.reason}</span>
                  {testResult.text && <pre>{testResult.text}</pre>}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
