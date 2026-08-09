import * as adk from "admdongkor";

export const dynamic = "force-dynamic";

const BOUNDARY_VERSION = "20260701";
type BoundaryLevel = "sido" | "sgg" | "emd";

function validLevel(value: string | null): value is BoundaryLevel {
  return value === "sido" || value === "sgg" || value === "emd";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  const code = (params.get("code") || "").replace(/\D/g, "");
  if (!validLevel(level)) return Response.json({ error: "경계 단계가 올바르지 않습니다." }, { status: 400 });
  if (level === "sgg" && code.length !== 2) return Response.json({ error: "시·도 코드가 필요합니다." }, { status: 400 });
  if (level === "emd" && code.length !== 5) return Response.json({ error: "시·군·구 코드가 필요합니다." }, { status: 400 });

  try {
    const collection = await adk.get(BOUNDARY_VERSION, level);
    const features = collection.features.flatMap((feature) => {
      const properties = feature.properties as Record<string, unknown>;
      const sidoCode = String(properties.sidocd || "");
      const sigunguCode = String(properties.sggcd || "");
      if (level === "sgg" && sidoCode !== code) return [];
      if (level === "emd" && sigunguCode !== code) return [];
      const name = String(level === "sido" ? properties.sidonm : level === "sgg" ? properties.sggnm : properties.emdnm || "");
      const boundaryCode = String(level === "sido" ? properties.sidocd : level === "sgg" ? properties.sggcd : properties.emdcd || properties.emd8 || "");
      return [{ type: "Feature" as const, properties: { code: boundaryCode, name, sidoCode, sidoName: String(properties.sidonm || ""), sigunguCode, sigunguName: String(properties.sggnm || "") }, geometry: feature.geometry }];
    });
    return Response.json({ type: "FeatureCollection", features, source: "SGIS · vuski/admdongkor", version: BOUNDARY_VERSION }, { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=7776000" } });
  } catch {
    return Response.json({ error: "전국 행정경계를 불러오지 못했습니다." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
