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
  if (!key) throw new Error("REB API key is not configured");
  return key;
}

async function fetchRows(params: Record<string, string>): Promise<RebRow[]> {
  const url = new URL(API_URL);
  Object.entries({
    KEY: apiKey(),
    Type: "json",
    pIndex: "1",
    pSize: "1000",
    STATBL_ID: TABLE_ID,
    DTACYCLE_CD: "WK",
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`REB API request failed: ${response.status}`);
  const payload = (await response.json()) as {
    SttsApiTblData?: Array<{ head?: unknown; row?: RebRow[] }>;
  };
  const rows = payload.SttsApiTblData?.find((entry) => Array.isArray(entry.row))?.row;
  if (!rows) throw new Error("REB API returned an unexpected response");
  return rows;
}

function response(data: unknown) {
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "regions") {
      const national = await fetchRows({ CLS_ID: DEFAULT_REGION });
      const latestId = national.at(-1)?.WRTTIME_IDTFR_ID;
      const previousId = national.at(-2)?.WRTTIME_IDTFR_ID;
      if (!latestId || !previousId) throw new Error("Latest REB period is unavailable");

      const [latest, previous] = await Promise.all([
        fetchRows({ WRTTIME_IDTFR_ID: latestId }),
        fetchRows({ WRTTIME_IDTFR_ID: previousId }),
      ]);
      const previousMap = new Map(previous.map((row) => [String(row.CLS_ID), Number(row.DTA_VAL)]));
      const regions = latest.map((row) => {
        const prior = previousMap.get(String(row.CLS_ID));
        const value = Number(row.DTA_VAL);
        return {
          id: String(row.CLS_ID),
          name: row.CLS_NM,
          fullName: row.CLS_FULLNM,
          value,
          change: prior ? ((value / prior) - 1) * 100 : 0,
        };
      });
      return response({ regions, asOf: latest[0]?.WRTTIME_DESC, source: "한국부동산원 R-ONE" });
    }

    const regionId = (searchParams.get("region") || DEFAULT_REGION).replace(/[^0-9]/g, "");
    const rows = await fetchRows({ CLS_ID: regionId });
    const series = rows.map((row) => ({
      period: row.WRTTIME_IDTFR_ID,
      date: row.WRTTIME_DESC,
      value: Number(row.DTA_VAL),
    }));
    const last = rows.at(-1);
    if (!last) return Response.json({ error: "지역 데이터를 찾을 수 없습니다." }, { status: 404 });

    return response({
      region: { id: String(last.CLS_ID), name: last.CLS_NM, fullName: last.CLS_FULLNM },
      series,
      base: "2026.07.06=100.0",
      source: "한국부동산원 전국주택가격동향조사",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "시장 데이터를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 502 });
  }
}
