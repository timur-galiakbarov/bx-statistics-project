import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import { surveyOutcomeLabels, surveyPlaceLabels } from './SurveyCard';

type SurveyPage = {
  responses: {
    _id: string;
    place: keyof typeof surveyPlaceLabels;
    goal: string;
    outcome: keyof typeof surveyOutcomeLabels;
    suggestion?: string;
    day: string;
  }[];
  hasMore: boolean;
};

export function AdminSurveyResponses() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SurveyPage | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<keyof typeof surveyPlaceLabels | ''>('');

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(false);
    apiGet<SurveyPage>(`/api/account/admin/survey?page=${page}&place=${filter}`)
      .then((value) => { if (active) setResult(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [page, filter]);

  return (
    <section className="panel span-2 survey-card">
      <h2>Ответы на анонимный опрос</h2>
      <label>Место показа <select value={filter} onChange={(event) => {
        setFilter(event.target.value as typeof filter);
        setPage(1);
      }}>
        <option value="">Все ответы</option>
        {Object.entries(surveyPlaceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {error ? <p role="alert">Не удалось загрузить ответы.</p>
        : !result ? <p role="status">Загружаем ответы…</p>
        : result.responses.length === 0 && <p>Ответов пока нет.</p>}
      {result?.responses.map((response) => (
        <article className="survey-response" key={response._id}>
          <small>{response.day} · {surveyPlaceLabels[response.place]}</small>
          <p><strong>Задача</strong> {response.goal}</p>
          <p><strong>Удалось</strong> {surveyOutcomeLabels[response.outcome]}</p>
          {response.suggestion && <p><strong>Пожелание</strong> {response.suggestion}</p>}
        </article>
      ))}
      {(page > 1 || result?.hasMore) && <div className="survey-actions">
        <button className="secondary-button" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button>
        <button className="secondary-button" type="button" disabled={!result?.hasMore} onClick={() => setPage(page + 1)}>Дальше</button>
      </div>}
    </section>
  );
}
