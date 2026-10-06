export type SourcePlatform = 'vk' | 'youtube' | 'telegram';

export function normalizeVkQuery(value: string) {
  return value.trim().replace(/^(https?:\/\/)?(m\.)?vk\.(com|ru)\//, '');
}

// Площадку можно определить только по ссылке: @username бывает и в Telegram, и на YouTube.
export function detectPlatform(value: string): SourcePlatform | null {
  if (/(^|\/\/|\.)(t|telegram)\.me\//i.test(value)) return 'telegram';
  if (/(youtube\.com|youtu\.be)\//i.test(value)) return 'youtube';
  if (/(^|\/\/|\.)vk\.(com|ru)\//i.test(value)) return 'vk';
  return null;
}
