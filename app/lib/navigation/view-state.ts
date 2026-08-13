export const SCREEN_IDS = ["home", "chart", "research", "community", "policy"] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

export type ViewState = {
  screen: ScreenId;
  sido?: string;
  sigungu?: string;
  hcode?: string;
  bcode?: string;
  property?: string;
  area?: string;
  tradePy?: string;
  lat?: number;
  lng?: number;
  level?: number;
};

const QUERY_KEYS = ["sido", "sigungu", "hcode", "bcode", "property", "area", "tradePy", "lat", "lng", "level"] as const;

function safeText(value: string | null, maxLength: number) {
  const normalized = value?.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function safeNumber(value: string | null, minimum: number, maximum: number) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

export function normalizeScreen(hash: string): ScreenId {
  const value = hash.replace(/^#/, "");
  if (value === "field") return "chart";
  if (value === "map") return "research";
  return SCREEN_IDS.includes(value as ScreenId) ? value as ScreenId : "home";
}

export function readViewState(url: URL): ViewState {
  return {
    screen: normalizeScreen(url.hash),
    sido: safeText(url.searchParams.get("sido"), 20),
    sigungu: safeText(url.searchParams.get("sigungu"), 10),
    hcode: safeText(url.searchParams.get("hcode"), 16),
    bcode: safeText(url.searchParams.get("bcode"), 16),
    property: safeText(url.searchParams.get("property"), 240),
    area: safeText(url.searchParams.get("area"), 16),
    tradePy: safeText(url.searchParams.get("tradePy"), 16),
    lat: safeNumber(url.searchParams.get("lat"), 32, 40),
    lng: safeNumber(url.searchParams.get("lng"), 123, 133),
    level: safeNumber(url.searchParams.get("level"), 1, 14),
  };
}

export function writeViewState(current: URL, state: ViewState) {
  const url = new URL(current.toString());
  url.hash = state.screen;
  for (const key of QUERY_KEYS) {
    const value = state[key];
    if (value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

