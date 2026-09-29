import type { SocialPlatform } from '../api/types';
import { TelegramLogo } from './TelegramLogo';

export function PlatformSegmentTitle({ platform }: { platform: SocialPlatform }) {
  const isYoutube = platform === 'youtube';
  const isTelegram = platform === 'telegram';

  return <span className="platform-segment-title">
    {isTelegram ? <TelegramLogo size={18} /> : <img src={isYoutube ? '/youtube-logo.png' : '/vk-network-logo.png'} alt="" />}
    {isTelegram ? 'Telegram' : isYoutube ? 'YouTube' : 'ВКонтакте'}
  </span>;
}
