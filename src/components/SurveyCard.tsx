import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiGet, apiPost } from '../api/client';
import './survey.css';

export const surveyPlaceLabels = {
  report: 'После просмотра отчёта',
  'access-ended': 'После окончания доступа'
};
export const surveyOutcomeLabels = { yes: 'Да', partly: 'Частично', no: 'Нет' };

type SurveyPlace = keyof typeof surveyPlaceLabels;
type SurveyOutcome = keyof typeof surveyOutcomeLabels;
const storageKey = 'socstat.survey.v1.closed';
const seenReportKey = 'socstat.survey.v1.seen-report';
let closedInTab = false;
let seenReportInTab = false;

function isClosed() {
  try {
    return closedInTab || localStorage.getItem(storageKey) === '1';
  } catch {
    return closedInTab;
  }
}

function hasSeenReport() {
  try {
    return seenReportInTab || localStorage.getItem(seenReportKey) === '1';
  } catch {
    return seenReportInTab;
  }
}

export function SurveyCard({ place }: { place: SurveyPlace }) {
  const [enabled, setEnabled] = useState(false);
  const [stage, setStage] = useState<'invite' | 'form' | 'thanks' | 'hidden'>('invite');
  const [goal, setGoal] = useState('');
  const [outcome, setOutcome] = useState<SurveyOutcome | ''>('');
  const [suggestion, setSuggestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submissionId = useRef('');

  useEffect(() => {
    if (isClosed() || (place === 'access-ended' && hasSeenReport())) return;
    let active = true;
    apiGet<boolean>('/api/account/survey')
      .then((value) => {
        if (!active || !value || isClosed()) return;
        if (place === 'report') {
          seenReportInTab = true;
          try {
            localStorage.setItem(seenReportKey, '1');
          } catch {
            // При недоступном хранилище помним показ в текущей вкладке.
          }
        }
        setEnabled(true);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [place]);

  function close(next: 'hidden' | 'thanks') {
    closedInTab = true;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Если браузер запретил хранилище, скрываем до перезагрузки вкладки.
    }
    setStage(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal.trim() || !outcome || saving) return;
    setSaving(true);
    setError('');
    try {
      submissionId.current ||= crypto.randomUUID();
      await apiPost('/api/account/survey', { submissionId: submissionId.current, place, goal, outcome, suggestion });
      close('thanks');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить ответ. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  if (!enabled || stage === 'hidden') return null;

  return (
    <section className="panel span-2 survey-card" aria-label="Анонимный опрос Socstat">
      {stage === 'thanks' ? <p role="status">Спасибо, что поделились опытом!</p> : <>
        <h2>Удалось найти то, за чем вы пришли?</h2>
        <p>Расскажите анонимно — это займёт меньше минуты.</p>
        {stage === 'form' && (
          <form className="survey-form" id="socstat-survey-form" onSubmit={submit}>
            <label>Что вы хотели узнать или сделать в Socstat?
              <textarea autoFocus required maxLength={500} rows={2} value={goal} onChange={(event) => setGoal(event.target.value)} />
            </label>
            <fieldset>
              <legend>Удалось это сделать?</legend>
              {Object.entries(surveyOutcomeLabels).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="survey-outcome" value={value} required checked={outcome === value}
                    onChange={() => setOutcome(value as SurveyOutcome)} /> {label}
                </label>
              ))}
            </fieldset>
            <label>Что нам стоит изменить или добавить в первую очередь? (необязательно)
              <textarea maxLength={1000} rows={3} value={suggestion} onChange={(event) => setSuggestion(event.target.value)}
                placeholder="Например, какой показатель или отчёт вы хотели бы видеть?" />
            </label>
            <small>Ответ хранится без привязки к аккаунту. Пожалуйста, не указывайте имя или контакты.</small>
            {error && <p className="debug-error" role="alert">{error}</p>}
          </form>
        )}
        <div className="survey-actions">
          {stage === 'invite'
            ? <button className="primary-button" type="button" onClick={() => setStage('form')}>Ответить</button>
            : <button className="primary-button" type="submit" form="socstat-survey-form" disabled={saving || !goal.trim() || !outcome}>
                {saving ? 'Отправляем…' : 'Отправить'}
              </button>}
          <button className="secondary-button" type="button" disabled={saving} onClick={() => close('hidden')}>Скрыть</button>
        </div>
      </>}
    </section>
  );
}
