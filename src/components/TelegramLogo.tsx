import { useEffect, useState } from 'react';

export function TelegramLogo({ className, size = 24 }: { className?: string; size?: number }) {
  return <img className={className} src="/telegram-logo.svg" alt="" width={size} height={size} />;
}

export function TelegramAvatar({ className, size = 40, src }: { className?: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return src && !failed
    ? <img className={className} src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />
    : <TelegramLogo className={className} size={size} />;
}
