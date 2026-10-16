/** Price typed by the user: grouping spaces and a comma are allowed, at most two decimals, up to 1 bn ₽. */
export function positiveAmount(input: string): number | null {
  const normalized = input.trim().replace(/[\s  ]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000 ? amount : null;
}

/** CPM: price of a thousand views. */
export function costPerThousand(price: number | null, views: number | null): number | null {
  return price !== null && Number.isFinite(price) && price > 0 && views !== null && Number.isFinite(views) && views > 0 ? price / views * 1000 : null;
}
