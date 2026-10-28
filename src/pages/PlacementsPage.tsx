import { ExternalLink, Lock, MapPin, Megaphone, MessageCircle, Search, Sparkles, Star, Users, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiDelete, apiGet, apiPost } from '../api/client';
import type { PlacementCity, PlacementKind, PlacementLockedRow, PlacementRow, PlacementSearchResult, PlacementUsage, SavedGroup, ShortlistItem, VkGroup, VkListResponse } from '../api/types';
import { PlacementShortlist } from '../components/PlacementShortlist';
import { trackPlacementEvent } from '../utils/visit';

type SortKey = 'fit' | 'members' | 'views' | 'ratio';
type SizeKey = 'all' | 'match' | 'small' | 'medium' | 'large';
type OwnChoice = { id: string; name: string; photo?: string; members?: number | null };

const sizes: Array<{ key: Exclude<SizeKey, 'all'>; label: string; test: (members: number) => boolean }> = [
  { key: 'small', label: 'до 50 тыс.', test: (members) => members < 50_000 },
  { key: 'medium', label: '50–500 тыс.', test: (members) => members >= 50_000 && members < 500_000 },
  { key: 'large', label: 'больше 500 тыс.', test: (members) => members >= 500_000 }
];
// The search takes about a minute; the steps follow its usual timing, the server does not report progress.
const loadingSteps: Array<{ after: number; text: string }> = [
  { after: 0, text: 'AI разбирает задачу и вашу аудиторию' },
  { after: 4, text: 'Ищем сообщества во ВКонтакте по подсказкам AI' },
  { after: 25, text: 'AI отбирает подходящие площадки' },
  { after: 32, text: 'AI читает посты и оценивает площадки' },
  { after: 75, text: 'Почти готово' }
];
const examples = ['Шиномонтаж в Уфе, клиенты — автомобилисты', 'Группа про Nintendo Switch, хочу больше подписчиков', 'Онлайн-школа английского для взрослых'];
const GROUP_OPTIONS_SHOWN = 12;

const number = (value: number | null, digits = 0) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
// 7 761 → «7,8 тыс.», 1 250 000 → «1,3 млн»: for ranges, where exact numbers only get in the way.
const compact = (value: number) => value >= 1_000_000 ? `${number(value / 1_000_000, 1)} млн` : value >= 1_000 ? `${number(value / 1_000, value < 10_000 ? 1 : 0)} тыс.` : number(value);

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const isOpen = (row: PlacementRow | PlacementLockedRow): row is PlacementRow => !row.locked;

