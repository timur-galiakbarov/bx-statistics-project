export function formatActivityDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 60) return 'меньше минуты';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
