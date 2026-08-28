export function formatDate(value?: string | null, fallback = '-') {
  if (!value) {
    return fallback;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[3]}.${match[2]}.${match[1]}` : fallback;
}
