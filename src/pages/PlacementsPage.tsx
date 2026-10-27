import { ExternalLink, Lock, MapPin, MessageCircle, Search, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiGet, apiPost } from '../api/client';
import type { PlacementCategory, PlacementCity, PlacementLockedRow, PlacementRow, PlacementSearchResult, PlacementUsage } from '../api/types';
import { costPerThousand, positiveAmount } from '../utils/adCheck';
import { trackPlacementEvent } from '../utils/visit';

type SortKey = 'fit' | 'members' | 'views' | 'ratio' | 'cpm';

const categoryLabels: Record<PlacementCategory, string> = {
  news: 'Новости и ЧП',
  overheard: 'Подслушано',
  classifieds: 'Барахолки',
  jobs: 'Работа',
  events: 'Афиша',
  district: 'Районные',
  theme: 'Тематические',
  business: 'Компании',
  official: 'Официальные',
  other: 'Другое'
};
const minMembersOptions = [1_000, 5_000, 20_000];

const number = (value: number | null, digits = 0) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const rubles = (value: number | null) => value === null ? '—' : `${number(value, value < 10 ? 2 : 0)} ₽`;

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const isOpen = (row: PlacementRow | PlacementLockedRow): row is PlacementRow => !row.locked;

export function PlacementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = useMemo(() => ({
    cityId: searchParams.get('cityId') ?? '',
    city: searchParams.get('city') ?? '',
    district: searchParams.get('district') ?? '',
    topic: searchParams.get('topic') ?? '',
    minMembers: searchParams.get('minMembers') ?? '1000'
  }), [searchParams]);
  const [cityQuery, setCityQuery] = useState(requested.city);
  const [city, setCity] = useState<{ id: string; title: string } | null>(requested.cityId ? { id: requested.cityId, title: requested.city } : null);
  const [suggestions, setSuggestions] = useState<PlacementCity[]>([]);
  const [district, setDistrict] = useState(requested.district);
  const [topic, setTopic] = useState(requested.topic);
  const [minMembers, setMinMembers] = useState(requested.minMembers);
  const [result, setResult] = useState<PlacementSearchResult | null>(null);
  const [usage, setUsage] = useState<PlacementUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const suggestTimer = useRef<number>();

  useEffect(() => {
    apiGet<PlacementUsage>('/api/placements/usage').then(setUsage).catch(() => undefined);
  }, []);

  // The search is driven by the URL, so a reload or a shared link opens the same selection.
  useEffect(() => {
    if (!requested.cityId) return;
    let active = true;
    setIsLoading(true);
    setMessage('');
    setLimitReached(false);
    const params = new URLSearchParams({ cityId: requested.cityId, district: requested.district, topic: requested.topic, minMembers: requested.minMembers });
    apiGet<PlacementSearchResult>(`/api/placements/search?${params}`)
      .then((data) => { if (active) { setResult(data); setUsage(data.usage); } })
      .catch((error) => {
        if (!active) return;
        setResult(null);
        setLimitReached(error instanceof ApiError && error.status === 429);
        setMessage(error instanceof ApiError ? error.message : 'Не удалось подобрать площадки. Повторите позже.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [requested]);

  const changeCity = (value: string) => {
    setCityQuery(value);
    setCity(null);
    window.clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) return setSuggestions([]);
    suggestTimer.current = window.setTimeout(() => {
      apiGet<PlacementCity[]>(`/api/placements/cities?${new URLSearchParams({ q: value.trim() })}`).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
  };

  const chooseCity = (item: PlacementCity) => {
    setCity({ id: String(item.id), title: item.title });
    setCityQuery(item.title);
    setSuggestions([]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!city) return setMessage('Выберите город из подсказок.');
    setSearchParams({ cityId: city.id, city: city.title, district: district.trim(), topic: topic.trim(), minMembers });
  };

  return <section className="page-grid analytics-page placements-page">
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div>
        <h2><MapPin size={20} aria-hidden="true" /> Подбор площадок для рекламы во ВКонтакте</h2>
        <p>Укажите город и, если нужно, тему бизнеса: найдём местные сообщества и покажем, сколько просмотров набирает пост, сколько там рекламы и во что обойдётся 1 000 просмотров.</p>
      </div></div>
      <form className="placements-form" onSubmit={submit}>
        <div className="placements-city">
          <label htmlFor="placement-city">Город</label>
          <input id="placement-city" value={cityQuery} onChange={(event) => changeCity(event.target.value)} placeholder="Например, Воронеж" autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="placement-city-list" aria-autocomplete="list" />
          {suggestions.length > 0 && <ul className="placements-suggestions" id="placement-city-list" role="listbox">
            {suggestions.map((item) => <li key={item.id} role="option" aria-selected={city?.id === String(item.id)}>
              <button type="button" onClick={() => chooseCity(item)}><b>{item.title}</b>{(item.area || item.region) && <small>{[item.area, item.region].filter(Boolean).join(', ')}</small>}</button>
            </li>)}
          </ul>}
        </div>
        <label>Район или посёлок<input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Необязательно" autoComplete="off" maxLength={60} /></label>
        <label>Тема бизнеса<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Например, пластиковые окна" autoComplete="off" maxLength={80} /></label>
        <label>Подписчиков от<select value={minMembers} onChange={(event) => setMinMembers(event.target.value)}>
          {minMembersOptions.map((value) => <option key={value} value={value}>{number(value)}</option>)}
        </select></label>
        <button className="primary-button" type="submit" disabled={isLoading}><Search size={18} />{isLoading ? 'Подбираем' : 'Подобрать'}</button>
      </form>
      {usage && <p className="ad-check-data-note">Сегодня {usage.used} из {usage.limit} {plural(usage.limit, 'подбора', 'подборов', 'подборов')}. Повторить тот же подбор можно бесплатно.{!usage.paid && ` Без тарифа метрики видны у первых ${usage.freeRows} площадок.`}</p>}
      {message && <div className="form-message telegram-message-error" role="alert">{message}
        {limitReached && usage && !usage.paid && <> <Link to="/account" onClick={() => trackPlacementEvent('placement_paywall_click', 'limit')}>Посмотреть тарифы</Link></>}
      </div>}
    </div>

    {isLoading && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong>Подбираем площадки</strong><span>Ищем сообщества, отбираем местные и считаем просмотры — обычно до минуты</span></div><div className="analytics-loading-progress" role="progressbar" aria-label="Загрузка"><span /></div></div>}

    {!isLoading && !result && <div className="panel span-2 ad-check-start">
      <h2>Что покажет подбор</h2>
      <ul className="ad-check-checklist">
        <li><b>До 30 местных сообществ</b>: городские паблики, новости, барахолки, районные группы — федеральные и чужие отсеиваем.</li>
        <li><b>Типичные просмотры поста</b> и их доля от подписчиков: низкая доля — признак мёртвой или накрученной аудитории.</li>
        <li><b>Сколько рекламы выходит</b> и сколько стоит 1 000 просмотров по цене, которую назвал владелец.</li>
      </ul>
    </div>}

    {!isLoading && result && <PlacementsReport result={result} />}
  </section>;
}

function PlacementsReport({ result }: { result: PlacementSearchResult }) {
  const [category, setCategory] = useState<PlacementCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('fit');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState<Record<number, string>>({});
  const priceTracked = useRef(false);

  useEffect(() => {
    setCategory('all');
    setSelected(new Set());
    setPrices({});
  }, [result]);

  const counts = useMemo(() => {
    const map = new Map<PlacementCategory, number>();
    result.rows.forEach((row) => map.set(row.category, (map.get(row.category) ?? 0) + 1));
    return [...map.entries()].sort((left, right) => right[1] - left[1]);
  }, [result.rows]);

  const cpmOf = (row: PlacementRow) => costPerThousand(positiveAmount(prices[row.id] ?? ''), row.views);
  const rows = useMemo(() => {
    const filtered = result.rows.filter((row) => category === 'all' || row.category === category);
    if (sort === 'fit') return filtered;
    const value = (row: PlacementRow | PlacementLockedRow) => !isOpen(row) ? -1
      : sort === 'members' ? row.members : sort === 'views' ? row.views ?? -1 : sort === 'ratio' ? row.viewsToSubscribers ?? -1 : -(cpmOf(row) ?? Infinity);
    return [...filtered].sort((left, right) => sort === 'members' ? right.members - left.members : value(right) - value(left));
  }, [result.rows, category, sort, prices]);

  const lockedCount = result.rows.filter((row) => row.locked).length;
  const chosen = result.rows.filter((row): row is PlacementRow => isOpen(row) && selected.has(row.id));
  const priced = chosen.filter((row) => positiveAmount(prices[row.id] ?? '') !== null && row.views);
  const totalPrice = priced.reduce((sum, row) => sum + positiveAmount(prices[row.id]!)!, 0);
  const totalViews = priced.reduce((sum, row) => sum + row.views!, 0);

  const toggle = (row: PlacementRow) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else {
        next.add(row.id);
        apiPost('/api/placements/select', { groupId: row.id }).catch(() => undefined);
      }
      return next;
    });
  };

  const changePrice = (id: number, value: string) => {
    setPrices((current) => ({ ...current, [id]: value }));
    if (!priceTracked.current && positiveAmount(value) !== null) {
      priceTracked.current = true;
      trackPlacementEvent('placement_price', 'entered');
    }
  };

  const chooseCategory = (value: PlacementCategory | 'all') => {
    setCategory(value);
    if (value !== 'all') trackPlacementEvent('placement_filter', value);
  };

  const sortButton = (key: SortKey, label: string) => <button type="button" className={sort === key ? 'active' : ''} aria-pressed={sort === key} onClick={() => setSort(sort === key ? 'fit' : key)}>{label}</button>;

  return <>
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div>
        <h2>{result.city.title}{result.district && `, ${result.district}`}{result.topic && ` · ${result.topic}`}</h2>
        <p>{result.rows.length} {plural(result.rows.length, 'площадка', 'площадки', 'площадок')} из {result.candidates} {plural(result.candidates, 'найденного сообщества', 'найденных сообществ', 'найденных сообществ')} от {number(result.minMembers)} подписчиков · данные на {new Date(result.loadedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
      </div></div>
      {!result.aiUsed && <div className="ad-check-notice">Подбор без умного фильтра: в списке могут оказаться лишние сообщества, а категории определены по названиям.</div>}
      {result.aiQueries.length > 0 && <p className="ad-check-data-note"><Sparkles size={14} aria-hidden="true" /> Искали также, где сидит ваша аудитория: {result.aiQueries.join(', ')}.</p>}

      {result.rows.length === 0
        ? <div className="empty-state">Местных сообществ не нашлось. Уберите тему или район, уменьшите порог подписчиков.</div>
        : <>
          <div className="placements-toolbar">
            <div className="placements-chips" role="group" aria-label="Категория">
              <button type="button" className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => chooseCategory('all')}>Все · {result.rows.length}</button>
              {counts.map(([key, count]) => <button type="button" key={key} className={category === key ? 'active' : ''} aria-pressed={category === key} onClick={() => chooseCategory(key)}>{categoryLabels[key]} · {count}</button>)}
            </div>
            <div className="placements-chips" role="group" aria-label="Сортировка">
              <span>Сортировать:</span>
              {sortButton('members', 'подписчики')}
              {sortButton('views', 'просмотры')}
              {sortButton('ratio', 'просм./подп.')}
              {sortButton('cpm', 'CPM')}
            </div>
          </div>

          <div className="placements-table-wrap" tabIndex={0} aria-label="Таблица площадок">
            <table className="placements-table">
              <thead><tr>
                <th scope="col"><span className="placements-sr-only">В подборку</span></th>
                <th scope="col">Сообщество</th>
                <th scope="col">Подписчики</th>
                <th scope="col">Просмотры поста</th>
                <th scope="col" title="Какая доля подписчиков видит типичный пост">Просм. / подп.</th>
                <th scope="col">Постов в день</th>
                <th scope="col" title="Только маркированная реклама">Реклама в неделю</th>
                <th scope="col">Вовлечённость</th>
                <th scope="col">Цена, ₽</th>
                <th scope="col">CPM</th>
              </tr></thead>
              <tbody>
                {rows.map((row) => isOpen(row)
                  ? <tr key={row.id} className={selected.has(row.id) ? 'selected' : ''}>
                    <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row)} aria-label={`В подборку: ${row.name}`} /></td>
                    <td><PlacementName row={row} /></td>
                    <td>{number(row.members)}</td>
                    <td title={row.viewsLower !== null ? `Обычно от ${number(row.viewsLower)} до ${number(row.viewsUpper)}` : undefined}>{number(row.views)}</td>
                    <td className={row.viewsToSubscribers !== null && row.viewsToSubscribers < 1 ? 'placements-low' : ''}>{row.viewsToSubscribers === null ? '—' : `${number(row.viewsToSubscribers, 1)}%`}</td>
                    <td>{number(row.postsPerDay, 1)}</td>
                    <td>{number(row.adsPerWeek, 1)}{!row.complete && <small>за неполный период</small>}</td>
                    <td>{row.engagement === null ? '—' : `${number(row.engagement, 2)}%`}</td>
                    <td>{selected.has(row.id)
                      ? <input className="placements-price" value={prices[row.id] ?? ''} onChange={(event) => changePrice(row.id, event.target.value)} inputMode="decimal" placeholder="5 000" maxLength={24} aria-label={`Цена размещения: ${row.name}`} aria-invalid={Boolean(prices[row.id] && positiveAmount(prices[row.id]) === null)} />
                      : <small>отметьте</small>}</td>
                    <td>{rubles(cpmOf(row))}</td>
                  </tr>
                  : <tr key={row.id} className="placements-locked">
                    <td><Lock size={14} aria-label="Доступно с тарифом" /></td>
                    <td><PlacementName row={row} /></td>
                    <td>{number(row.members)}</td>
                    <td colSpan={7}><span className="placements-blur" aria-hidden="true">00 000 · 0,0% · 0,0 · 0,0 · 0,00%</span></td>
                  </tr>)}
              </tbody>
            </table>
          </div>

          {lockedCount > 0 && <div className="placements-paywall">
            <span>Ещё {lockedCount} {plural(lockedCount, 'площадка', 'площадки', 'площадок')} с просмотрами, рекламой и CPM — с тарифом. С ним же до 20 подборов в день.</span>
            <Link className="primary-button" to="/account" onClick={() => trackPlacementEvent('placement_paywall_click', 'rows')}>Открыть все площадки</Link>
          </div>}

          {chosen.length > 0 && <div className="placements-summary" aria-live="polite">
            <strong>В подборке {chosen.length} {plural(chosen.length, 'площадка', 'площадки', 'площадок')}</strong>
            <span>{priced.length
              ? `С ценой ${priced.length}: ${rubles(totalPrice)} за ~${number(totalViews)} просмотров, средний CPM ${rubles(costPerThousand(totalPrice, totalViews))}`
              : 'Введите цены, которые назвали владельцы, — посчитаем общий бюджет и CPM.'}</span>
          </div>}
        </>}

      <details className="ad-check-method">
        <summary>Как считаем</summary>
        <p>Сообщества ищем поиском VK по городу, району, теме и типичным словам городских пабликов. Местные отбирает DeepSeek по названию и описанию; если он недоступен — по упоминанию города и региона.</p>
        <p>Просмотры поста — медиана текущих просмотров последних постов старше 3 дней, разброс в подсказке — от 25-го до 75-го процентиля. Рекламу видим только маркированную, поэтому это нижняя оценка. Отмеченные «в подборку» сообщества Socstat начинает отслеживать каждую ночь.</p>
      </details>
    </div>
  </>;
}

function PlacementName({ row }: { row: PlacementRow | PlacementLockedRow }) {
  return <div className="placements-name">
    {row.photo ? <img src={row.photo} alt="" width={36} height={36} loading="lazy" /> : <span className="placements-avatar">VK</span>}
    <span>
      <a href={row.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'vk')}>{row.name}<ExternalLink size={12} aria-hidden="true" /></a>
      <small>{categoryLabels[row.category]}</small>
      {isOpen(row) && <span className="placements-contacts">
        {row.contacts.map((contact) => <a key={contact.url} href={contact.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'contact')}>{contact.label}</a>)}
        <a href={row.messageUrl} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'message')}><MessageCircle size={12} aria-hidden="true" /> Написать</a>
      </span>}
    </span>
  </div>;
}
