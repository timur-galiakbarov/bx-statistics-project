import { VkApiError } from './vkClient.js';
import { getCommunityAnalytics } from './analyticsService.js';
import { getYoutubeChannelAnalytics } from './youtubeAnalyticsService.js';
import { DomainError } from '../errors/domainError.js';

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

export async function getCommunitiesCompare(userId: string, groupIdsValue: unknown, period: unknown, platformValue: unknown = 'vk') {
  const groupIds = parseGroupIds(groupIdsValue);

  if (groupIds.length === 0) {
    throw new VkApiError('VK group ids are required', {
      status: 400,
      code: 'VK_GROUP_IDS_REQUIRED'
    });
  }

  const items = [];

  for (const groupId of groupIds) {
    const separator = groupId.indexOf(':');
    const explicitPlatform = separator > 0 ? groupId.slice(0, separator) : String(platformValue);
    const externalId = separator > 0 ? groupId.slice(separator + 1) : groupId;
    const platform = explicitPlatform === 'youtube' ? 'youtube' : 'vk';
    try {
      const analytics = platform === 'youtube'
        ? await getYoutubeChannelAnalytics(externalId, period)
        : await getCommunityAnalytics(userId, externalId, period);
      items.push({
        groupId: externalId,
        platform,
        analytics,
        error: null
      });
    } catch (error) {
      if (error instanceof VkApiError || error instanceof DomainError) {
        items.push({
          groupId: externalId,
          platform,
          analytics: null,
          error: {
            code: error.code,
            message: error.message,
            ...(error instanceof VkApiError ? { vkCode: error.vkCode } : {})
          }
        });
        continue;
      }

      items.push({
        groupId: externalId,
        platform,
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
