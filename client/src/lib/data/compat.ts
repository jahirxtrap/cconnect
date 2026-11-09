interface ParsedVersion {
  core: number[];
  prerelease: string[];
}

const NUMERIC = /^\d+$/;

const parse = (version: string): ParsedVersion => {
  const [main, ...prerelease] = version.trim().replace(/^v/i, "").split("+")[0].split("-");
  return {
    core: main.split(".").map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prerelease.length ? prerelease.join("-").split(".") : [],
  };
};

const compareIdentifiers = (a: string, b: string): number => {
  const [numericA, numericB] = [NUMERIC.test(a), NUMERIC.test(b)];
  if (numericA && numericB) return Math.sign(Number(a) - Number(b));
  if (numericA !== numericB) return numericA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

export const compareVersions = (a: string, b: string): number => {
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(left.core.length, right.core.length); i++) {
    const difference = (left.core[i] ?? 0) - (right.core[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  if (!left.prerelease.length || !right.prerelease.length) {
    return Math.sign(right.prerelease.length - left.prerelease.length);
  }
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    if (left.prerelease[i] === undefined) return -1;
    if (right.prerelease[i] === undefined) return 1;
    const order = compareIdentifiers(left.prerelease[i], right.prerelease[i]);
    if (order) return order;
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
