export function formatDistance(miles: number | null | undefined) {
  if (miles === null || miles === undefined) return '';
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
