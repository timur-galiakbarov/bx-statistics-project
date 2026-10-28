import { ExternalLink, MessageCircle, Star, Trash2 } from 'lucide-react';
import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import { ApiError, apiDelete, apiPatch } from '../api/client';
import type { ShortlistItem, ShortlistStatus } from '../api/types';
import { costPerThousand, positiveAmount } from '../utils/adCheck';
import { trackPlacementEvent } from '../utils/visit';

const statusLabels: Record<ShortlistStatus, string> = {
  new: 'Новая',
  contacted: 'Написал',
  answered: 'Ответили',
  agreed: 'Договорились',
  published: 'Реклама вышла',
  declined: 'Отказ'
};

const number = (value: number | null, digits = 0) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const rubles = (value: number | null) => value === null ? '—' : `${number(value, value < 10 ? 2 : 0)} ₽`;

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * «Моя подборка»: площадки, отмеченные звёздочкой в подборе. Статус переговоров, цена и заметка сохраняются на сервере;
 * CPM и бюджет считаются по введённым ценам.
 */
export function PlacementShortlist({ items, onChange }: { items: ShortlistItem[]; onChange: Dispatch<SetStateAction<ShortlistItem[]>> }) {
  const [message, setMessage] = useState('');
  // What the user is typing lives apart from the saved values until the field is left: saving another row must not erase it.
  const [prices, setPrices] = useState<Record<number, string | undefined>>({});
  const [notes, setNotes] = useState<Record<number, string | undefined>>({});
  const priceTracked = useRef(false);
  const shownPrice = (item: ShortlistItem) => prices[item.groupId] ?? (item.price === null ? '' : String(item.price).replace('.', ','));
  const shownNote = (item: ShortlistItem) => notes[item.groupId] ?? item.note;

  // Updates go through the latest list: several fields saved one after another must not overwrite each other.
  // A failed save rolls back only the fields it changed.
  const save = (groupId: number, patch: Partial<Pick<ShortlistItem, 'status' | 'price' | 'note'>>) => {
    const current = items.find((item) => item.groupId === groupId);
    if (!current) return;
    const rollback = Object.fromEntries(Object.keys(patch).map((key) => [key, current[key as keyof typeof patch]]));
    onChange((list) => list.map((item) => item.groupId === groupId ? { ...item, ...patch } : item));
    apiPatch<ShortlistItem>(`/api/placements/shortlist/${groupId}`, patch)
      .then(() => setMessage(''))
      .catch((error) => {
        onChange((list) => list.map((item) => item.groupId === groupId ? { ...item, ...rollback } : item));
        setMessage(error instanceof ApiError ? error.message : 'Не удалось сохранить. Повторите позже.');
      });
  };

  const savePrice = (item: ShortlistItem) => {
    const draft = prices[item.groupId];
    if (draft === undefined) return;
    const value = draft.trim();
    const price = value ? positiveAmount(value) : null;
    if (value && price === null) return setMessage('Цена — число, например 5000 или 5 000,50.');
    setPrices((current) => ({ ...current, [item.groupId]: undefined }));
    if (price === item.price) return;
    save(item.groupId, { price });
    if (price !== null && !priceTracked.current) {
      priceTracked.current = true;
      trackPlacementEvent('placement_price', 'entered');
    }
  };

  const saveNote = (item: ShortlistItem) => {
    const draft = notes[item.groupId];
    if (draft === undefined) return;
    setNotes((current) => ({ ...current, [item.groupId]: undefined }));
    if (draft.trim() !== item.note) save(item.groupId, { note: draft.trim() });
  };

  const remove = (groupId: number) => {
    const removed = items.find((item) => item.groupId === groupId);
    onChange((list) => list.filter((item) => item.groupId !== groupId));
    apiDelete(`/api/placements/shortlist/${groupId}`).catch(() => {
      if (removed) onChange((list) => list.some((item) => item.groupId === groupId) ? list : [removed, ...list]);
      setMessage('Не удалось убрать площадку. Повторите позже.');
    });
  };

  const live = items.filter((item) => item.status !== 'declined');
  const priced = live.filter((item) => item.price !== null && item.views);
  const budget = priced.reduce((sum, item) => sum + item.price!, 0);
  const views = priced.reduce((sum, item) => sum + item.views!, 0);
  const agreed = items.filter((item) => item.status === 'agreed' || item.status === 'published').length;

  return <div className="panel span-2 analytics-section placements-shortlist">
    <div className="section-title"><div>
      <h2><Star size={19} aria-hidden="true" /> Моя подборка · {items.length}</h2>
      <p>Площадки, отмеченные звёздочкой. Отмечайте, кому написали и о чём договорились, записывайте цену — посчитаем CPM и бюджет. Подборка сохраняется, её видно при каждом открытии страницы.</p>
    </div></div>
    {message && <div className="form-message telegram-message-error" role="alert">{message}</div>}
    <div className="placements-table-wrap" tabIndex={0} aria-label="Моя подборка">
      <table className="placements-table placements-shortlist-table">
        <thead><tr>
          <th scope="col">Сообщество</th>
          <th scope="col">Подписчики</th>
          <th scope="col">Просмотры поста</th>
          <th scope="col">Статус</th>
          <th scope="col">Цена, ₽</th>
          <th scope="col" title="Цена 1 000 просмотров">CPM</th>
          <th scope="col">Заметка</th>
          <th scope="col"><span className="placements-sr-only">Убрать</span></th>
        </tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.groupId} className={item.status === 'declined' ? 'placements-dead' : ''}>
            <td><div className="placements-name">
              {item.photo ? <img src={item.photo} alt="" width={36} height={36} loading="lazy" /> : <span className="placements-avatar">VK</span>}
              <span>
                <a href={item.url} target="_blank" rel="noreferrer">{item.name}<ExternalLink size={12} aria-hidden="true" /></a>
                {item.sellsAds !== 'unknown' && <small className={`placements-sells ${item.sellsAds}`}>{item.sellsAds === 'yes' ? 'Продаёт рекламу' : 'Похоже, продаёт рекламу'}</small>}
                {item.task && <small>Подбор: {item.task}</small>}
                <span className="placements-contacts">
                  {item.contacts.map((contact) => <a key={contact.url} href={contact.url} target="_blank" rel="noreferrer">{contact.label}</a>)}
                  <a href={item.messageUrl} target="_blank" rel="noreferrer"><MessageCircle size={12} aria-hidden="true" /> Написать</a>
                </span>
              </span>
            </div></td>
            <td>{number(item.members)}</td>
            <td>{number(item.views)}</td>
            <td><select className="placements-status" value={item.status} onChange={(event) => save(item.groupId, { status: event.target.value as ShortlistStatus })} aria-label={`Статус: ${item.name}`}>
              {(Object.keys(statusLabels) as ShortlistStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select></td>
            <td><input className="placements-price" value={shownPrice(item)} onChange={(event) => setPrices((current) => ({ ...current, [item.groupId]: event.target.value }))} onBlur={() => savePrice(item)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} inputMode="decimal" placeholder="—" maxLength={24} aria-label={`Цена размещения: ${item.name}`} /></td>
            <td>{rubles(costPerThousand(item.price, item.views))}</td>
            <td><input className="placements-note" value={shownNote(item)} onChange={(event) => setNotes((current) => ({ ...current, [item.groupId]: event.target.value }))} onBlur={() => saveNote(item)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="Например: ответят завтра" maxLength={500} aria-label={`Заметка: ${item.name}`} /></td>
            <td><button type="button" className="placements-remove" onClick={() => remove(item.groupId)} aria-label={`Убрать из подборки: ${item.name}`} title="Убрать из подборки"><Trash2 size={16} aria-hidden="true" /></button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="placements-summary" aria-live="polite">
      <strong>{agreed ? `Договорились или вышло: ${agreed} из ${items.length}` : `${items.length} ${plural(items.length, 'площадка', 'площадки', 'площадок')} в подборке`}</strong>
      <span>{priced.length
        ? `С ценой ${priced.length}: бюджет ${rubles(budget)} за ~${number(views)} просмотров, средний CPM ${rubles(costPerThousand(budget, views))}${live.length > priced.length ? ` · без цены ещё ${live.length - priced.length}` : ''}`
        : 'Впишите цены, которые назвали админы, — посчитаем бюджет и средний CPM. Площадки с отказом в расчёт не входят.'}</span>
    </div>
  </div>;
}
