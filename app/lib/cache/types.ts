export type CacheDataStatus = "ok" | "partial" | "empty";

export type CacheReadState = "fresh" | "stale" | "miss" | "unavailable" | "error";

export type CacheReadOptions = {
  /** Return an expired-fresh but still usable stale entry. Defaults to true. */
  allowStale?: boolean;
};

export type CacheReadResult<T> = {
  state: CacheReadState;
  data: T | null;
  dataStatus: CacheDataStatus | null;
  capturedAt: string | null;
  freshUntil: string | null;
  staleUntil: string | null;
  source: "supabase" | "none";
  /** True means the caller should continue through the existing upstream path. */
  bypass: boolean;
};

export type CacheWriteOptions = {
  freshForSeconds: number;
  /** Additional stale-while-fallback window after freshForSeconds. */
  staleForSeconds: number;
  dataStatus?: CacheDataStatus;
  capturedAt?: string | Date;
};

export type CacheWriteResult = {
  state: "written" | "unavailable" | "error";
  source: "supabase" | "none";
  bypass: boolean;
  sizeBytes: number;
  capturedAt: string | null;
  freshUntil: string | null;
  staleUntil: string | null;
};

export type ApiCacheRow = {
  namespace: string;
  cache_key: string;
  payload: unknown;
  data_status: CacheDataStatus;
  captured_at: string;
  fresh_until: string;
  stale_until: string;
  size_bytes: number;
};
