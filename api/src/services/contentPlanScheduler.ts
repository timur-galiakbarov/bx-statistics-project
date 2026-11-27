import { cleanupMedia } from './contentPlanMedia.js';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { ContentPlanPostModel } from '../models/ContentPlanPost.js';
import { publishDuePost } from './contentPlanPublisher.js';
import { redis } from './redis.js';

const LOCK_KEY = 'socstat:content-plan:publish-lock';
const LOCK_TTL_MS = 2 * 60_000;
const INTERVAL_MS = 30_000;
const MAX_AUTO_ATTEMPTS = 3;

let running = false;

async function tick() {
  if (running || !redis.isOpen) return;

  const token = randomUUID();
  let locked: string | null = null;
  try {
    locked = await redis.set(LOCK_KEY, token, { NX: true, PX: LOCK_TTL_MS });
  } catch (error) {
    console.error('Content plan scheduler lock failed', error);
    return;
  }
  if (locked !== 'OK') return;

  running = true;
  try {
    const now = new Date();
    const due = await ContentPlanPostModel.find({
      $or: [
        { status: 'scheduled', autoPublish: true, scheduledAt: { $lte: now } },
        { status: 'failed', nextAttemptAt: { $lte: now }, attempts: { $lt: MAX_AUTO_ATTEMPTS } }
      ]
    }).sort({ scheduledAt: 1 }).limit(20).select('_id').lean();

    for (const item of due) {
      try {
        const result = await publishDuePost(String(item._id));
        if (result) console.log('Content plan published', result.id);
      } catch (error) {
        console.error('Content plan publish failed', error);
      }
    }
    await cleanupMedia().catch(() => console.error('Content plan media cleanup failed'));
  } catch (error) {
    console.error('Content plan scheduler pass failed', error);
  } finally {
    running = false;
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      { keys: [LOCK_KEY], arguments: [token] }
    ).catch(() => undefined);
  }
}

export function startContentPlanScheduler() {
  if (!env.contentPlanSchedulerEnabled) return;
  console.log(`Content plan scheduler enabled: every ${INTERVAL_MS / 1000} s`);
  setTimeout(() => void tick(), 15_000);
  setInterval(() => void tick(), INTERVAL_MS).unref();
}
