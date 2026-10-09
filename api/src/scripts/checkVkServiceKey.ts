import { env } from '../config/env.js';
import { VkApiError, vkApiRequest } from '../services/vkClient.js';

// Проверка сервисного ключа VK для ночных срезов: npm run snapshots:check-vk-key --workspace @socstat/api -- [id группы ...]
// Ключ берётся из VK_SERVICE_KEY и в вывод не попадает.
const groupIds = process.argv.slice(2).length ? process.argv.slice(2) : [env.socstatVkGroupId];

if (!env.vkServiceKey) {
  console.error('VK_SERVICE_KEY is not set.');
  process.exit(1);
}

function describe(error: unknown) {
  return error instanceof VkApiError ? `VK error ${error.vkCode}: ${error.message}` : String(error);
}

type WallResponse = { count: number; items: Array<{ id: number; date: number; views?: { count?: number }; likes?: { count?: number } }> };

try {
  const groups = await vkApiRequest<Array<{ id: number; name?: string; is_closed?: number; members_count?: number }>>('groups.getById', env.vkServiceKey, {
    group_ids: groupIds.join(','),
    fields: 'members_count'
  });
  for (const group of groups) {
    console.log(`\n${group.id} «${group.name}» closed=${group.is_closed ?? '?'} members_count=${group.members_count ?? 'MISSING'}`);
    try {
      const wall = await vkApiRequest<WallResponse>('wall.get', env.vkServiceKey, { owner_id: -group.id, count: 5 });
      const withViews = wall.items.filter((post) => typeof post.views?.count === 'number').length;
      console.log(`  wall.get: ${wall.items.length} posts, views on ${withViews}/${wall.items.length}`);
      for (const post of wall.items) {
        console.log(`  post ${post.id} ${new Date(post.date * 1000).toISOString().slice(0, 10)} views=${post.views?.count ?? 'MISSING'} likes=${post.likes?.count ?? 'MISSING'}`);
      }
    } catch (error) {
      console.log(`  wall.get failed: ${describe(error)}`);
    }
  }
} catch (error) {
  console.error(`groups.getById failed: ${describe(error)}`);
  process.exit(1);
}
