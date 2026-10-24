/** Natural order: "9A" < "9B" < "10A" < "12A". */
export function compareClassNames(
  a: string,
  b: string,
  order: 'asc' | 'desc' = 'asc',
): number {
  const result = a.localeCompare(b, 'en', { numeric: true });
  return order === 'asc' ? result : -result;
}
