import { randomInt } from 'node:crypto';
import { env } from '../config/env.js';
import { VkApiError, vkApiRequest } from './vkClient.js';

// Сообщество не может писать пользователю: запретил сообщения или никогда не разрешал.
const VK_CANNOT_SEND_CODES = new Set([900, 901, 902]);

export function isVkMessagesConfigured() {
  return Boolean(env.vkGroupToken && env.socstatVkGroupId);
}

/** Диалог с сообществом: человек пишет любое сообщение, и Callback API подключает отчёт. */
export function vkCommunityDialogUrl() {
  return `https://vk.com/write-${env.socstatVkGroupId}`;
}

export function isVkCannotSendError(error: unknown) {
  return error instanceof VkApiError && VK_CANNOT_SEND_CODES.has(error.vkCode ?? -1);
}

export async function sendVkCommunityMessage(vkUserId: string, message: string) {
  if (!isVkMessagesConfigured()) throw new VkApiError('VK_GROUP_TOKEN is not set', { code: 'VK_GROUP_TOKEN_REQUIRED' });
  await vkApiRequest<number>(
    'messages.send',
    env.vkGroupToken,
    {
      user_id: vkUserId,
      random_id: randomInt(1, 2 ** 31 - 1),
      message,
      dont_parse_links: 1
    },
    'POST'
  );
}

export async function isVkMessagesAllowed(vkUserId: string) {
  if (!isVkMessagesConfigured()) return false;
  const result = await vkApiRequest<{ is_allowed: number }>('messages.isMessagesFromGroupAllowed', env.vkGroupToken, {
    group_id: env.socstatVkGroupId,
    user_id: vkUserId
  });
  return result.is_allowed === 1;
}
