export interface ApiRetry {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  until: number;
  error: string | null;
  noResponse: boolean;
}

const REASONS: Record<string, string> = {
  overloaded: "STATUS_RETRY_OVERLOADED",
  rate_limit: "STATUS_RETRY_RATE_LIMIT",
  server_error: "STATUS_RETRY_SERVER_ERROR",
};

export const retryReason = (retry: ApiRetry): string | null =>
  retry.noResponse ? "STATUS_RETRY_NO_RESPONSE" : ((retry.error && REASONS[retry.error]) ?? null);
