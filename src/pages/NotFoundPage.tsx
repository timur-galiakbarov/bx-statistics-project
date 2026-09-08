import { Home, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found-page">
      <div className="not-found-icon"><SearchX size={34} /></div>
      <span className="not-found-code">404</span>
      <h2>Страница не найдена</h2>
      <p>Проверьте адрес или вернитесь на главную страницу сервиса.</p>
      <Link className="primary-button not-found-action" to="/dashboard">
        <Home size={17} />
        На главную
      </Link>
    </section>
  );
}
