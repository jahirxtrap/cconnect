const parse = (version: string): number[] =>
  version
    .trim()
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

export const compareVersions = (a: string, b: string): number => {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
};

export const satisfies = (version: string | null | undefined, range: string | null | undefined): boolean => {
  if (!version?.trim() || !range?.trim()) return true;
  return range
    .trim()
    .split(/\s+/)
    .every((token) => {
      const operator = [">=", "<=", ">", "<", "="].find((candidate) => token.startsWith(candidate)) ?? "=";
      const target = token.startsWith(operator) ? token.slice(operator.length) : token;
      if (!target.trim()) return true;
      const result = compareVersions(version, target);
      switch (operator) {
        case ">=":
          return result >= 0;
        case "<=":
          return result <= 0;
        case ">":
          return result > 0;
        case "<":
          return result < 0;
        default:
          return result === 0;
      }
    });
};
