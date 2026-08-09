export const dynamic = "force-dynamic";

type OverpassElement = { id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> };
const OVERPASS_ENDPOINTS = ["https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000; const rad = Math.PI / 180; const dLat = (lat2 - lat1) * rad; const dLng = (lng2 - lng1) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function category(tags: Record<string, string>) {
  if (tags.railway === "station" || tags.railway === "subway_entrance" || tags.public_transport === "station") return "교통";
  if (["school", "kindergarten", "university", "college"].includes(tags.amenity)) return "교육";
  if (["hospital", "clinic", "doctors", "pharmacy"].includes(tags.amenity)) return "의료";
  if (["supermarket", "convenience", "mall", "department_store"].includes(tags.shop) || tags.amenity === "marketplace") return "장보기";
  if (["park", "fitness_centre", "sports_centre", "playground"].includes(tags.leisure) || tags.amenity === "library") return "여가";
  return "생활";
}
async function fetchPlaces(endpoint: string, query: string) { const url = new URL(endpoint); url.searchParams.set("data", query); const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "JipgapsJeongseok/1.0" }, signal: AbortSignal.timeout(26000) }); if (!response.ok) throw new Error(`OVERPASS_${response.status}`); return response.json() as Promise<{ elements?: OverpassElement[] }>; }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; const lat = Number(params.get("lat")); const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133) return Response.json({ error: "대한민국 안의 올바른 좌표가 필요합니다." }, { status: 400 });
  const query = `[out:json][timeout:15];(nwr(around:1000,${lat},${lng})["name"]["amenity"~"school|kindergarten|university|college|hospital|clinic|doctors|pharmacy|marketplace|library"];nwr(around:1000,${lat},${lng})["name"]["shop"~"supermarket|convenience|mall|department_store"];nwr(around:1000,${lat},${lng})["name"]["leisure"~"park|fitness_centre|sports_centre|playground"];nwr(around:1000,${lat},${lng})["name"]["railway"~"station|subway_entrance"];nwr(around:1000,${lat},${lng})["name"]["public_transport"="station"];);out center tags 80;`;
  try {
    const data = await Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => fetchPlaces(endpoint, query))); const seen = new Set<string>();
    const places = (data.elements || []).flatMap((element) => {
      const placeLat = element.lat ?? element.center?.lat; const placeLng = element.lon ?? element.center?.lon; const tags = element.tags || {}; const name = tags["name:ko"] || tags.name;
      if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return [];
      const distance = Math.round(haversine(lat, lng, placeLat!, placeLng!)); const group = category(tags); const key = `${group}|${name}`; if (distance > 1000 || seen.has(key)) return []; seen.add(key);
      return [{ id: `${element.id}-${group}`, name, category: group, distance, walkingMinutes: Math.max(1, Math.round(distance * 1.2 / 75)), lat: placeLat!, lng: placeLng!, detail: tags.amenity || tags.shop || tags.leisure || tags.railway || tags.public_transport || "" }];
    }).sort((a, b) => a.distance - b.distance).slice(0, 40);
    return Response.json({ places, radius: 1000, source: "OpenStreetMap contributors", measuredAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "주변 시설 데이터를 잠시 불러오지 못했습니다. 잠시 뒤 다시 확인해주세요." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
