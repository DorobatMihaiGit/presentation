/** FormData from a flat record; array values become repeated keys. */
export function form(
  values: Record<string, string | string[] | File>,
): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}
