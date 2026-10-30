import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiGet } from '../api/client';

type Metrics = {
  measuredAt: string;
  cpuPercent: number | null;
  memory: { total: number; available: number };
  disk: { path: string; total: number; available: number };
};

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ГиБ`;
const percent = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`;

export function AdminServerMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try { setMetrics(await apiGet<Metrics>('/api/account/admin/server-metrics')); }
    catch { setError('Не удалось получить показатели сервера. Попробуйте обновить ещё раз.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <div className="panel span-2">
    <div className="panel-header compact">
      <div><h2>Показатели сервера</h2><p>Текущие показатели сервера, на котором работает API.</p></div>
      <button className="secondary-button inline" type="button" onClick={() => void load()} disabled={loading}>
        <RefreshCw className={loading ? 'spin' : undefined} size={18} /> Обновить
      </button>
    </div>
    {error && <div className="debug-error">{error}</div>}
    {loading && !metrics && <p>Загружаем показатели…</p>}
    {metrics && <div>
      <p><strong>CPU:</strong> {metrics.cpuPercent === null ? 'нет данных' : percent(metrics.cpuPercent)}</p>
      <p><strong>RAM:</strong> использовано {gb(metrics.memory.total - metrics.memory.available)} из {gb(metrics.memory.total)} ({percent((metrics.memory.total - metrics.memory.available) / metrics.memory.total * 100)}); доступно {gb(metrics.memory.available)}</p>
      <p><strong>Диск ({metrics.disk.path}):</strong> доступно {gb(metrics.disk.available)} из {gb(metrics.disk.total)} ({percent(metrics.disk.available / metrics.disk.total * 100)})</p>
      <p>Обновлено: {new Date(metrics.measuredAt).toLocaleString('ru-RU')}</p>
    </div>}
  </div>;
}
