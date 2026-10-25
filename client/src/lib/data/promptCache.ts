export interface PromptCache {
  expiresAt: number;
  ttl: number;
  readRatio: number;
}

export const promptCacheOf = (raw: unknown): PromptCache | null => {
  if (!raw || typeof raw !== "object") return null;
  const { expires_at: expiresAt, ttl, read_ratio: readRatio } = raw as Record<string, unknown>;
  return typeof expiresAt === "number" && typeof ttl === "number" && typeof readRatio === "number"
    ? { expiresAt, ttl, readRatio }
    : null;
};
