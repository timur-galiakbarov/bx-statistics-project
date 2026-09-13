import type { SocialPlatform } from '../api/types';

export function PlatformSegmentTitle({ platform }: { platform: SocialPlatform }) {
  const isYoutube = platform === 'youtube';

  return <span className="platform-segment-title">
    <img src={isYoutube ? '/youtube-logo.png' : '/vk-network-logo.png'} alt="" />
    {isYoutube ? 'YouTube' : 'ВКонтакте'}
  </span>;
}
