import { normalizeCacheKey, normalizeCacheNamespace } from "./keys.ts";
import { SupabaseRestError, supabaseRestConfig, supabaseRestFetch } from "./supabase-rest.ts";
import type {
  ApiCacheRow,
  CacheReadOptions,
  CacheReadResult,
  CacheWriteOptions,
  CacheWriteResult,
} from "./types.ts";

export const MAX_CACHE_ENTRY_BYTES = 5 * 1024 * 1024;

export type {
  CacheDataStatus,
  CacheReadOptions,
  CacheReadResult,
  CacheWriteOptions,
  CacheWriteResult,
} from "./types.ts";

export function cacheEnabled(): boolean {
  return supabaseRestConfig() !== null;
}

function unavailableRead<T>(): CacheReadResult<T> {
  return {
    state: "unavailable", data: null, dataStatus: null,
    capturedAt: null, freshUntil: null, staleUntil: null,
    source: "none", bypass: true,
  };
}

function missRead<T>(): CacheReadResult<T> {
  return {
    state: "miss", data: null, dataStatus: null,
    capturedAt: null, freshUntil: null, staleUntil: null,
    source: "supabase", bypass: true,
  };
}

export async function readCache<T>(
  namespace: string,
  key: string | Record<string, unknown>,
  options: CacheReadOptions = {},
): Promise<CacheReadResult<T>> {
  if (!cacheEnabled()) return unavailableRead<T>();
  try {
    const params = new URLSearchParams({
      namespace: `eq.${normalizeCacheNamespace(namespace)}`,
      cache_key: `eq.${normalizeCacheKey(key)}`,
      select: "namespace,cache_key,payload,data_status,captured_at,fresh_until,stale_until,size_bytes",
      limit: "1",
    });
    const response = await supabaseRestFetch(`api_cache_entries?${params}`);
    const rows = await response.json() as ApiCacheRow[];
    const row = rows[0];
    if (!row) return missRead<T>();
    const now = Date.now();
    const freshUntil = Date.parse(row.fresh_until);
    const staleUntil = Date.parse(row.stale_until);
    if (!Number.isFinite(freshUntil) || !Number.isFinite(staleUntil) || now > staleUntil) return missRead<T>();
    const state = now <= freshUntil ? "fresh" : "stale";
    if (state === "stale" && options.allowStale === false) return missRead<T>();
    return {
      state,
      data: row.payload as T,
      dataStatus: row.data_status,
      capturedAt: row.captured_at,
      freshUntil: row.fresh_until,
      staleUntil: row.stale_until,
      source: "supabase",
      bypass: false,
    };
  } catch (error) {
    if (error instanceof SupabaseRestError && error.message === "SUPABASE_CACHE_UNAVAILABLE") return unavailableRead<T>();
    return {
      state: "error", data: null, dataStatus: null,
      capturedAt: null, freshUntil: null, staleUntil: null,
      source: "supabase", bypass: true,
    };
  }
}

function positiveSeconds(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name}은 0 이상의 유한한 숫자여야 합니다.`);
  return Math.floor(value);
}

export async function writeCache<T>(
  namespace: string,
  key: string | Record<string, unknown>,
  payload: T,
  options: CacheWriteOptions,
): Promise<CacheWriteResult> {
  const json = JSON.stringify(payload);
  const sizeBytes = new TextEncoder().encode(json).byteLength;
  if (sizeBytes > MAX_CACHE_ENTRY_BYTES) {
    return { state: "error", source: cacheEnabled() ? "supabase" : "none", bypass: true, sizeBytes, capturedAt: null, freshUntil: null, staleUntil: null };
  }
  if (!cacheEnabled()) {
    return { state: "unavailable", source: "none", bypass: true, sizeBytes, capturedAt: null, freshUntil: null, staleUntil: null };
  }
  try {
    const captured = options.capturedAt instanceof Date ? options.capturedAt : new Date(options.capturedAt ?? Date.now());
    if (Number.isNaN(captured.getTime())) throw new Error("capturedAt이 올바른 날짜가 아닙니다.");
    const freshSeconds = positiveSeconds(options.freshForSeconds, "freshForSeconds");
    const staleSeconds = positiveSeconds(options.staleForSeconds, "staleForSeconds");
    const freshUntil = new Date(captured.getTime() + freshSeconds * 1_000);
    const staleUntil = new Date(freshUntil.getTime() + staleSeconds * 1_000);
    const row = {
      namespace: normalizeCacheNamespace(namespace),
      cache_key: normalizeCacheKey(key),
      payload: JSON.parse(json) as unknown,
      data_status: options.dataStatus ?? "ok",
      captured_at: captured.toISOString(),
      fresh_until: freshUntil.toISOString(),
      stale_until: staleUntil.toISOString(),
      size_bytes: sizeBytes,
      updated_at: new Date().toISOString(),
    };
    const params = new URLSearchParams({ on_conflict: "namespace,cache_key" });
    await supabaseRestFetch(`api_cache_entries?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([row]),
    });
    return {
      state: "written", source: "supabase", bypass: false, sizeBytes,
      capturedAt: row.captured_at, freshUntil: row.fresh_until, staleUntil: row.stale_until,
    };
  } catch {
    return { state: "error", source: "supabase", bypass: true, sizeBytes, capturedAt: null, freshUntil: null, staleUntil: null };
  }
}
