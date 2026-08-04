const SIZE_UNITS = ["KB", "MB", "GB", "TB"];

const ARCHIVE_SUFFIXES = [
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tbz2",
  ".tar.xz",
  ".txz",
];

export const formatDecimal = (value: number, decimals: number): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${formatDecimal(value, 1)} ${SIZE_UNITS[unit]}`;
};

export const isArchive = (name: string): boolean => {
  const lower = name.toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
