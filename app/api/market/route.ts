export const dynamic = "force-dynamic";

const API_URL = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";
const TABLE_ID = "T244183132827305";
const DEFAULT_REGION = "50001";

type RebRow = {
  CLS_ID: number;
  CLS_NM: string;
  CLS_FULLNM: string;
  DTA_VAL: number;
  WRTTIME_DESC: string;
  WRTTIME_IDTFR_ID: string;
};

function apiKey() {
  const key = process.env.REB_API_KEY;
  if (!key) throw new Error("한국부동산원 API 키가 설정되지 않았습니다.");
  return key;
}

function isRebRow(value: unknown): value is RebRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<RebRow>;
  return Number.isFinite(Number(row.CLS_ID)) && typeof row.CLS_NM === "string" && typeof row.CLS_FULLNM === "string" && Number.isFinite(Number(row.DTA_VAL)) && typeof row.WRTTIME_DESC === "string" && typeof row.WRTTIME_IDTFR_ID === "string";
}

async function fetchRows(params: Record<string, string>): Promise<RebRow[]> {
  const url = new URL(API_URL);
  Object.entries({ KEY: apiKey(), Type: "json", pIndex: "1", pSize: "1000", STATBL_ID: TABLE_ID, DTACYCLE_CD: "WK", ...params }).forEach(([key, value]) => url.searchParams.set(key, value));
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  } catch (error) {
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    throw new Error(timedOut ? "한국부동산원 API 응답 시간이 초과되었습니다." : "한국부동산원 API에 연결하지 못했습니다.");
  }
  if (!response.ok) throw new Error(`한국부동산원 API 응답 오류 (${response.status})`);
  const text = await response.text();
  if (!text.trim()) throw new Error("한국부동산원 API가 빈 응답을 반환했습니다.");
  let payload: { SttsApiTblData?: Array<{ head?: unknown; row?: unknown[] }> };
  try { payload = JSON.parse(text) as typeof payload; } catch { throw new Error("한국부동산원 API 응답이 JSON 형식이 아닙니다."); }
  const rawRows = payload.SttsApiTblData?.find((entry) => Array.isArray(entry.row))?.row;
  if (!rawRows) throw new Error("한국부동산원 API 응답 스키마가 예상과 다릅니다.");
  if (!rawRows.every(isRebRow)) throw new Error("한국부동산원 API 행 데이터에 필수 필드가 없습니다.");
  return rawRows.map((row) => ({ ...row, CLS_ID: Number(row.CLS_ID), DTA_VAL: Number(row.DTA_VAL) })).sort((a, b) => a.WRTTIME_IDTFR_ID.localeCompare(b.WRTTIME_IDTFR_ID));
}

function response(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    if (mode === "regions") {
      const national = await fetchRows({ CLS_ID: DEFAULT_REGION });
      const latestId = national.at(-1)?.WRTTIME_IDTFR_ID;
      const previousId = national.at(-2)?.WRTTIME_IDTFR_ID;
      if (!latestId || !previousId) throw new Error("한국부동산원 비교 기간을 찾을 수 없습니다.");
      const [latest, previous] = await Promise.all([fetchRows({ WRTTIME_IDTFR_ID: latestId }), fetchRows({ WRTTIME_IDTFR_ID: previousId })]);
      const previousMap = new Map(previous.map((row) => [String(row.CLS_ID), Number(row.DTA_VAL)]));
      const regions = latest.map((row) => {
        const prior = previousMap.get(String(row.CLS_ID));
        const value = Number(row.DTA_VAL);
        const changePct = prior && value ? ((value / prior) - 1) * 100 : null;
        return { id: String(row.CLS_ID), name: row.CLS_NM, fullName: row.CLS_FULLNM, value, change: changePct ?? 0, changePct };
      });
      return response({ regions, asOf: latest[0]?.WRTTIME_DESC, source: "한국부동산원 R-ONE" });
    }

    const regionId = (searchParams.get("region") || DEFAULT_REGION).replace(/[^0-9]/g, "");
    const rows = await fetchRows({ CLS_ID: regionId });
    const series = rows.map((row) => ({ period: row.WRTTIME_IDTFR_ID, date: row.WRTTIME_DESC, value: Number(row.DTA_VAL) }));
    const last = rows.at(-1);
    if (!last) return Response.json({ error: "지역 데이터를 찾을 수 없습니다." }, { status: 404 });
    return response({
      region: { id: String(last.CLS_ID), name: last.CLS_NM, fullName: last.CLS_FULLNM },
      series,
      base: "확인 필요",
      baseValue: null,
      baseStatus: "원본 통계표 기준시점 확인 필요",
      source: "한국부동산원 전국주택가격동향조사",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "시장 데이터를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: /시간이 초과/.test(message) ? 504 : 502 });
  }
}
