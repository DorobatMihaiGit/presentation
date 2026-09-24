const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Turns FormData into a nested plain object for zod: `en.headline` becomes
 * `{ en: { headline } }` and repeated keys (checkbox groups) become arrays.
 * Next's internal `$ACTION_*` fields and prototype-polluting keys are dropped.
 */
export function formToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of new Set(formData.keys())) {
    const path = key.split(".");
    if (key.startsWith("$ACTION") || path.some((p) => FORBIDDEN_KEYS.has(p))) {
      continue;
    }
    const values = formData.getAll(key);
    let node = result;
    for (const part of path.slice(0, -1)) {
      const next = node[part];
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
    node[path[path.length - 1]] = values.length > 1 ? values : values[0];
  }

  return result;
}
