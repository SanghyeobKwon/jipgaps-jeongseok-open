export const dynamic = "force-dynamic";

const API_ROOT = "https://apis.data.go.kr/1613000";
const SERVICES = {
  apt: ["RTMSDataSvcAptTradeDev", "getRTMSDataSvcAptTradeDev"],
  rowhouse: ["RTMSDataSvcRHTrade", "getRTMSDataSvcRHTrade"],
  house: ["RTMSDataSvcSHTrade", "getRTMSDataSvcSHTrade"],
  officetel: ["RTMSDataSvcOffiTrade", "getRTMSDataSvcOffiTrade"],
  commercial: ["RTMSDataSvcNrgTrade", "getRTMSDataSvcNrgTrade"],
  factory: ["RTMSDataSvcInduTrade", "getRTMSDataSvcInduTrade"],
} as const;

type PropertyType = keyof typeof SERVICES;
type RawFields = Record<string, string>;

type Trade = {
  id: string;
  date: string;
  amount: number;
  area: number;
  floor: number | null;
  name: string;
  propertyKey: string;
  dong: string;
  buildingDong: string;
  jibun: string;
  buildYear: number | null;
  propertyType: PropertyType;
  dealingType: string;
  cancelled: boolean;
};

function serviceKey() {
  const value = process.env.MOLIT_SERVICE_KEY;
  if (!value) throw new Error("국토교통부 API 키가 설정되지 않았습니다.");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function parseItems(xml: string): RawFields[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map((block) => {
    const fields: RawFields = {};
    const inner = block.slice("<item>".length, -"</item>".length);
    for (const match of inner.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      fields[match[1]] = decodeXml(match[2].trim());
    }
    return fields;
  });
}

function monthIds(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  }).reverse();
}

async function fetchMonth(type: PropertyType, lawd: string, month: string) {
  const [service, operation] = SERVICES[type];
  const url = new URL(`${API_ROOT}/${service}/${operation}`);
  url.searchParams.set("LAWD_CD", lawd);
  url.searchParams.set("DEAL_YMD", month);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("serviceKey", serviceKey());
  const response = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!response.ok) throw new Error(`실거래가 API 응답 오류 (${response.status})`);
  const xml = await response.text();
  if (/SERVICE_ACCESS_DENIED|PERMISSION_DENIED|SERVICE_KEY_IS_NOT_REGISTERED/.test(xml)) {
    throw new Error("실거래가 API 권한을 확인해주세요.");
  }
  const firstPage = parseItems(xml);
  const totalCount = numeric(xml.match(/<totalCount>(.*?)<\/totalCount>/)?.[1] || String(firstPage.length));
  const pages = Math.min(5, Math.ceil(totalCount / 1000));
  if (pages <= 1) return firstPage;
  const remaining = await Promise.all(Array.from({ length: pages - 1 }, async (_, index) => {
    const nextUrl = new URL(url); nextUrl.searchParams.set("pageNo", String(index + 2));
    const nextResponse = await fetch(nextUrl, { headers: { Accept: "application/xml" } });
    return nextResponse.ok ? parseItems(await nextResponse.text()) : [];
  }));
  return firstPage.concat(...remaining);
}

async function fetchInBatches(type: PropertyType, lawd: string, months: string[]) {
  const rows: RawFields[] = [];
  for (let index = 0; index < months.length; index += 6) {
    const batch = await Promise.all(months.slice(index, index + 6).map((month) => fetchMonth(type, lawd, month)));
    batch.forEach((items) => rows.push(...items));
  }
  return rows;
}

function numeric(value = "") {
  return Number(value.replaceAll(",", "").trim()) || 0;
}

function normalize(row: RawFields, type: PropertyType, index: number): Trade {
  const year = row.dealYear || "";
  const month = String(row.dealMonth || "").padStart(2, "0");
  const day = String(row.dealDay || "").padStart(2, "0");
  const dong = row.umdNm || "";
  const buildingDong = row.aptDong || "";
  const jibun = row.jibun || "";
  const suppliedName = row.aptNm || row.mhouseNm || row.offiNm || "";
  const usage = row.buildingUse || row.buildingType || row.houseType || "건물";
  const name = suppliedName || `${dong} ${jibun} ${usage}`.replace(/\s+/g, " ").trim();
  const area = numeric(row.excluUseAr || row.totalFloorAr || row.buildingAr || row.plottageAr);
  const propertyKey = `${name}|${dong}|${jibun}`;
  return {
    id: `${type}-${year}${month}${day}-${row.sggCd || ""}-${index}-${numeric(row.dealAmount)}`,
    date: `${year}-${month}-${day}`,
    amount: numeric(row.dealAmount),
    area,
    floor: row.floor ? numeric(row.floor) : null,
    name,
    propertyKey,
    dong,
    buildingDong,
    jibun,
    buildYear: row.buildYear ? numeric(row.buildYear) : null,
    propertyType: type,
    dealingType: row.dealingGbn || "",
    cancelled: row.cdealType === "O",
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const requestedType = params.get("type") || "apt";
    if (!(requestedType in SERVICES)) return Response.json({ error: "지원하지 않는 부동산 유형입니다." }, { status: 400 });
    const type = requestedType as PropertyType;
    const lawd = (params.get("lawd") || "11680").replace(/\D/g, "").slice(0, 5);
    if (lawd.length !== 5) return Response.json({ error: "시군구 코드를 확인해주세요." }, { status: 400 });
    const months = Math.min(60, Math.max(3, numeric(params.get("months") || "12")));
    const query = (params.get("query") || "").trim().toLocaleLowerCase("ko");
    const exact = params.get("exact") === "1";

    const rows = await fetchInBatches(type, lawd, monthIds(months));
    let trades = rows.map((row, index) => normalize(row, type, index)).filter((trade) => trade.amount > 0 && trade.date.length === 10 && !trade.cancelled);
    if (query) {
      trades = trades.filter((trade) => {
        const haystack = `${trade.name} ${trade.dong} ${trade.buildingDong} ${trade.jibun}`.toLocaleLowerCase("ko");
        return exact ? trade.propertyKey.toLocaleLowerCase("ko") === query : haystack.includes(query);
      });
    }
    trades.sort((a, b) => a.date.localeCompare(b.date));

    const propertyMap = new Map<string, { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; areas: Set<number> }>();
    for (const trade of trades) {
      const current = propertyMap.get(trade.propertyKey) || { key: trade.propertyKey, name: trade.name, dong: trade.dong, jibun: trade.jibun, count: 0, lastAmount: 0, areas: new Set<number>() };
      current.count += 1;
      current.lastAmount = trade.amount;
      if (trade.area) current.areas.add(Math.round(trade.area * 10) / 10);
      propertyMap.set(trade.propertyKey, current);
    }
    const properties = [...propertyMap.values()]
      .map((property) => ({ ...property, areas: [...property.areas].sort((a, b) => a - b) }))
      .sort((a, b) => b.count - a.count);

    return Response.json({ trades, properties, months, lawd, type, source: "국토교통부 실거래가 공개시스템" }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "실거래가를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 502 });
  }
}
