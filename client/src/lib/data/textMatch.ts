const fold = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const rankLabel = (label: string, query: string): number => {
  const haystack = fold(label);
  const needle = fold(query.trim());
  if (haystack.startsWith(needle)) return 0;
  if (haystack.includes(` ${needle}`)) return 1;
  return haystack.includes(needle) ? 2 : -1;
};

export const matchesLabel = (label: string | null | undefined, query: string): boolean =>
  !!label && rankLabel(label, query) >= 0;
