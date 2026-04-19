export function formatCurrency(cents: number | null | undefined, unit?: string) {
  if (cents === null || cents === undefined) return 'Exchange only';
  const amount = (cents / 100).toFixed(2);
  return unit ? `$${amount} / ${unit}` : `$${amount}`;
}
