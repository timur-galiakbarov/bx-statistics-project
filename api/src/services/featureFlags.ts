import { FeatureFlagModel } from '../models/FeatureFlag.js';

export const featureKeys = ['vkReports', 'placements'] as const;
export type FeatureKey = (typeof featureKeys)[number];

export const featureModes = ['off', 'admins', 'all'] as const;
export type FeatureMode = (typeof featureModes)[number];

// API работает в нескольких репликах: переключение доходит до всех за это время.
const CACHE_TTL_MS = 30_000;
const cache = new Map<FeatureKey, { mode: FeatureMode; expiresAt: number }>();

export function isFeatureKey(value: unknown): value is FeatureKey {
  return featureKeys.includes(value as FeatureKey);
}

export function isFeatureMode(value: unknown): value is FeatureMode {
  return featureModes.includes(value as FeatureMode);
}

/** «Только админы» — проверка фичи на проде до выкатки всем. */
export function isFeatureOnFor(mode: FeatureMode, user: { isAdmin?: boolean | null }) {
  return mode === 'all' || (mode === 'admins' && Boolean(user.isAdmin));
}

export async function getFeatureMode(key: FeatureKey, now = Date.now()): Promise<FeatureMode> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.mode;
  const flag = await FeatureFlagModel.findOne({ key }, { mode: 1 }).lean();
  const mode = isFeatureMode(flag?.mode) ? flag.mode : 'off';
  cache.set(key, { mode, expiresAt: now + CACHE_TTL_MS });
  return mode;
}

export async function isFeatureEnabledFor(key: FeatureKey, user: { isAdmin?: boolean | null }) {
  return isFeatureOnFor(await getFeatureMode(key), user);
}

export async function getFeatureModes() {
  const flags = await FeatureFlagModel.find({ key: { $in: [...featureKeys] } }, { key: 1, mode: 1, updatedAt: 1 }).lean();
  return featureKeys.map((key) => {
    const flag = flags.find((item) => item.key === key);
    return { key, mode: isFeatureMode(flag?.mode) ? flag.mode : 'off' as FeatureMode, updatedAt: flag?.updatedAt?.toISOString() ?? null };
  });
}

export async function setFeatureMode(key: FeatureKey, mode: FeatureMode, updatedBy: string) {
  await FeatureFlagModel.updateOne({ key }, { $set: { mode, updatedBy } }, { upsert: true });
  cache.delete(key);
}
