const sameFields = (first: object, second: object) => {
  const keys = Object.keys(first);
  if (keys.length !== Object.keys(second).length) return false;
  return keys.every((key) => Object.is((first as Record<string, unknown>)[key], (second as Record<string, unknown>)[key]));
};

export const keepUnchanged = <T extends object>(
  previous: readonly T[] | null | undefined,
  next: T[],
  keyOf: (item: T) => string,
): T[] => {
  if (!previous?.length) return next;
  const known = new Map(previous.map((item) => [keyOf(item), item]));
  let same = previous.length === next.length;
  const kept = next.map((item, index) => {
    const old = known.get(keyOf(item));
    const chosen = old && sameFields(old, item) ? old : item;
    if (chosen !== previous[index]) same = false;
    return chosen;
  });
  return same ? (previous as T[]) : kept;
};
