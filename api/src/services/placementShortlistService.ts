import type { Types } from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { PlacementShortlistModel, shortlistStatuses } from '../models/PlacementShortlist.js';

export type ShortlistStatus = (typeof shortlistStatuses)[number];

export type ShortlistItem = {
  groupId: number;
  name: string;
  url: string;
  photo: string | null;
  members: number;
  views: number | null;
  viewsToSubscribers: number | null;
  sellsAds: 'yes' | 'likely' | 'unknown';
  contacts: Array<{ label: string; url: string }>;
  messageUrl: string;
  task: string;
  status: ShortlistStatus;
  price: number | null;
  note: string;
  addedAt: string;
  updatedAt: string;
};

/** Enough for any real campaign; protects the collection from scripted floods. */
export const SHORTLIST_LIMIT = 200;
const NOTE_LIMIT = 500;
const MAX_PRICE = 10_000_000;

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const vkUrl = (value: unknown) => {
  const url = text(value, 300);
  return /^https:\/\/vk\.(com|ru)\//.test(url) ? url : '';
};

/** What the page sends when a community is added: the row of the search, checked field by field. */
export function sanitizeShortlistItem(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  const groupId = Number(raw.groupId);
  const name = text(raw.name, 200);
  const url = vkUrl(raw.url);
  if (!Number.isInteger(groupId) || groupId <= 0 || !name || !url) throw new DomainError('Не удалось добавить площадку в подборку.', { status: 400, code: 'SHORTLIST_ITEM_INVALID' });
  const photo = text(raw.photo, 500);
  return {
    groupId,
    name,
    url,
    photo: /^https:\/\//.test(photo) ? photo : null,
    members: count(raw.members) ?? 0,
    views: count(raw.views),
    viewsToSubscribers: count(raw.viewsToSubscribers),
    sellsAds: raw.sellsAds === 'yes' || raw.sellsAds === 'likely' ? raw.sellsAds : 'unknown' as const,
    contacts: (Array.isArray(raw.contacts) ? raw.contacts : [])
      .map((contact) => ({ label: text((contact as Record<string, unknown>)?.label, 80), url: vkUrl((contact as Record<string, unknown>)?.url) }))
      .filter((contact) => contact.label && contact.url)
      .slice(0, 3),
    messageUrl: `https://vk.com/im?sel=-${groupId}`,
    task: text(raw.task, 200)
  };
}

/** Status, price and note the user changes; only the fields sent are touched. Price null clears it. */
export function sanitizeShortlistPatch(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  const patch: { status?: ShortlistStatus; price?: number | null; note?: string } = {};
  if (raw.status !== undefined) {
    if (!shortlistStatuses.includes(raw.status as ShortlistStatus)) throw new DomainError('Неизвестный статус.', { status: 400, code: 'SHORTLIST_STATUS_INVALID' });
    patch.status = raw.status as ShortlistStatus;
  }
  if (raw.price !== undefined) {
    const price = raw.price === null || raw.price === '' ? null : Number(raw.price);
    if (price !== null && (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE)) throw new DomainError('Цена — положительное число.', { status: 400, code: 'SHORTLIST_PRICE_INVALID' });
    patch.price = price === null ? null : Math.round(price * 100) / 100;
  }
  if (raw.note !== undefined) patch.note = text(raw.note, NOTE_LIMIT);
  return patch;
}

type ShortlistDoc = Omit<ShortlistItem, 'addedAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };

function toItem(doc: ShortlistDoc): ShortlistItem {
  return {
    groupId: doc.groupId,
    name: doc.name,
    url: doc.url,
    photo: doc.photo ?? null,
    members: doc.members,
    views: doc.views ?? null,
    viewsToSubscribers: doc.viewsToSubscribers ?? null,
    sellsAds: doc.sellsAds,
    contacts: (doc.contacts ?? []).map(({ label, url }) => ({ label, url })),
    messageUrl: doc.messageUrl,
    task: doc.task ?? '',
    status: doc.status,
    price: doc.price ?? null,
    note: doc.note ?? '',
    addedAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

export async function getShortlist(userId: string | Types.ObjectId) {
  const docs = await PlacementShortlistModel.find({ userId }).sort({ createdAt: -1 }).limit(SHORTLIST_LIMIT).lean<ShortlistDoc[]>();
  return docs.map(toItem);
}

/** Adds the community or refreshes its snapshot; status, price and note of an existing item stay. */
export async function addToShortlist(userId: string, body: unknown) {
  const item = sanitizeShortlistItem(body);
  const exists = await PlacementShortlistModel.exists({ userId, groupId: item.groupId });
  if (!exists && await PlacementShortlistModel.countDocuments({ userId }) >= SHORTLIST_LIMIT) {
    throw new DomainError(`В подборке уже ${SHORTLIST_LIMIT} площадок — удалите лишние.`, { status: 400, code: 'SHORTLIST_FULL' });
  }
  const doc = await PlacementShortlistModel.findOneAndUpdate(
    { userId, groupId: item.groupId },
    { $set: item, $setOnInsert: { status: 'new', price: null, note: '' } },
    { upsert: true, new: true }
  ).lean<ShortlistDoc>();
  return { item: toItem(doc!), created: !exists };
}

export async function updateShortlistItem(userId: string, groupId: number, body: unknown) {
  const patch = sanitizeShortlistPatch(body);
  const doc = await PlacementShortlistModel.findOneAndUpdate({ userId, groupId }, { $set: patch }, { new: true }).lean<ShortlistDoc>();
  if (!doc) throw new DomainError('Площадки нет в подборке.', { status: 404, code: 'SHORTLIST_ITEM_NOT_FOUND' });
  return { item: toItem(doc), patch };
}

export async function removeFromShortlist(userId: string, groupId: number) {
  await PlacementShortlistModel.deleteOne({ userId, groupId });
}
