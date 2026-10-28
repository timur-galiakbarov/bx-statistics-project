import { UserModel } from '../models/User.js';

export type ReportPassPlatform = 'vk' | 'youtube';

export type ReportPassRecord = {
  platform: ReportPassPlatform;
  sourceId: string;
  sourceName: string;
  usedAt: string;
};

/** What the user without access can do with the free full report right now. */
export type ReportPassState =
  | { status: 'available' }
  | { status: 'active'; platform: ReportPassPlatform; sourceId: string; sourceName: string; expiresAt: string; nextAt: string }
  | { status: 'used'; nextAt: string };

export const REPORT_PASS_DURATION_MS = 24 * 60 * 60 * 1000;
export const REPORT_PASS_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function getReportPassState(pass: ReportPassRecord | undefined, now = Date.now()): ReportPassState {
  const usedAt = pass ? new Date(pass.usedAt).getTime() : Number.NaN;
  if (!pass || Number.isNaN(usedAt) || usedAt + REPORT_PASS_INTERVAL_MS <= now) return { status: 'available' };
  const nextAt = new Date(usedAt + REPORT_PASS_INTERVAL_MS).toISOString();
  if (usedAt + REPORT_PASS_DURATION_MS > now) {
    return { status: 'active', platform: pass.platform, sourceId: pass.sourceId, sourceName: pass.sourceName, expiresAt: new Date(usedAt + REPORT_PASS_DURATION_MS).toISOString(), nextAt };
  }
  return { status: 'used', nextAt };
}

/** The pass opens only the source it was spent on, and only for its 24 hours. */
export function isReportPassActiveFor(pass: ReportPassRecord | undefined, platform: string, sourceId: string, now = Date.now()) {
  const state = getReportPassState(pass, now);
  return state.status === 'active' && state.platform === platform && state.sourceId === normalizeSourceId(sourceId);
}

/** VK ids come as «123» or «-123» from different places; YouTube ids are kept as is. */
export function normalizeSourceId(sourceId: string) {
  return sourceId.trim().replace(/^-/, '');
}

/**
 * Spends the pass in one atomic update: a double click or two tabs cannot spend it twice,
 * and a pass used less than 30 days ago is not overwritten. Returns false when it is not available.
 */
export async function activateReportPass(userId: string, platform: ReportPassPlatform, sourceId: string, sourceName: string, now = new Date()) {
  const availableBefore = new Date(now.getTime() - REPORT_PASS_INTERVAL_MS);
  const result = await UserModel.updateOne(
    { _id: userId, $or: [{ 'reportPass.usedAt': { $exists: false } }, { 'reportPass.usedAt': { $lte: availableBefore } }] },
    { $set: { reportPass: { platform, sourceId: normalizeSourceId(sourceId), sourceName: sourceName.trim().slice(0, 160), usedAt: now } } }
  );
  return result.modifiedCount === 1;
}
