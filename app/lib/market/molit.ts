export type RawMolitFields = Record<string, string>;

export type MolitPage = {
  rows: RawMolitFields[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
};

export type MolitCollection = {
  rows: RawMolitFields[];
  totalCount: number;
  fetchedPages: number;
  partial: boolean;
  warnings: string[];
};

export class UpstreamDataError extends Error {
  readonly kind: "timeout" | "http" | "upstream" | "empty" | "schema";
  readonly status?: number;

  constructor(
    message: string,
    kind: "timeout" | "http" | "upstream" | "empty" | "schema",
    status?: number,
  ) {
    super(message);
    this.name = "UpstreamDataError";
    this.kind = kind;
    this.status = status;
  }
}

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

function integer(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseMolitPage(xmlSource: string): MolitPage {
  const xml = xmlSource.replace(/^\uFEFF/, "").trim();
  if (!xml) throw new UpstreamDataError("실거래가 API가 빈 응답을 반환했습니다.", "empty");

  const resultCode = tag(xml, "resultCode") ?? tag(xml, "returnReasonCode");
  const resultMessage = tag(xml, "resultMsg") ?? tag(xml, "returnAuthMsg") ?? tag(xml, "errMsg");
  if (resultCode && !["0", "00", "000", "NORMAL_SERVICE"].includes(resultCode.toUpperCase())) {
    throw new UpstreamDataError(`실거래가 API 오류: ${resultMessage || resultCode}`, "upstream");
  }
  if (/SERVICE_ACCESS_DENIED|PERMISSION_DENIED|SERVICE_KEY_IS_NOT_REGISTERED|LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR/i.test(xml)) {
    throw new UpstreamDataError("실거래가 API 권한 또는 호출 한도를 확인해주세요.", "upstream");
  }
  if (!/<(?:response|OpenAPI_ServiceResponse)\b/i.test(xml)) {
    throw new UpstreamDataError("실거래가 API 응답 형식이 XML 계약과 다릅니다.", "schema");
  }

  const totalCount = integer(tag(xml, "totalCount"));
  const pageNo = integer(tag(xml, "pageNo")) ?? 1;
  const numOfRows = integer(tag(xml, "numOfRows")) ?? 0;
  if (totalCount === null) throw new UpstreamDataError("실거래가 API 응답에 전체 건수가 없습니다.", "schema");

  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  const rows = blocks.map((block) => {
    const fields: RawMolitFields = {};
    const inner = block.replace(/^<item(?:\s[^>]*)?>/i, "").replace(/<\/item>$/i, "");
    for (const match of inner.matchAll(/<([A-Za-z0-9_]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      fields[match[1]] = decodeXml(match[2].trim());
    }
    return fields;
  });
  if (totalCount > 0 && rows.length === 0) {
    throw new UpstreamDataError("실거래가 API 응답 건수와 거래 목록이 일치하지 않습니다.", "schema");
  }
  return { rows, totalCount, pageNo, numOfRows: numOfRows || Math.max(rows.length, 1) };
}

type FetchLike = typeof fetch;

async function fetchPage(url: URL, fetchImpl: FetchLike, timeoutMs: number): Promise<MolitPage> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/xml" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    throw new UpstreamDataError(timedOut ? "실거래가 API 응답 시간이 초과되었습니다." : "실거래가 API에 연결하지 못했습니다.", timedOut ? "timeout" : "upstream");
  }
  if (!response.ok) throw new UpstreamDataError(`실거래가 API 응답 오류 (${response.status})`, "http", response.status);
  return parseMolitPage(await response.text());
}

export async function fetchAllMolitPages(
  baseUrl: URL,
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<MolitCollection> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const firstUrl = new URL(baseUrl);
  firstUrl.searchParams.set("pageNo", "1");
  const first = await fetchPage(firstUrl, fetchImpl, timeoutMs);
  const pageSize = Math.max(first.numOfRows, first.rows.length, 1);
  const pageCount = Math.max(1, Math.ceil(first.totalCount / pageSize));
  const rows = [...first.rows];
  const warnings: string[] = [];
  let fetchedPages = 1;

  for (let start = 2; start <= pageCount; start += 5) {
    const pageNumbers = Array.from({ length: Math.min(5, pageCount - start + 1) }, (_, index) => start + index);
    const settled = await Promise.allSettled(pageNumbers.map(async (pageNo) => {
      const url = new URL(baseUrl);
      url.searchParams.set("pageNo", String(pageNo));
      return { pageNo, page: await fetchPage(url, fetchImpl, timeoutMs) };
    }));
    settled.forEach((result, index) => {
      const pageNo = pageNumbers[index];
      if (result.status === "fulfilled") {
        rows.push(...result.value.page.rows);
        fetchedPages += 1;
      } else {
        warnings.push(`${pageNo}페이지를 수집하지 못했습니다.`);
      }
    });
  }
  return { rows, totalCount: first.totalCount, fetchedPages, partial: warnings.length > 0, warnings };
}
