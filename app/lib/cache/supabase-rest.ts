const DEFAULT_TIMEOUT_MS = 5_000;

export type SupabaseRestConfig = {
  baseUrl: string;
  serviceRoleKey: string;
};

export class SupabaseRestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
  }
}

export function supabaseRestConfig(): SupabaseRestConfig | null {
  const baseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceRoleKey) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return { baseUrl: url.origin, serviceRoleKey };
  } catch {
    return null;
  }
}

export async function supabaseRestFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const config = supabaseRestConfig();
  if (!config) throw new SupabaseRestError("SUPABASE_CACHE_UNAVAILABLE");
  const response = await fetch(new URL(path, `${config.baseUrl}/rest/v1/`), {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    // Do not expose the response body: upstream bodies can contain operational details.
    throw new SupabaseRestError(`SUPABASE_CACHE_HTTP_${response.status}`, response.status);
  }
  return response;
}
