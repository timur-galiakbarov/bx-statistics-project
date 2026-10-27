import { ExternalLink, Lock, MapPin, Megaphone, MessageCircle, Search, Sparkles, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiGet, apiPost } from '../api/client';
import type { PlacementCity, PlacementKind, PlacementLockedRow, PlacementRow, PlacementSearchResult, PlacementUsage } from '../api/types';
import { costPerThousand, positiveAmount } from '../utils/adCheck';
import { trackPlacementEvent } from '../utils/visit';

type SortKey = 'fit' | 'members' | 'views' | 'ratio' | 'cpm';
type SizeKey = 'all' | 'small' | 'medium' | 'large';

const sizes: Array<{ key: Exclude<SizeKey, 'all'>; label: string; test: (members: number) => boolean }> = [
  { key: 'small', label: 'до 50 тыс.', test: (members) => members < 50_000 },
  { key: 'medium', label: '50–500 тыс.', test: (members) => members >= 50_000 && members < 500_000 },
  { key: 'large', label: 'больше 500 тыс.', test: (members) => members >= 500_000 }
];
// The search takes about a minute; the steps follow its usual timing, the server does not report progress.
const loadingSteps: Array<{ after: number; text: string }> = [
  { after: 0, text: 'Понимаем задачу и аудиторию' },
  { after: 4, text: 'Ищем сообщества во ВКонтакте' },
  { after: 25, text: 'Отбираем подходящие площадки' },
  { after: 32, text: 'Читаем посты и считаем просмотры' },
  { after: 75, text: 'Почти готово' }
];
const examples = ['Шиномонтаж в Уфе, клиенты — автомобилисты', 'Группа про Nintendo Switch, хочу больше подписчиков', 'Онлайн-школа английского для взрослых'];

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
    brief: searchParams.get('brief') ?? '',
    cityId: searchParams.get('cityId') ?? '',
    city: searchParams.get('city') ?? ''
  }), [searchParams]);
  const [brief, setBrief] = useState(requested.brief);
  const [cityQuery, setCityQuery] = useState(requested.city);
  const [city, setCity] = useState<{ id: string; title: string } | null>(requested.cityId ? { id: requested.cityId, title: requested.city } : null);
  const [suggestions, setSuggestions] = useState<PlacementCity[]>([]);
  const [result, setResult] = useState<PlacementSearchResult | null>(null);
  const [usage, setUsage] = useState<PlacementUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const suggestTimer = useRef<number>();

  useEffect(() => {
    apiGet<PlacementUsage>('/api/placements/usage').then(setUsage).catch(() => undefined);
  }, []);

  // The search is driven by the URL, so a reload or a shared link opens the same selection.
  useEffect(() => {
    if (!requested.brief) return;
    let active = true;
    setIsLoading(true);
    setElapsed(0);
    setMessage('');
    setLimitReached(false);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    const params = new URLSearchParams({ brief: requested.brief, ...(requested.cityId ? { cityId: requested.cityId } : {}) });
    apiGet<PlacementSearchResult>(`/api/placements/search?${params}`)
      .then((data) => { if (active) { setResult(data); setUsage(data.usage); } })
      .catch((error) => {
        if (!active) return;
        setResult(null);
        setLimitReached(error instanceof ApiError && error.status === 429);
        setMessage(error instanceof ApiError ? error.message : 'Не удалось подобрать площадки. Повторите позже.');
      })
      .finally(() => { if (active) setIsLoading(false); window.clearInterval(timer); });
    return () => { active = false; window.clearInterval(timer); };
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

  const clearCity = () => {
    setCity(null);
    setCityQuery('');
    setSuggestions([]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = brief.trim();
    if (value.length < 3) return setMessage('Опишите, что рекламируете.');
    if (cityQuery.trim() && !city) return setMessage('Выберите город из подсказок или очистите поле.');
    setSearchParams({ brief: value, ...(city ? { cityId: city.id, city: city.title } : {}) });
  };

  const step = [...loadingSteps].reverse().find((item) => elapsed >= item.after)!;

  return <section className="page-grid analytics-page placements-page">
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div>
        <h2><MapPin size={20} aria-hidden="true" /> Подбор площадок для рекламы во ВКонтакте</h2>
        <p>Расскажите, что рекламируете: поймём, кто ваша аудитория, найдём сообщества, где она сидит, прочитаем их посты и покажем просмотры, рекламу и цену 1 000 просмотров.</p>
      </div></div>
      <form className="placements-form" onSubmit={submit}>
        <label className="placements-brief">Что рекламируете?
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={examples[0]} rows={2} maxLength={300} />
          <span className="placements-examples">Например: {examples.map((item) => <button type="button" key={item} onClick={() => setBrief(item)}>{item}</button>)}</span>
        </label>
        <div className="placements-city">
          <label htmlFor="placement-city">Город <small>— если бизнес местный</small></label>
          <div className="placements-city-input">
            <input id="placement-city" value={cityQuery} onChange={(event) => changeCity(event.target.value)} placeholder="Определим по описанию" autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="placement-city-list" aria-autocomplete="list" />
            {cityQuery && <button type="button" onClick={clearCity} aria-label="Очистить город"><X size={16} /></button>}
          </div>
          {suggestions.length > 0 && <ul className="placements-suggestions" id="placement-city-list" role="listbox">
            {suggestions.map((item) => <li key={item.id} role="option" aria-selected={city?.id === String(item.id)}>
              <button type="button" onClick={() => chooseCity(item)}><b>{item.title}</b>{(item.area || item.region) && <small>{[item.area, item.region].filter(Boolean).join(', ')}</small>}</button>
            </li>)}
          </ul>}
        </div>
        <button className="primary-button" type="submit" disabled={isLoading}><Search size={18} />{isLoading ? 'Подбираем' : 'Подобрать'}</button>
      </form>
      {usage && <p className="ad-check-data-note">Сегодня {Math.min(usage.used, usage.limit)} из {usage.limit} {plural(usage.limit, 'подбора', 'подборов', 'подборов')}. Повторить тот же подбор можно бесплатно.{!usage.paid && ` Без тарифа подробности видны у первых ${usage.freeRows} площадок.`}</p>}
      {message && <div className="form-message telegram-message-error" role="alert">{message}
        {limitReached && usage && !usage.paid && <> <Link to="/account" onClick={() => trackPlacementEvent('placement_paywall_click', 'limit')}>Посмотреть тарифы</Link></>}
      </div>}
    </div>

    {isLoading && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong>{step.text}</strong><span>Обычно подбор занимает около минуты · {elapsed} сек.</span></div><div className="analytics-loading-progress" role="progressbar" aria-label="Загрузка"><span /></div></div>}

    {!isLoading && !result && <div className="panel span-2 ad-check-start">
      <h2>Что покажет подбор</h2>
      <ul className="ad-check-checklist">
        <li><b>Сообщества, где сидит ваша аудитория</b>: для местного бизнеса — тематические и общегородские паблики, для своей группы — похожие сообщества. Страницы компаний и конкурентов отсеиваем.</li>
        <li><b>Почему площадка подходит</b> и <b>кто там уже рекламируется</b> — по содержанию её постов.</li>
        <li><b>Типичные просмотры поста</b>, их доля от подписчиков и цена 1 000 просмотров по цене, которую назвал владелец. Сообщества с мёртвой аудиторией — внизу с пометкой.</li>
      </ul>
    </div>}

    {!isLoading && result && <PlacementsReport result={result} />}
  </section>;
}

function PlacementsReport({ result }: { result: PlacementSearchResult }) {
  const [size, setSize] = useState<SizeKey>('all');
  const [sort, setSort] = useState<SortKey>('fit');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState<Record<number, string>>({});
  const priceTracked = useRef(false);

  useEffect(() => {
    setSize('all');
    setSelected(new Set());
    setPrices({});
  }, [result]);

  const cpmOf = (row: PlacementRow) => costPerThousand(positiveAmount(prices[row.id] ?? ''), row.views);
  const rowsOf = (kind: PlacementKind) => {
    const sizeTest = sizes.find((item) => item.key === size)?.test;
    const filtered = result.rows.filter((row) => row.kind === kind && (!sizeTest || sizeTest(row.members)));
    if (sort === 'fit') return filtered;
    const value = (row: PlacementRow | PlacementLockedRow) => !isOpen(row) ? -Infinity
      : sort === 'members' ? row.members : sort === 'views' ? row.views ?? -1 : sort === 'ratio' ? row.viewsToSubscribers ?? -1 : -(cpmOf(row) ?? Infinity);
    return [...filtered].sort((left, right) => sort === 'members' ? right.members - left.members : value(right) - value(left));
  };
  const topicRows = rowsOf('topic');
  const cityRows = rowsOf('city');

  const lockedCount = result.rows.filter((row) => row.locked).length;
  const chosen = result.rows.filter((row): row is PlacementRow => isOpen(row) && selected.has(row.id));
  const priced = chosen.filter((row) => positiveAmount(prices[row.id] ?? '') !== null && row.views);
  const totalPrice = priced.reduce((sum, row) => sum + positiveAmount(prices[row.id]!)!, 0);
  const totalViews = priced.reduce((sum, row) => sum + row.views!, 0);

  const toggle = (row: PlacementRow) => {
    const adding = !selected.has(row.id);
    // The request stays outside the state updater: React may call updaters twice.
    if (adding) apiPost('/api/placements/select', { groupId: row.id }).catch(() => undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (adding) next.add(row.id);
      else next.delete(row.id);
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

  const chooseSize = (value: SizeKey) => {
    setSize(value);
    if (value !== 'all') trackPlacementEvent('placement_filter', value);
  };

  const chip = (active: boolean, label: string, onClick: () => void, key?: string) => <button type="button" key={key} className={active ? 'active' : ''} aria-pressed={active} onClick={onClick}>{label}</button>;
  const where = result.city ? result.city.title : 'по всей России';
  const table = (rows: Array<PlacementRow | PlacementLockedRow>) => <div className="placements-table-wrap" tabIndex={0} aria-label="Таблица площадок">
    <table className="placements-table">
      <thead><tr>
        <th scope="col"><span className="placements-sr-only">В подборку</span></th>
        <th scope="col">Сообщество</th>
        <th scope="col">Подписчики</th>
        <th scope="col">Просмотры поста</th>
        <th scope="col" title="Какая доля подписчиков видит типичный пост">Просм. / подп.</th>
        <th scope="col" title="Только маркированная реклама; у частых пабликов — по последним 100 постам">Реклама в неделю</th>
        <th scope="col">Цена, ₽</th>
        <th scope="col">CPM</th>
      </tr></thead>
      <tbody>
        {rows.map((row) => isOpen(row)
          ? <tr key={row.id} className={[selected.has(row.id) ? 'selected' : '', row.dead ? 'placements-dead' : ''].join(' ')}>
            <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row)} aria-label={`В подборку: ${row.name}`} /></td>
            <td><PlacementName row={row} /></td>
            <td>{number(row.members)}</td>
            <td title={row.viewsLower !== null ? `Обычно от ${number(row.viewsLower)} до ${number(row.viewsUpper)}` : undefined}>{number(row.views)}</td>
            <td className={row.dead ? 'placements-low' : ''}>{row.viewsToSubscribers === null ? '—' : `${number(row.viewsToSubscribers, 1)}%`}{row.dead && <small>мало просмотров</small>}</td>
            <td title={row.complete ? undefined : 'По последним 100 постам: они покрывают меньше 30 дней'}>{number(row.adsPerWeek, 1)}</td>
            <td>{selected.has(row.id)
              ? <input className="placements-price" value={prices[row.id] ?? ''} onChange={(event) => changePrice(row.id, event.target.value)} inputMode="decimal" placeholder="5 000" maxLength={24} aria-label={`Цена размещения: ${row.name}`} aria-invalid={Boolean(prices[row.id] && positiveAmount(prices[row.id]) === null)} />
              : <small>отметьте</small>}</td>
            <td>{rubles(cpmOf(row))}</td>
          </tr>
          : <tr key={row.id} className="placements-locked">
            <td><Lock size={14} aria-label="Доступно с тарифом" /></td>
            <td><PlacementName row={row} /></td>
            <td>{number(row.members)}</td>
            <td colSpan={5}><span className="placements-blur" aria-hidden="true">00 000 · 0,0% · 0,0 · подходит потому что…</span></td>
          </tr>)}
      </tbody>
    </table>
  </div>;

  return <div className="panel span-2 analytics-section">
    <div className="section-title"><div>
      <h2>{result.brief}</h2>
      <p>{result.type === 'community' ? 'Сообщество' : 'Бизнес'} · {where} · {result.rows.length} {plural(result.rows.length, 'площадка', 'площадки', 'площадок')} из {result.candidates} {plural(result.candidates, 'найденного сообщества', 'найденных сообществ', 'найденных сообществ')} · данные на {new Date(result.loadedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
    </div></div>
    {result.audience && <p className="placements-audience"><Sparkles size={14} aria-hidden="true" /> <b>Аудитория:</b> {result.audience}</p>}
    {result.cityMissing && <div className="ad-check-notice">Похоже, бизнес местный, но город не указан — искали по всей России. Укажите город, чтобы найти местные паблики.</div>}
    {!result.aiUsed && <div className="ad-check-notice">DeepSeek был недоступен или ответил с ошибкой: часть площадок отобрана простыми правилами, у них нет причины и списка рекламодателей.</div>}
    {result.queries.length > 0 && <p className="ad-check-data-note">Искали: {result.queries.join(', ')}.</p>}

    {result.rows.length === 0
      ? <div className="empty-state">Подходящих площадок не нашлось. Опишите задачу подробнее или выберите другой город.</div>
      : <>
        <div className="placements-toolbar">
          <div className="placements-chips" role="group" aria-label="Размер">
            <span>Размер:</span>
            {chip(size === 'all', 'любой', () => chooseSize('all'))}
            {sizes.map((item) => chip(size === item.key, item.label, () => chooseSize(item.key), item.key))}
          </div>
          <div className="placements-chips" role="group" aria-label="Сортировка">
            <span>Сортировать:</span>
            {(['members', 'views', 'ratio', 'cpm'] as const).map((key) => chip(sort === key, { members: 'подписчики', views: 'просмотры', ratio: 'просм./подп.', cpm: 'CPM' }[key], () => setSort(sort === key ? 'fit' : key), key))}
          </div>
        </div>

        {topicRows.length > 0 && <section className="placements-block">
          <h3>{result.type === 'community' ? 'Похожие и тематические сообщества' : 'Под вашу аудиторию'} · {topicRows.length}</h3>
          {table(topicRows)}
        </section>}
        {cityRows.length > 0 && <section className="placements-block">
          <h3>Общегородские паблики · {cityRows.length}</h3>
          <p className="ad-check-data-note">Новости, подслушано, афиши — подходят любому местному бизнесу.</p>
          {table(cityRows)}
        </section>}
        {!topicRows.length && !cityRows.length && <div className="empty-state">Площадок такого размера нет — выберите другой размер.</div>}

        {lockedCount > 0 && <div className="placements-paywall">
          <span>Ещё {lockedCount} {plural(lockedCount, 'площадка', 'площадки', 'площадок')} с просмотрами, рекламой, причинами и CPM — с тарифом. С ним же до 20 подборов в день.</span>
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
      <summary>Как подбираем</summary>
      <p>DeepSeek читает описание: бизнес это или сообщество, нужен ли город, кто аудитория и какие сообщества искать. Ищем поиском VK, отсеиваем страницы компаний и конкурентов, затем модель читает последние посты лучших сообществ и объясняет, подходит ли площадка и кто там рекламируется.</p>
      <p>Просмотры поста — медиана текущих просмотров последних постов старше 3 дней, разброс в подсказке — от 25-го до 75-го процентиля. «Мало просмотров» — меньше 100 или меньше 0,3% подписчиков. Рекламу видим только маркированную. Модель может ошибаться в оценке — сверяйтесь с постами. Отмеченные «в подборку» сообщества Socstat начинает отслеживать каждую ночь.</p>
    </details>
  </div>;
}

function PlacementName({ row }: { row: PlacementRow | PlacementLockedRow }) {
  return <div className="placements-name">
    {row.photo ? <img src={row.photo} alt="" width={36} height={36} loading="lazy" /> : <span className="placements-avatar">VK</span>}
    <span>
      <a href={row.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'vk')}>{row.name}<ExternalLink size={12} aria-hidden="true" /></a>
      {isOpen(row) && row.reason && <small className="placements-reason">{row.reason}</small>}
      {isOpen(row) && row.advertisers && <small className="placements-advertisers"><Megaphone size={12} aria-hidden="true" /> Рекламируются: {row.advertisers}</small>}
      {isOpen(row) && <span className="placements-contacts">
        {row.contacts.map((contact) => <a key={contact.url} href={contact.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'contact')}>{contact.label}</a>)}
        <a href={row.messageUrl} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', 'message')}><MessageCircle size={12} aria-hidden="true" /> Написать</a>
      </span>}
    </span>
  </div>;
}
