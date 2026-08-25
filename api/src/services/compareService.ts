import { VkApiError } from './vkClient.js';
import { getCommunityAnalytics } from './analyticsService.js';

function parseGroupIds(value: unknown) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function getCommunitiesCompare(userId: string, groupIdsValue: unknown, period: unknown) {
  const groupIds = parseGroupIds(groupIdsValue);

  if (groupIds.length === 0) {
    throw new VkApiError('VK group ids are required', {
      status: 400,
      code: 'VK_GROUP_IDS_REQUIRED'
    });
  }

  const items = [];

  for (const groupId of groupIds) {
    try {
      const analytics = await getCommunityAnalytics(userId, groupId, period);
      items.push({
        groupId,
        analytics,
        error: null
      });
    } catch (error) {
      if (error instanceof VkApiError) {
        items.push({
          groupId,
          analytics: null,
          error: {
            code: error.code,
            message: error.message,
            vkCode: error.vkCode
          }
        });
        continue;
      }

      items.push({
        groupId,
        analytics: null,
        error: {
          code: 'COMPARE_GROUP_FAILED',
          message: 'Не удалось получить данные сообщества.'
        }
      });
    }
  }

  return { items };
}
