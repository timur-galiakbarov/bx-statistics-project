import { UserModel } from '../models/User.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { vkApiRequest } from './vkClient.js';

const DAY_MS = 86_400_000;

// Atomic claim also limits concurrent requests across API processes.
export async function refreshVkManagement(userId: string) {
  const now = new Date();
  const claimed = await UserModel.findOneAndUpdate({
    _id: userId,
    $or: [
      { 'vkManagement.attemptedAt': { $exists: false } },
      { 'vkManagement.attemptedAt': { $lte: new Date(now.getTime() - DAY_MS) } }
    ]
  }, { $set: { 'vkManagement.attemptedAt': now } }).select({ _id: 1 }).lean();
  if (!claimed) return;

  try {
    const token = await getVkAccessToken(userId);
    if (!token) throw new Error('VK_TOKEN_REQUIRED');
    // Only existence matters: one result covers all management roles.
    const result = await vkApiRequest<{ count: number; items: number[] }>('groups.get', token, {
      filter: 'moder', extended: 0, count: 1
    });
    if (!Number.isInteger(result.count) || result.count < 0) throw new Error('INVALID_VK_GROUP_COUNT');
    await UserModel.updateOne({ _id: userId }, { $set: {
      'vkManagement.status': 'checked',
      'vkManagement.checkedAt': new Date(),
      'vkManagement.managesCommunity': result.count > 0
    } });
  } catch {
    await UserModel.updateOne({ _id: userId }, {
      $set: { 'vkManagement.status': 'unavailable' },
      $unset: { 'vkManagement.managesCommunity': 1, 'vkManagement.checkedAt': 1 }
    });
  }
}