export function PlacementsPage({ groups }: { groups: SavedGroup[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = useMemo(() => ({
    brief: searchParams.get('brief') ?? '',
    cityId: searchParams.get('cityId') ?? '',
    city: searchParams.get('city') ?? '',
    groupId: searchParams.get('groupId') ?? '',
    group: searchParams.get('group') ?? ''
  }), [searchParams]);
  const [brief, setBrief] = useState(requested.brief);
  const [own, setOwn] = useState<OwnChoice | null>(requested.groupId ? { id: requested.groupId, name: requested.group || `club${requested.groupId}` } : null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [adminGroups, setAdminGroups] = useState<VkGroup[] | null>(null);
  const [groupFilter, setGroupFilter] = useState('');
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
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);

  useEffect(() => {
    apiGet<PlacementUsage>('/api/placements/usage').then(setUsage).catch(() => undefined);
    apiGet<ShortlistItem[]>('/api/placements/shortlist').then(setShortlist).catch(() => undefined);
  }, []);

  const shortlisted = useMemo(() => new Set(shortlist.map((item) => item.groupId)), [shortlist]);
  const toggleShortlist = (row: PlacementRow) => {
    if (shortlisted.has(row.id)) {
      setShortlist((items) => items.filter((item) => item.groupId !== row.id));
      apiDelete(`/api/placements/shortlist/${row.id}`).catch(() => setMessage('Не удалось убрать площадку из подборки. Обновите страницу.'));
      return;
    }
    const task = result?.ownGroup ? result.ownGroup.name : result?.brief ?? '';
    apiPost<ShortlistItem>('/api/placements/shortlist', { groupId: row.id, name: row.name, url: row.url, photo: row.photo, members: row.members, views: row.views, viewsToSubscribers: row.viewsToSubscribers, sellsAds: row.sellsAds, contacts: row.contacts, task })
      .then((item) => setShortlist((items) => [item, ...items.filter((existing) => existing.groupId !== item.groupId)]))
      .catch((error) => setMessage(error instanceof ApiError ? error.message : 'Не удалось добавить площадку в подборку.'));
  };

  // The search is driven by the URL, so a reload or a shared link opens the same selection.
  useEffect(() => {
    if (!requested.brief && !requested.groupId) return;
    let active = true;
    setIsLoading(true);
    setElapsed(0);
    setMessage('');
    setLimitReached(false);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    const params = new URLSearchParams({ brief: requested.brief, ...(requested.cityId ? { cityId: requested.cityId } : {}), ...(requested.groupId ? { groupId: requested.groupId } : {}) });
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

  // Groups the user administers come from VK on demand; the tracked ones are already loaded by the app.
  const openPicker = () => {
    setIsPickerOpen((value) => !value);
    if (adminGroups) return;
    apiGet<VkListResponse<VkGroup>>('/api/vk/groups/subscriptions')
      .then((data) => setAdminGroups(data.items.filter((group) => Boolean(group.is_admin))))
      .catch(() => setAdminGroups([]));
  };

  const choose = (choice: OwnChoice) => {
    setOwn(choice);
    setIsPickerOpen(false);
    setGroupFilter('');
  };

  const adminIds = new Set((adminGroups ?? []).map((group) => String(group.id)));
  const filterGroup = (name: string) => name.toLowerCase().includes(groupFilter.trim().toLowerCase());
  // The same community can be saved more than once (for example, as tracked and as managed): one option per id.
  const unique = (items: OwnChoice[]) => [...new Map(items.map((item) => [item.id, item])).values()];
  const adminOptions: OwnChoice[] = unique((adminGroups ?? [])
    .map((group) => ({ id: String(group.id), name: group.name, photo: group.photo_100 ?? group.photo_50, members: group.members_count ?? null }))
    .filter((group) => filterGroup(group.name)));
  const trackedOptions: OwnChoice[] = unique(groups
    .filter((group) => group.platform === 'vk' && !adminIds.has(group.vkGroupId || group.externalId))
    .map((group) => ({ id: group.vkGroupId || group.externalId, name: group.name, photo: group.photo, members: group.membersCount ?? group.followersCount ?? null }))
    .filter((group) => /^\d+$/.test(group.id) && filterGroup(group.name)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = brief.trim();
    if (!own && value.length < 3) return setMessage('Опишите, что рекламируете, или выберите свою группу.');
    if (cityQuery.trim() && !city) return setMessage('Выберите город из подсказок или очистите поле.');
    setSearchParams({ brief: value, ...(city ? { cityId: city.id, city: city.title } : {}), ...(own ? { groupId: own.id, group: own.name } : {}) });
  };

  const option = (item: OwnChoice) => <button type="button" className="placements-group-option" key={item.id} onClick={() => choose(item)}>
    {item.photo ? <img src={item.photo} alt="" width={28} height={28} /> : <span className="placements-avatar">VK</span>}
    <span><b>{item.name}</b>{item.members ? <small>{number(item.members)} {plural(item.members, 'подписчик', 'подписчика', 'подписчиков')}</small> : null}</span>
  </button>;

  const step = [...loadingSteps].reverse().find((item) => elapsed >= item.after)!;

  return <section className="page-grid analytics-page placements-page">
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div>
        <h2><MapPin size={20} aria-hidden="true" /> AI-подбор площадок для рекламы во ВКонтакте <span className="placements-ai-badge"><Sparkles size={13} aria-hidden="true" /> AI</span></h2>
        <p>Расскажите, что рекламируете, — AI поймёт, кто ваша аудитория, найдёт сообщества, где она сидит, прочитает их посты и объяснит, почему площадка подходит. Мы добавим просмотры и рекламу, а подходящие площадки вы сохраните в подборку и будете вести переговоры там.</p>
      </div></div>
      <form className="placements-form" onSubmit={submit}>
        <div className="placements-brief">
          {own
            ? <div className="placements-own-chip"><Users size={16} aria-hidden="true" /><span>Ваша группа: <b>{own.name}</b></span><button type="button" onClick={() => setOwn(null)} aria-label="Убрать свою группу"><X size={16} /></button></div>
            : null}
          <label>{own ? 'Пожелания — необязательно' : 'Что рекламируете?'}
            <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={own ? 'Например: нужны подписчики постарше' : 'Опишите задачу или вставьте ссылку на свою группу ВК'} rows={2} maxLength={300} />
          </label>
          <span className="placements-examples">
            <button type="button" className="placements-pick" onClick={openPicker} aria-expanded={isPickerOpen}><Users size={14} aria-hidden="true" /> {own ? 'Выбрать другую группу' : 'Выбрать свою группу'}</button>
            {!own && <>или например: {examples.map((item) => <button type="button" key={item} onClick={() => setBrief(item)}>{item}</button>)}</>}
          </span>
          {isPickerOpen && <div className="placements-picker">
            {(adminGroups?.length ?? 0) + trackedOptions.length > 8 && <input value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} placeholder="Найти по названию" aria-label="Найти группу по названию" />}
            {adminGroups === null && <p className="ad-check-data-note">Загружаем ваши сообщества…</p>}
            {adminOptions.length > 0 && <><strong>Вы администратор</strong><div className="placements-group-options">{adminOptions.slice(0, GROUP_OPTIONS_SHOWN).map(option)}</div></>}
            {trackedOptions.length > 0 && <><strong>Отслеживаемые</strong><div className="placements-group-options">{trackedOptions.slice(0, GROUP_OPTIONS_SHOWN).map(option)}</div></>}
            {adminGroups !== null && !adminOptions.length && !trackedOptions.length && <p className="ad-check-data-note">{groupFilter ? 'Ничего не нашлось.' : 'Сообществ, где вы администратор, и отслеживаемых сообществ VK нет. Вставьте ссылку на группу в поле выше.'}</p>}
          </div>}
        </div>
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
        <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? <Search size={18} /> : <Sparkles size={18} />}{isLoading ? 'Подбираем' : 'Подобрать с AI'}</button>
      </form>
      {usage && <p className="ad-check-data-note">Сегодня {Math.min(usage.used, usage.limit)} из {usage.limit} {plural(usage.limit, 'подбора', 'подборов', 'подборов')}. Повторить тот же подбор можно бесплатно.{!usage.paid && ` Без тарифа подробности видны у первых ${usage.freeRows} площадок.`}</p>}
      {message && <div className="form-message telegram-message-error" role="alert">{message}
        {limitReached && usage && !usage.paid && <> <Link to="/account" onClick={() => trackPlacementEvent('placement_paywall_click', 'limit')}>Посмотреть тарифы</Link></>}
      </div>}
    </div>

    {shortlist.length > 0 && <PlacementShortlist items={shortlist} onChange={setShortlist} />}

    {isLoading && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong><Sparkles size={16} aria-hidden="true" /> {step.text}</strong><span>Обычно подбор занимает около минуты · {elapsed} сек.</span></div><div className="analytics-loading-progress" role="progressbar" aria-label="Загрузка"><span /></div></div>}

    {!isLoading && !result && <div className="panel span-2 ad-check-start">
      <h2>Что покажет подбор</h2>
      <ul className="ad-check-checklist">
        <li><b>AI поймёт задачу</b> по описанию или по вашей группе: кто аудитория, нужен ли город, какие сообщества искать.</li>
        <li><b>Сообщества, где сидит ваша аудитория</b>: для местного бизнеса — тематические и общегородские паблики, для своей группы — похожие сообщества. Страницы компаний и конкурентов отсеиваем.</li>
        <li><b>Почему площадка подходит</b> и <b>кто там уже рекламируется</b> — AI читает её посты и объясняет. Отмечаем, <b>продаёт ли сообщество рекламу</b> и продвигает ли другие паблики, а если прайс опубликован — показываем его.</li>
        <li><b>Типичные просмотры поста</b> и их доля от подписчиков; сообщества с мёртвой аудиторией — внизу с пометкой. Подходящие площадки сохраняйте в подборку: там статусы переговоров, цены и CPM.</li>
      </ul>
    </div>}

    {!isLoading && result && <PlacementsReport result={result} shortlisted={shortlisted} onToggle={toggleShortlist} />}
  </section>;
}

function PlacementsReport({ result, shortlisted, onToggle }: { result: PlacementSearchResult; shortlisted: Set<number>; onToggle: (row: PlacementRow) => void }) {
  const [size, setSize] = useState<SizeKey>('all');
  const [sort, setSort] = useState<SortKey>('fit');
  const [sellsOnly, setSellsOnly] = useState(false);
  useEffect(() => {
    setSize(result.sizeRange ? 'match' : 'all');
    setSellsOnly(false);
  }, [result]);

  const rowsOf = (kind: PlacementKind) => {
    const sizeTest = size === 'match' ? (members: number) => Boolean(result.sizeRange && members >= result.sizeRange.min && members <= result.sizeRange.max)
      : sizes.find((item) => item.key === size)?.test;
    const filtered = result.rows.filter((row) => row.kind === kind && (!sizeTest || sizeTest(row.members)) && (!sellsOnly || (isOpen(row) && row.sellsAds !== 'unknown')));
    if (sort === 'fit') return filtered;
    const value = (row: PlacementRow | PlacementLockedRow) => !isOpen(row) ? -Infinity
      : sort === 'members' ? row.members : sort === 'views' ? row.views ?? -1 : row.viewsToSubscribers ?? -1;
    return [...filtered].sort((left, right) => sort === 'members' ? right.members - left.members : value(right) - value(left));
  };
  const topicRows = rowsOf('topic');
  const cityRows = rowsOf('city');
  const lockedCount = result.rows.filter((row) => row.locked).length;

  const chooseSize = (value: SizeKey) => {
    setSize(value);
    if (value !== 'all' && value !== 'match') trackPlacementEvent('placement_filter', value);
  };
  const ownMembers = result.ownGroup?.members ?? 0;
  const times = (members: number) => {
    if (!ownMembers) return null;
    const ratio = members / ownMembers;
    return ratio >= 1.5 ? `в ${number(ratio, ratio < 10 ? 1 : 0)} раза больше вашей` : ratio <= 0.67 ? `в ${number(1 / ratio, 1)} раза меньше вашей` : 'как ваша';
  };

  const chip = (active: boolean, label: string, onClick: () => void, key?: string) => <button type="button" key={key} className={active ? 'active' : ''} aria-pressed={active} onClick={onClick}>{label}</button>;
  const where = result.city ? result.city.title : 'по всей России';
  const table = (rows: Array<PlacementRow | PlacementLockedRow>) => <div className="placements-table-wrap" tabIndex={0} aria-label="Таблица площадок">
    <table className="placements-table">
      <thead><tr>
        <th scope="col"><span className="placements-sr-only">В подборку</span><Star size={14} aria-hidden="true" /></th>
        <th scope="col">Сообщество</th>
        <th scope="col">Подписчики</th>
        <th scope="col">Просмотры поста</th>
        <th scope="col" title="Какая доля подписчиков видит типичный пост">Просм. / подп.</th>
        <th scope="col" title="Только маркированная реклама; у частых пабликов — по последним 100 постам">Реклама в неделю</th>
      </tr></thead>
      <tbody>
        {rows.map((row) => isOpen(row)
          ? <tr key={row.id} className={[shortlisted.has(row.id) ? 'selected' : '', row.dead ? 'placements-dead' : ''].join(' ')}>
            <td><button type="button" className={`placements-star${shortlisted.has(row.id) ? ' active' : ''}`} onClick={() => onToggle(row)} aria-pressed={shortlisted.has(row.id)} aria-label={shortlisted.has(row.id) ? `Убрать из подборки: ${row.name}` : `В подборку: ${row.name}`} title={shortlisted.has(row.id) ? 'В подборке — нажмите, чтобы убрать' : 'Добавить в подборку'}><Star size={18} aria-hidden="true" /></button></td>
            <td><PlacementName row={row} /></td>
            <td>{number(row.members)}{times(row.members) && <small>{times(row.members)}</small>}</td>
            <td title={row.viewsLower !== null ? `Обычно от ${number(row.viewsLower)} до ${number(row.viewsUpper)}` : undefined}>{number(row.views)}</td>
            <td className={row.dead ? 'placements-low' : ''}>{row.viewsToSubscribers === null ? '—' : `${number(row.viewsToSubscribers, 1)}%`}{row.dead && <small>мало просмотров</small>}</td>
            <td title={row.complete ? undefined : 'По последним 100 постам: они покрывают меньше 30 дней'}>{number(row.adsPerWeek, 1)}</td>
          </tr>
          : <tr key={row.id} className="placements-locked">
            <td><Lock size={14} aria-label="Доступно с тарифом" /></td>
            <td><PlacementName row={row} /></td>
            <td>{number(row.members)}</td>
            <td colSpan={3}><span className="placements-blur" aria-hidden="true">00 000 · 0,0% · 0,0 · подходит потому что…</span></td>
          </tr>)}
      </tbody>
    </table>
  </div>;

  return <div className="panel span-2 analytics-section">
    <div className="section-title"><div>
      <h2>{result.ownGroup ? `Площадки для «${result.ownGroup.name}»` : result.brief}</h2>
      <p>{result.type === 'community' ? 'Сообщество' : 'Бизнес'} · {where} · {result.rows.length} {plural(result.rows.length, 'площадка', 'площадки', 'площадок')} из {result.candidates} {plural(result.candidates, 'найденного сообщества', 'найденных сообществ', 'найденных сообществ')} · данные на {new Date(result.loadedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
    </div></div>
    {result.ownGroup && <div className="placements-own-card">
      {result.ownGroup.photo ? <img src={result.ownGroup.photo} alt="" width={44} height={44} /> : <span className="placements-avatar">VK</span>}
      <span>
        <small>Ваша группа</small>
        <a href={result.ownGroup.url} target="_blank" rel="noreferrer">{result.ownGroup.name}</a>
        <small>{number(result.ownGroup.members)} {plural(result.ownGroup.members, 'подписчик', 'подписчика', 'подписчиков')}{result.ownGroup.views !== null ? ` · пост смотрят ~${number(result.ownGroup.views)}` : ''}{result.ownGroup.closed ? ' · закрытая: посты не видны, подбирали по названию и описанию' : ''}{result.brief ? ` · пожелания: ${result.brief}` : ''}</small>
      </span>
    </div>}
    {result.audience && <p className="placements-audience"><Sparkles size={14} aria-hidden="true" /> <b>AI определил аудиторию:</b> {result.audience}</p>}
    {result.cityMissing && <div className="ad-check-notice">Похоже, бизнес местный, но город не указан — искали по всей России. Укажите город, чтобы найти местные паблики.</div>}
    {!result.aiUsed && <div className="ad-check-notice">AI был недоступен или ответил с ошибкой: часть площадок отобрана простыми правилами, у них нет объяснения и списка рекламодателей.</div>}
    {result.queries.length > 0 && <p className="ad-check-data-note">AI искал: {result.queries.join(', ')}.</p>}

    {result.rows.length === 0
      ? <div className="empty-state">Подходящих площадок не нашлось. Опишите задачу подробнее или выберите другой город.</div>
      : <>
        <div className="placements-toolbar">
          <div className="placements-chips" role="group" aria-label="Размер">
            <span>Размер:</span>
            {result.sizeRange && chip(size === 'match', `рядом с вашей: ${compact(result.sizeRange.min)}–${compact(result.sizeRange.max)}`, () => chooseSize('match'))}
            {chip(size === 'all', 'любой', () => chooseSize('all'))}
            {sizes.map((item) => chip(size === item.key, item.label, () => chooseSize(item.key), item.key))}
          </div>
          <div className="placements-chips" role="group" aria-label="Продажа рекламы">
            {chip(sellsOnly, 'только продающие рекламу', () => { setSellsOnly(!sellsOnly); if (!sellsOnly) trackPlacementEvent('placement_filter', 'sells'); })}
          </div>
          <div className="placements-chips" role="group" aria-label="Сортировка">
            <span>Сортировать:</span>
            {(['members', 'views', 'ratio'] as const).map((key) => chip(sort === key, { members: 'подписчики', views: 'просмотры', ratio: 'просм./подп.' }[key], () => setSort(sort === key ? 'fit' : key), key))}
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
        {!topicRows.length && !cityRows.length && <div className="empty-state">Площадок такого размера нет — выберите «любой» или другой размер.</div>}

        {lockedCount > 0 && <div className="placements-paywall">
          <span>Ещё {lockedCount} {plural(lockedCount, 'площадка', 'площадки', 'площадок')} с просмотрами, рекламой, причинами и CPM — с тарифом. С ним же до 20 подборов в день.</span>
          <Link className="primary-button" to="/account" onClick={() => trackPlacementEvent('placement_paywall_click', 'rows')}>Открыть все площадки</Link>
        </div>}

        <p className="ad-check-data-note">Отметьте подходящие площадки звёздочкой — они попадут в «Мою подборку»: там можно вести переговоры, записать цену и посчитать CPM.</p>
      </>}

    <details className="ad-check-method">
      <summary>Как подбираем</summary>
      <p>AI читает описание или вашу группу: бизнес это или сообщество, нужен ли город, кто аудитория и какие сообщества искать. Ищем поиском VK, AI отсеивает страницы компаний и конкурентов, затем читает последние посты лучших сообществ и объясняет, подходит ли площадка и кто там рекламируется.</p>
      <p>«Продаёт рекламу» — за месяц были маркированные рекламные посты или хотя бы два поста с продвижением других сообществ (репост из сообщества или ссылка на него с призывом подписаться). «Похоже, продаёт» — рекламы не видно, но о ней говорят контакты или описание. Прайс берём из описания и закреплённого поста, если он там есть.</p>
      <p>Просмотры поста — медиана текущих просмотров последних постов старше 3 дней, разброс в подсказке — от 25-го до 75-го процентиля. «Мало просмотров» — меньше 100 или меньше 0,3% подписчиков. Рекламу видим только маркированную. AI может ошибаться в оценке — сверяйтесь с постами. Сообщества из подборки Socstat начинает отслеживать каждую ночь.</p>
    </details>
  </div>;
}

function PlacementName({ row }: { row: PlacementRow | PlacementLockedRow }) {
  const suffix = row.sizeMatch ? '_match' as const : '' as const;
  return <div className="placements-name">
    {row.photo ? <img src={row.photo} alt="" width={36} height={36} loading="lazy" /> : <span className="placements-avatar">VK</span>}
    <span>
      <a href={row.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', `vk${suffix}`)}>{row.name}<ExternalLink size={12} aria-hidden="true" /></a>
      {isOpen(row) && row.sellsAds !== 'unknown' && <small className={`placements-sells ${row.sellsAds}`} title={row.sellsAdsNote}>{row.sellsAds === 'yes' ? 'Продаёт рекламу' : 'Похоже, продаёт рекламу'}</small>}
      {isOpen(row) && row.reason && <small className="placements-reason" title="Вывод AI по постам сообщества"><Sparkles size={11} aria-hidden="true" /> {row.reason}</small>}
      {isOpen(row) && row.priceHint && <small className="placements-price-hint">Прайс: «{row.priceHint}»</small>}
      {isOpen(row) && row.advertisers && <small className="placements-advertisers"><Megaphone size={12} aria-hidden="true" /> Рекламируются: {row.advertisers}</small>}
      {isOpen(row) && row.promoPosts > 0 && <small className="placements-advertisers"><Users size={12} aria-hidden="true" /> Продвигают другие паблики: {row.promoPosts} {plural(row.promoPosts, 'пост', 'поста', 'постов')} за месяц</small>}
      {isOpen(row) && <span className="placements-contacts">
        {row.contacts.map((contact) => <a key={contact.url} href={contact.url} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', `contact${suffix}`)}>{contact.label}</a>)}
        <a href={row.messageUrl} target="_blank" rel="noreferrer" onClick={() => trackPlacementEvent('placement_open', `message${suffix}`)}><MessageCircle size={12} aria-hidden="true" /> Написать</a>
      </span>}
    </span>
  </div>;
}
