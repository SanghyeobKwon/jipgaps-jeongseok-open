"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import regions from "./data/regions.json";

type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";
type Region = { code: string; sido: string; sigungu: string };
type Trade = { id: string; date: string; amount: number; area: number; floor: number | null; name: string; propertyKey: string; dong: string; buildingDong: string; jibun: string; buildYear: number | null; dealingType: string; cancelled: boolean };
type Property = { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; areas: number[] };
type ChartPoint = { month: string; price: number; average: number; volume: number };
type OverviewMarket = { short: string; sido: string; code: string; count: number; median: number; change: number };
type PolicyItem = { date: string; tone: string; label: string; scope: string; title: string; summary: string; url: string };
type SavedHome = { id: string; name: string; region: string; area: number; price: number; score: number; savedAt: string };

const SIDO_ORDER = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];
const SEOUL_PRIORITY = ["강남구", "서초구", "송파구", "용산구", "성동구", "마포구", "영등포구", "강동구", "양천구", "광진구", "동작구", "종로구", "중구", "서대문구", "강서구", "관악구", "동대문구", "성북구", "은평구", "노원구", "구로구", "금천구", "중랑구", "도봉구", "강북구"];
function normalizeRegion(region: Region): Region {
  let sigungu = region.sigungu.replace(/^서울시/, "");
  if (region.code.startsWith("4128") && !sigungu.startsWith("고양시")) sigungu = `고양시 ${sigungu}`;
  if (region.code.startsWith("4146") && !sigungu.startsWith("용인시")) sigungu = `용인시 ${sigungu}`;
  sigungu = sigungu.replace(/시(?=[가-힣]+구$)/, "시 ");
  return { ...region, sido: region.sido === "전라북도" ? "전북특별자치도" : region.sido, sigungu };
}
const REGIONS = (regions as Region[]).map(normalizeRegion);
function sortRegions(a: Region, b: Region) { if (a.sido === "서울특별시" && b.sido === "서울특별시") return SEOUL_PRIORITY.indexOf(a.sigungu) - SEOUL_PRIORITY.indexOf(b.sigungu); return Number(a.code) - Number(b.code); }
function areaBucket(area: number) { return area > 0 ? Math.round(area / 3.3058) : 0; }
function dongLabel(value: string) { return value ? (value.endsWith("동") ? value : `${value}동`) : ""; }

const PROPERTY_TYPES: { key: PropertyType; label: string }[] = [
  { key: "apt", label: "아파트" }, { key: "rowhouse", label: "연립·다세대" },
  { key: "house", label: "단독·다가구" }, { key: "officetel", label: "오피스텔" },
  { key: "commercial", label: "상가·업무" }, { key: "factory", label: "공장·창고" },
];
const PERIODS = [{ label: "3개월", value: 3 }, { label: "6개월", value: 6 }, { label: "1년", value: 12 }, { label: "3년", value: 36 }, { label: "5년", value: 60 }];
const NAV_ITEMS = [{ id: "national", label: "살 집 찾기" }, { id: "market", label: "월간 시장" }, { id: "chart", label: "상세 차트" }, { id: "map", label: "전국 지도" }, { id: "transactions", label: "거래 내역" }, { id: "policy", label: "정책 레이더" }];
const MAP_POSITIONS: Record<string, [number, number]> = { 서울: [29, 20], 부산: [65, 66], 대구: [56, 53], 인천: [20, 21], 광주: [29, 63], 대전: [42, 43], 울산: [70, 54], 세종: [34, 36], 경기: [36, 25], 강원: [58, 12], 충북: [45, 33], 충남: [27, 41], 전북: [31, 52], 전남: [25, 73], 경북: [67, 34], 경남: [50, 64], 제주: [25, 93] };
const KOREA_BOUNDARY_SVG = "https://raw.githubusercontent.com/statgarten/maps/main/svg/simple/%EC%A0%84%EA%B5%AD_%EC%8B%9C%EB%8F%84_%EA%B2%BD%EA%B3%84.svg";
const QUICK_REGIONS = [{ code: "11680", label: "강남구" }, { code: "11650", label: "서초구" }, { code: "11710", label: "송파구" }, { code: "11200", label: "성동구" }, { code: "41135", label: "분당구" }, { code: "26350", label: "해운대구" }];
const POLICIES = [
  { date: "2026.07.20", tone: "positive", label: "호재", scope: "비아파트·임대", title: "비아파트 공급 보완조치 전면 시행", summary: "토지 확보 지원금 상향과 PF 보증 강화로 오피스텔·도시형생활주택 공급 사업의 초기 자금 부담이 완화됩니다.", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148968416" },
  { date: "2026.07.15", tone: "negative", label: "악재", scope: "분양·신축", title: "기본형건축비 0.77% 인상", summary: "공사비 상승분이 분양가에 반영될 가능성이 있어 신규 주택 구매자의 가격 부담에는 부정적으로 해석됩니다.", url: "https://www.molit.go.kr/portal.do" },
  { date: "2026.05.12", tone: "neutral", label: "중립", scope: "토지거래허가", title: "세입자 있는 주택 실거주 유예 확대", summary: "임대 중 주택의 매도 편의는 개선되지만 갭투자 제한 원칙은 유지돼 수요·공급 양쪽 효과가 혼재합니다.", url: "https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95091995" },
  { date: "2026 업무계획", tone: "positive", label: "호재", scope: "주거복지·공급", title: "공적 임대주택 최소 15.2만호 공급", summary: "공공임대 14만호와 공공지원 민간임대 1.2만호 공급 계획으로 무주택 실수요자의 선택지가 확대됩니다.", url: "https://www.molit.go.kr/2026plan/251212%28%EC%9E%90%EB%A3%8C%29_%EA%B5%AD%ED%86%A0%EA%B5%90%ED%86%B5%EB%B6%80_%EC%97%85%EB%AC%B4%EB%B3%B4%EA%B3%A0_%EC%84%9C%EB%A9%B4%EC%9E%90%EB%A3%8C.pdf" },
];

function formatPrice(value: number) {
  if (!value) return "-";
  const eok = Math.floor(value / 10000); const man = Math.round(value % 10000);
  return `${eok ? `${eok}억` : ""}${man ? ` ${man.toLocaleString()}만원` : ""}`.trim();
}
function compactPrice(value: number) { return value >= 10000 ? `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}억` : `${Math.round(value / 1000)}천`; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function monthLabel(value: string) { const [year, month] = value.split("-"); return `${year.slice(2)}.${month}`; }
function shiftMonth(value: string, offset: number) { if (!value) return ""; const [year, month] = value.split("-").map(Number); const date = new Date(year, month - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

function PriceChart({ points, unit }: { points: ChartPoint[]; unit: "price" | "py" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; const host = canvas?.parentElement;
    if (!canvas || !host || !points.length) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1; const width = host.clientWidth; const height = host.clientHeight;
      canvas.width = width * ratio; canvas.height = height * ratio; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const pad = { left: 15, right: 72, top: 22, bottom: 30 }; const volumeH = 64; const gap = 18;
      const chartBottom = height - pad.bottom - volumeH - gap; const plotW = width - pad.left - pad.right; const plotH = chartBottom - pad.top;
      const all = points.flatMap((point) => [point.price, point.average]).filter(Boolean); const rawMin = Math.min(...all); const rawMax = Math.max(...all);
      const margin = Math.max((rawMax - rawMin) * .18, rawMax * .035, 1); const min = rawMin - margin; const max = rawMax + margin;
      const xAt = (index: number) => points.length === 1 ? pad.left + plotW / 2 : pad.left + plotW * index / (points.length - 1);
      const yAt = (value: number) => pad.top + (max - value) / (max - min) * plotH;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) { const y = pad.top + plotH * i / 4; ctx.strokeStyle = "#263142"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.fillStyle = "#7f8b9c"; ctx.fillText(compactPrice(max - (max - min) * i / 4), width - pad.right + 10, y + 4); }
      const labelStep = Math.max(1, Math.ceil(points.length / 7));
      points.forEach((point, index) => { if (index % labelStep === 0 || index === points.length - 1) { const x = xAt(index); ctx.strokeStyle = "#202b3a"; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.fillStyle = "#697589"; ctx.textAlign = "center"; ctx.fillText(monthLabel(point.month), x, height - 8); } });
      const maxVolume = Math.max(...points.map((point) => point.volume), 1); const barW = Math.max(3, Math.min(18, plotW / points.length * .58));
      points.forEach((point, index) => { const x = xAt(index); const h = point.volume / maxVolume * volumeH; ctx.fillStyle = index && point.price < points[index - 1].price ? "#27678a" : "#5b3c3f"; ctx.fillRect(x - barW / 2, height - pad.bottom - h, barW, h); });
      const renderLine = (field: "price" | "average", color: string, widthLine: number) => { ctx.beginPath(); points.forEach((point, index) => { const x = xAt(index); const y = yAt(point[field]); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); };
      renderLine("average", "#7a8ba6", 1.5); renderLine("price", "#ff7452", 2.3);
      const active = hover ?? points.length - 1; const point = points[active]; const x = xAt(active); const y = yAt(point.price);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "#9aa8ba88"; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#ff7452"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#101722"; ctx.lineWidth = 2; ctx.stroke();
      const tag = compactPrice(point.price); ctx.fillStyle = "#ff7452"; ctx.fillRect(width - pad.right + 4, y - 11, 64, 22); ctx.fillStyle = "#fff"; ctx.font = "700 11px ui-monospace"; ctx.textAlign = "center"; ctx.fillText(tag, width - pad.right + 36, y + 4);
      const boxW = 166; const boxX = Math.min(width - pad.right - boxW - 8, Math.max(pad.left + 8, x + (x > width / 2 ? -boxW - 14 : 14))); const boxY = pad.top + 8;
      ctx.fillStyle = "#182231ee"; ctx.strokeStyle = "#344156"; ctx.lineWidth = 1; ctx.fillRect(boxX, boxY, boxW, 66); ctx.strokeRect(boxX, boxY, boxW, 66);
      ctx.textAlign = "left"; ctx.fillStyle = "#8c99aa"; ctx.font = "10px sans-serif"; ctx.fillText(`${point.month} · 거래 ${point.volume}건`, boxX + 11, boxY + 17); ctx.fillStyle = "#fff"; ctx.font = "700 13px sans-serif"; ctx.fillText(formatPrice(point.price), boxX + 11, boxY + 38); ctx.fillStyle = "#8493a8"; ctx.font = "10px sans-serif"; ctx.fillText(`3개월 이동평균 ${formatPrice(point.average)}`, boxX + 11, boxY + 56);
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(host); return () => observer.disconnect();
  }, [points, hover, unit]);

  return <canvas ref={canvasRef} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const plotWidth = rect.width - 87; const index = Math.round(((event.clientX - rect.left - 15) / plotWidth) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, index))); }} onPointerLeave={() => setHover(null)} aria-label="월별 실거래 중위가격과 거래량 차트" />;
}

export default function Home() {
  const navRef = useRef<HTMLElement>(null);
  const [type, setType] = useState<PropertyType>("apt"); const [period, setPeriod] = useState(12); const [regionCode, setRegionCode] = useState("11680");
  const [regionInput, setRegionInput] = useState("서울특별시 강남구"); const [query, setQuery] = useState(""); const [submittedQuery, setSubmittedQuery] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]); const [properties, setProperties] = useState<Property[]>([]); const [selectedKey, setSelectedKey] = useState("");
  const [selectedDong, setSelectedDong] = useState("all"); const [selectedBuildingDong, setSelectedBuildingDong] = useState(""); const [selectedAreaBucket, setSelectedAreaBucket] = useState<number | null>(null); const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [area, setArea] = useState("all"); const [unit, setUnit] = useState<"price" | "py">("price"); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [markets, setMarkets] = useState<OverviewMarket[]>([]); const [marketMonth, setMarketMonth] = useState("");
  const [buildingSort, setBuildingSort] = useState<"volume" | "price" | "rise" | "fall">("volume"); const [minVolume, setMinVolume] = useState(0); const [marketSort, setMarketSort] = useState<"volume" | "price" | "rise" | "fall">("volume");
  const [policyItems, setPolicyItems] = useState<readonly PolicyItem[]>(POLICIES); const [policyUpdated, setPolicyUpdated] = useState("");
  const [activeSection, setActiveSection] = useState("national"); const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0 });
  const [selectedMapSido, setSelectedMapSido] = useState("서울특별시");
  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([]);
  const activeRegion = REGIONS.find((item) => item.code === regionCode) || REGIONS[0];

  useEffect(() => { const timer = window.setTimeout(() => { try { const stored = window.localStorage.getItem("jipgaps:saved-homes"); if (stored) setSavedHomes(JSON.parse(stored)); } catch { /* device storage is optional */ } }, 0); return () => window.clearTimeout(timer); }, []);

  useEffect(() => {
    const updateSection = () => {
      const marker = window.scrollY + 125; let current = NAV_ITEMS[0].id;
      NAV_ITEMS.forEach((item) => { const section = document.getElementById(item.id); if (section && section.offsetTop <= marker) current = item.id; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 20) current = NAV_ITEMS.at(-1)?.id || current;
      setActiveSection(current);
    };
    updateSection(); window.addEventListener("scroll", updateSection, { passive: true }); window.addEventListener("resize", updateSection);
    return () => { window.removeEventListener("scroll", updateSection); window.removeEventListener("resize", updateSection); };
  }, []);

  useEffect(() => {
    const nav = navRef.current; const link = nav?.querySelector<HTMLAnchorElement>(`a[href="#${activeSection}"]`); if (!nav || !link) return;
    const updateIndicator = () => setNavIndicator({ left: link.offsetLeft, width: link.offsetWidth });
    updateIndicator(); const observer = new ResizeObserver(updateIndicator); observer.observe(nav); return () => observer.disconnect();
  }, [activeSection]);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all");
    const params = new URLSearchParams({ type, lawd: regionCode, months: String(Math.max(period, 6)), query: submittedQuery });
    fetch(`/api/trades?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "실거래가를 불러오지 못했습니다."); return data; }).then((data) => { setTrades(data.trades); setProperties(data.properties); if (data.properties.length === 1) setSelectedKey(data.properties[0].key); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, regionCode, period, submittedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { fetch(`/api/overview?type=${type}&basis=quarter-v2`, { signal: controller.signal }).then((response) => response.json()).then((data) => { if (data.markets) { setMarkets(data.markets); setMarketMonth(data.month); } }).catch(() => undefined); }, 3000);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [type]);

  useEffect(() => {
    const controller = new AbortController(); fetch("/api/policies", { signal: controller.signal }).then((response) => response.json()).then((data) => { if (data.policies?.length) { setPolicyItems(data.policies); setPolicyUpdated(data.updatedAt); } }).catch(() => undefined); return () => controller.abort();
  }, []);

  const scopedTrades = useMemo(() => selectedDong === "all" ? trades : trades.filter((trade) => trade.dong === selectedDong), [trades, selectedDong]);
  const propertyTrades = useMemo(() => selectedKey ? scopedTrades.filter((trade) => trade.propertyKey === selectedKey && (!selectedBuildingDong || trade.buildingDong === selectedBuildingDong) && (selectedAreaBucket === null || areaBucket(trade.area) === selectedAreaBucket)) : scopedTrades, [scopedTrades, selectedKey, selectedBuildingDong, selectedAreaBucket]);
  const areas = useMemo(() => [...new Set(propertyTrades.map((trade) => Math.round(trade.area * 10) / 10).filter(Boolean))].sort((a, b) => a - b), [propertyTrades]);
  const filteredTrades = useMemo(() => propertyTrades.filter((trade) => area === "all" || Math.abs(trade.area - Number(area)) < .15), [propertyTrades, area]);
  const chartPoints = useMemo(() => {
    const grouped = new Map<string, number[]>(); filteredTrades.forEach((trade) => { const month = trade.date.slice(0, 7); const value = unit === "py" && trade.area ? trade.amount / (trade.area / 3.3058) : trade.amount; grouped.set(month, [...(grouped.get(month) || []), value]); });
    const base = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, price: median(values), volume: values.length }));
    return base.map((point, index) => ({ ...point, average: median(base.slice(Math.max(0, index - 2), index + 1).map((item) => item.price)) })).slice(-period);
  }, [filteredTrades, unit, period]);
  const latest = chartPoints.at(-1)?.price || 0; const previous = chartPoints.at(-2)?.price || latest; const chartChangeComparable = (chartPoints.at(-1)?.volume || 0) >= 2 && (chartPoints.at(-2)?.volume || 0) >= 2; const change = chartChangeComparable && previous ? (latest / previous - 1) * 100 : 0;
  const high = chartPoints.length ? Math.max(...chartPoints.map((point) => point.price)) : 0; const low = chartPoints.length ? Math.min(...chartPoints.map((point) => point.price)) : 0;
  const latestMonth = scopedTrades.at(-1)?.date.slice(0, 7) || "";
  const latestQuarterMonths = [0, -1, -2].map((offset) => shiftMonth(latestMonth, offset)); const previousQuarterMonths = [-3, -4, -5].map((offset) => shiftMonth(latestMonth, offset));
  const propertyRows = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    scopedTrades.forEach((trade) => { const bucket = areaBucket(trade.area); const key = `${trade.propertyKey}|${trade.buildingDong || "-"}|${bucket}`; groups.set(key, [...(groups.get(key) || []), trade]); });
    return [...groups].map(([key, rows]) => {
      const sample = rows.at(-1)!; const quarterRows = rows.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7))); const previousRows = rows.filter((trade) => previousQuarterMonths.includes(trade.date.slice(0, 7)));
      const quarterValues = quarterRows.map((trade) => trade.amount); const previousValues = previousRows.map((trade) => trade.amount); const current = quarterValues.length ? median(quarterValues) : sample.amount; const before = previousValues.length ? median(previousValues) : 0;
      const comparable = quarterValues.length >= 2 && previousValues.length >= 2; return { key, propertyKey: sample.propertyKey, name: sample.name, dong: sample.dong, jibun: sample.jibun, buildingDong: sample.buildingDong, areaBucket: areaBucket(sample.area), areaMedian: median(rows.map((trade) => trade.area).filter(Boolean)), count: rows.length, current, change: comparable && before ? (current / before - 1) * 100 : null, quarterCount: quarterValues.length };
    }).sort((a, b) => b.quarterCount - a.quarterCount || b.count - a.count);
  }, [scopedTrades, latestQuarterMonths.join("|"), previousQuarterMonths.join("|")]);
  const scoredCandidates = useMemo(() => {
    const areaPeers = new Map<number, number[]>();
    propertyRows.forEach((row) => { if (row.areaMedian > 0) areaPeers.set(row.areaBucket, [...(areaPeers.get(row.areaBucket) || []), row.current / (row.areaMedian / 3.3058)]); });
    return propertyRows.map((row) => {
      const perPy = row.areaMedian ? row.current / (row.areaMedian / 3.3058) : 0; const peer = median(areaPeers.get(row.areaBucket) || []); const gap = peer ? (perPy / peer - 1) * 100 : 0;
      const valueScore = Math.max(0, Math.min(100, 55 - gap * 2.2)); const liquidityScore = Math.min(100, row.quarterCount * 20); const momentumScore = row.change === null ? 45 : Math.max(0, Math.min(100, 50 + row.change * 1.6));
      const score = Math.round(valueScore * .45 + liquidityScore * .35 + momentumScore * .2); const tag = gap <= -5 ? "가격 매력" : row.quarterCount >= 4 ? "거래 활발" : row.change !== null && row.change > 3 ? "상승 흐름" : "관심 후보";
      return { ...row, score, gap, tag };
    }).filter((row) => row.quarterCount > 0).sort((a, b) => b.score - a.score || b.quarterCount - a.quarterCount);
  }, [propertyRows]);
  const selectedProperty = properties.find((property) => property.key === selectedKey); const selectedVariant = propertyRows.find((property) => property.key === selectedVariantKey); const variantSuffix = selectedVariant ? `${dongLabel(selectedVariant.buildingDong)}${selectedVariant.buildingDong ? " · " : ""}전용 ${selectedVariant.areaBucket}평` : ""; const displayName = selectedProperty ? `${selectedProperty.name}${variantSuffix ? ` · ${variantSuffix}` : ""}` : (submittedQuery ? `${submittedQuery} 검색 결과` : `${activeRegion.sigungu} 전체`);
  const latestMonthTrades = scopedTrades.filter((trade) => trade.date.startsWith(latestMonth)); const latestQuarterTrades = scopedTrades.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7)));
  const risingCount = propertyRows.filter((property) => property.change !== null && property.change > 0).length; const fallingCount = propertyRows.filter((property) => property.change !== null && property.change < 0).length;
  const visibleProperties = useMemo(() => propertyRows.filter((property) => property.quarterCount >= minVolume).sort((a, b) => buildingSort === "price" ? b.current - a.current : buildingSort === "rise" ? (b.change ?? -Infinity) - (a.change ?? -Infinity) : buildingSort === "fall" ? (a.change ?? Infinity) - (b.change ?? Infinity) : b.quarterCount - a.quarterCount), [propertyRows, buildingSort, minVolume]);
  const sortedMarkets = useMemo(() => [...markets].sort((a, b) => marketSort === "price" ? b.median - a.median : marketSort === "rise" ? b.change - a.change : marketSort === "fall" ? a.change - b.change : b.count - a.count), [markets, marketSort]);
  const nationalDeals = markets.reduce((sum, market) => sum + market.count, 0); const activeMarkets = markets.filter((market) => market.median > 0); const nationalMedian = activeMarkets.length ? median(activeMarkets.map((market) => market.median)) : 0; const nationalChange = nationalDeals ? markets.reduce((sum, market) => sum + market.change * market.count, 0) / nationalDeals : 0;
  const sidoOptions = useMemo(() => SIDO_ORDER.filter((sido) => REGIONS.some((region) => region.sido === sido)), []);
  const sigunguOptions = useMemo(() => REGIONS.filter((region) => region.sido === activeRegion.sido).sort(sortRegions), [activeRegion.sido]);
  const mapDistricts = useMemo(() => REGIONS.filter((region) => region.sido === selectedMapSido).sort(sortRegions), [selectedMapSido]);
  const dongOptions = useMemo(() => [...new Set(trades.map((trade) => trade.dong).filter(Boolean))].sort(), [trades]);
  const targetTrade = filteredTrades.at(-1); const targetArea = area === "all" ? targetTrade?.area || 0 : Number(area);
  const subjectPerPy = filteredTrades.filter((trade) => trade.area > 0 && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15)).slice(-20).map((trade) => trade.amount / (trade.area / 3.3058));
  const latestPeers = scopedTrades.filter((trade) => trade.propertyKey !== selectedKey && trade.area > 0 && trade.date.startsWith(latestMonth) && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15));
  const fallbackPeers = scopedTrades.filter((trade) => trade.propertyKey !== selectedKey && trade.area > 0 && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15));
  const peerRows = latestPeers.length >= 5 ? latestPeers : fallbackPeers.slice(-200); const peerPerPy = peerRows.map((trade) => trade.amount / (trade.area / 3.3058));
  const subjectPyeongPrice = subjectPerPy.length ? median(subjectPerPy) : 0; const peerPyeongPrice = peerPerPy.length ? median(peerPerPy) : 0; const valuationGap = peerPyeongPrice ? (subjectPyeongPrice / peerPyeongPrice - 1) * 100 : 0;
  const fairPrice = targetArea && peerPyeongPrice ? peerPyeongPrice * (targetArea / 3.3058) : 0; const valuationScore = peerPyeongPrice ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(valuationGap) * 2))) : 0; const valuationLabel = valuationGap <= -5 ? "저평가 구간" : valuationGap >= 5 ? "고평가 구간" : "적정가격 구간";
  const selectedOpportunity = scoredCandidates.find((candidate) => candidate.key === selectedVariantKey); const isSaved = selectedOpportunity ? savedHomes.some((home) => home.id === `${regionCode}|${selectedOpportunity.key}`) : false;
  const chooseRegion = (region: Region) => { setRegionCode(region.code); setRegionInput(`${region.sido} ${region.sigungu}`); setSelectedDong("all"); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setSubmittedQuery(""); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const selectSido = (sido: string) => { const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0]; if (next) chooseRegion(next); };
  const selectSigungu = (code: string) => { const next = REGIONS.find((region) => region.code === code); if (next) chooseRegion(next); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const exactRegion = REGIONS.find((item) => `${item.sido} ${item.sigungu}` === regionInput); if (exactRegion) setRegionCode(exactRegion.code); setSubmittedQuery(query.trim()); };
  const selectCandidate = (candidate: typeof scoredCandidates[number]) => { setSelectedKey(candidate.propertyKey); setSelectedBuildingDong(candidate.buildingDong); setSelectedAreaBucket(candidate.areaBucket); setSelectedVariantKey(candidate.key); setArea("all"); document.getElementById("chart")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const toggleSavedHome = () => { if (!selectedOpportunity) return; const id = `${regionCode}|${selectedOpportunity.key}`; const next = isSaved ? savedHomes.filter((home) => home.id !== id) : [...savedHomes, { id, name: selectedOpportunity.name, region: `${activeRegion.sido} ${activeRegion.sigungu}`, area: selectedOpportunity.areaBucket, price: selectedOpportunity.current, score: selectedOpportunity.score, savedAt: new Date().toISOString() }].slice(-6); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } };

  return <main className="terminal-shell">
    <header className="topbar"><a href="#top" className="brand"><span>집값</span>의 정석 <em>PRO</em></a><nav ref={navRef}>{NAV_ITEMS.map((item) => <a key={item.id} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={() => setActiveSection(item.id)}>{item.label}</a>)}<i className="nav-indicator" style={{ left: navIndicator.left, width: navIndicator.width }} /></nav><a className="saved-badge" href="#chart">관심 후보 <b>{savedHomes.length}</b></a><div className="live"><i /> 실거래 연동</div></header>
    <section className="command" id="top">
      <div className="hero-copy"><div><p>KOREA REAL ESTATE INTELLIGENCE</p><h1>사는 집도, 투자하는 집도<br/><span>숫자로 먼저 고르세요.</span></h1><b>전국 실거래를 분기 단위로 비교하고, 평형별 가격 매력과 거래 흐름까지 한 번에 확인합니다.</b></div><div className="hero-proof"><span><i>01</i>실거래 원문 기반</span><span><i>02</i>동·평형 단위 비교</span><span><i>03</i>판단 근거 공개</span></div></div>
      <div className="finder-panel"><div className="finder-title"><div><span>어디를 보고 계세요?</span><b>지역과 주택 유형을 고르면 매수 후보를 바로 추립니다.</b></div><small>최근 3개월 기준</small></div><div className="type-tabs">{PROPERTY_TYPES.map((item) => <button key={item.key} className={type === item.key ? "active" : ""} onClick={() => { setType(item.key); setSelectedKey(""); setSelectedVariantKey(""); }}>{item.label}</button>)}</div>
      <form className="search-console" onSubmit={submitSearch}>
        <label><span>시·도</span><select value={activeRegion.sido} onChange={(event) => selectSido(event.target.value)} aria-label="시도 선택">{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={regionCode} onChange={(event) => selectSigungu(event.target.value)} aria-label="시군구 선택">{sigunguOptions.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={selectedDong} onChange={(event) => { setSelectedDong(event.target.value); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); }} aria-label="읍면동 선택"><option value="all">전체 읍·면·동</option>{dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}</select></label>
        <label className="property-search"><span>단지·건물명 · 비워두면 전체</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 행당대림, 서울숲리버뷰" aria-label="단지 또는 건물명" /></label>
        <button type="submit">시장 조회 <b>↗</b></button>
      </form>
      <div className="quick-regions"><span>인기 지역</span>{QUICK_REGIONS.map((quick) => <button key={quick.code} onClick={() => { const region = REGIONS.find((item) => item.code === quick.code); if (region) chooseRegion(region); }}>{quick.label}</button>)}</div><div className="scope-note"><span>{activeRegion.sido}</span><b>{activeRegion.sigungu}</b>{selectedDong !== "all" && <><i /><b>{selectedDong}</b></>}<i /> 선택 지역의 단지·동·평형을 같은 조건끼리 비교합니다.</div></div>
    </section>

    <section className="national-overview" id="national"><div><p>NATIONAL BUYING TEMPERATURE</p><h1>전국 3개월 온도판</h1><span>대표 권역의 최근 완료월과 3개월 전 가격 방향을 비교합니다.</span></div><article><span>최근 완료월 표본 거래</span><strong>{markets.length ? nationalDeals.toLocaleString() : "집계 중"}{markets.length > 0 && <em>건</em>}</strong><small>{marketMonth || "공공데이터 확인 중"} 대표 권역</small></article><article><span>전국 중위가격</span><strong>{markets.length ? formatPrice(nationalMedian) : "-"}</strong><small>17개 대표 권역 중위값</small></article><article><span>3개월 전 대비</span><strong className={markets.length ? nationalChange >= 0 ? "up" : "down" : ""}>{markets.length ? `${nationalChange >= 0 ? "+" : ""}${nationalChange.toFixed(2)}%` : "-"}</strong><small>거래량 가중 변화율</small></article><a href="#map">전국 기회 찾기 ↓</a></section>

    <section className="monthly-board" id="market">
      <div className="month-intro"><p>QUARTERLY MARKET BRIEF</p><h1>{activeRegion.sigungu} 최근 3개월</h1><span>{PROPERTY_TYPES.find((item) => item.key === type)?.label} 실거래 신고 기준 · {latestQuarterMonths[2] || "-"} ~ {latestQuarterMonths[0] || "-"}</span></div>
      <article><span>분기 거래</span><strong>{latestQuarterTrades.length.toLocaleString()}<em>건</em></strong><small>전체 {trades.length.toLocaleString()}건 조회</small></article>
      <article><span>거래 건물</span><strong>{new Set(latestQuarterTrades.map((trade) => trade.propertyKey)).size.toLocaleString()}<em>곳</em></strong><small>최근 3개월 거래 건물</small></article>
      <article><span>상승 / 하락</span><strong className="split"><b>{risingCount}</b><i>/</i><em>{fallingCount}</em></strong><small>최근 3개월과 직전 3개월 비교</small></article>
      <article><span>분기 중위가격</span><strong>{formatPrice(median(latestQuarterTrades.map((trade) => trade.amount)))}</strong><small>고가·저가 왜곡을 줄인 값</small></article>
    </section>

    <section className="opportunity-section" aria-label="매수 검토 후보"><div className="opportunity-head"><div><p>SMART SHORTLIST</p><h2>{activeRegion.sigungu}에서 먼저 볼 후보</h2><span>평형별 가격 매력 45% · 거래량 35% · 가격 흐름 20%를 합산한 탐색 점수입니다.</span></div><b>추천이 아닌 검토 우선순위</b></div><div className="opportunity-grid">{loading ? <div className="opportunity-empty">후보를 계산하고 있습니다…</div> : scoredCandidates.length ? scoredCandidates.slice(0, 3).map((candidate, index) => <button key={candidate.key} onClick={() => selectCandidate(candidate)}><span className="candidate-rank">0{index + 1}</span><div><em>{candidate.tag}</em><h3>{candidate.name}</h3><p>{candidate.dong} · {dongLabel(candidate.buildingDong) || "동 정보 없음"} · 전용 {candidate.areaBucket}평</p></div><strong>{candidate.score}<small>/100</small><i>{formatPrice(candidate.current)}</i></strong></button>) : <div className="opportunity-empty"><b>이 지역은 아직 표본이 부족합니다.</b><span>아파트 또는 인기 지역을 선택하면 거래가 있는 후보를 빠르게 확인할 수 있습니다.</span></div>}</div>{savedHomes.length > 0 && <div className="saved-shelf"><span>내 관심 후보</span>{savedHomes.map((home) => <article key={home.id}><div><b>{home.name}</b><small>{home.region} · {home.area}평</small></div><strong>{home.score}점 · {formatPrice(home.price)}</strong><button aria-label={`${home.name} 관심 후보에서 삭제`} onClick={() => { const next = savedHomes.filter((item) => item.id !== home.id); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch {} }}>×</button></article>)}</div>}</section>

    <section className="market-browser" id="chart">
      <aside className="watchlist">
        <div className="watch-head"><div><p>AREA-SPECIFIC WATCHLIST</p><h2>{activeRegion.sigungu} 동·평형별 3개월 순위</h2></div><span>{visibleProperties.length}/{propertyRows.length}</span></div>
        <div className="watch-filters"><select value={buildingSort} onChange={(event) => setBuildingSort(event.target.value as typeof buildingSort)} aria-label="건물 목록 정렬"><option value="volume">3개월 거래량순</option><option value="price">3개월 중위가순</option><option value="rise">직전 분기 대비 상승순</option><option value="fall">직전 분기 대비 하락순</option></select><select value={minVolume} onChange={(event) => setMinVolume(Number(event.target.value))} aria-label="최소 거래량"><option value="0">거래량 전체</option><option value="1">3개월 1건 이상</option><option value="3">3개월 3건 이상</option><option value="5">3개월 5건 이상</option></select></div>
        <div className="watch-columns"><span>건물 / 단지</span><span>최근가</span></div>
        {loading ? <div className="watch-state">전체 실거래 목록을 불러오는 중…</div> : error ? <div className="watch-state error">{error}</div> : visibleProperties.length ? <div className="watch-scroll">{visibleProperties.map((property, index) => <button key={property.key} className={selectedVariantKey === property.key ? "selected" : ""} onClick={() => { setSelectedKey(property.propertyKey); setSelectedBuildingDong(property.buildingDong); setSelectedAreaBucket(property.areaBucket); setSelectedVariantKey(property.key); setArea("all"); }}>
          <i className={`building-icon tone-${index % 5}`}>{property.name.slice(0, 1)}</i><div><b>{property.name}</b><small>{property.dong} · {dongLabel(property.buildingDong) || "동 정보 없음"} · 전용 {property.areaBucket}평 ({property.areaMedian.toFixed(1)}㎡)</small></div><strong>{formatPrice(property.current)}{property.change === null ? <em className="sample-low">표본 부족 · 3개월 {property.quarterCount}건</em> : <em className={property.change >= 0 ? "up" : "down"}>{property.change >= 0 ? "+" : ""}{property.change.toFixed(1)}% · 3개월 {property.quarterCount}건</em>}</strong>
        </button>)}</div> : <div className="watch-state">이 조건의 신고 거래가 없습니다.<button onClick={() => { setQuery(""); setSubmittedQuery(""); }}>전체 목록 보기</button></div>}
      </aside>

      <div className="detail-terminal">
        <div className="ticker-head"><div><p>{PROPERTY_TYPES.find((item) => item.key === type)?.label} / {activeRegion.sido} {activeRegion.sigungu}</p><h1>{displayName}</h1><span>{selectedProperty ? `${selectedProperty.dong} ${selectedProperty.jibun || "주소 일부 비공개"} · 같은 동·전용평형만 비교` : `목록에서 동·평형을 선택하거나 ${activeRegion.sigungu} 전체 흐름을 확인하세요`}</span></div><div className="ticker-price"><strong>{formatPrice(latest)}</strong>{chartChangeComparable ? <em className={change >= 0 ? "up" : "down"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</em> : <em className="sample-low">표본 부족</em>}<small>{unit === "py" ? "만원/평" : "월 중위가격"}</small>{selectedOpportunity && <button className={isSaved ? "saved" : ""} onClick={toggleSavedHome}>{isSaved ? "★ 관심 후보 저장됨" : "☆ 관심 후보에 담기"}</button>}</div></div>
        <div className="chart-toolbar"><div className="period-switch">{PERIODS.map((item) => <button key={item.value} className={period === item.value ? "active" : ""} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div><div className="view-switch"><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="전용면적 선택"><option value="all">전체 면적</option>{areas.map((value) => <option key={value} value={value}>전용 {value}㎡ ({(value / 3.3058).toFixed(1)}평)</option>)}</select><button className={unit === "price" ? "active" : ""} onClick={() => setUnit("price")}>실거래가</button><button className={unit === "py" ? "active" : ""} onClick={() => setUnit("py")}>평당가</button></div></div>
        <article className="chart-card">
          <div className="chart-legend"><span><i className="price-dot" />월 중위가격</span><span><i className="ma-dot" />3개월 이동평균</span><span><i className="volume-dot" />거래량</span><small>마우스를 움직여 월별 상세 확인</small></div>
          <div className="canvas-wrap">{loading ? <div className="state"><i /> 실거래 데이터를 불러오는 중입니다</div> : error ? <div className="state error"><b>데이터 연결 오류</b><span>{error}</span></div> : chartPoints.length ? <PriceChart points={chartPoints} unit={unit} /> : <div className="state"><b>선택 조건의 거래가 없습니다</b><span>왼쪽 목록에서 다른 건물을 선택하거나 전체 면적을 선택하세요.</span></div>}</div>
        </article>
        <div className="stat-strip"><article><span>최근 월 중위가</span><strong>{formatPrice(latest)}</strong></article><article><span>기간 최고 / 최저</span><strong>{compactPrice(high)} <em>/</em> {compactPrice(low)}</strong></article><article><span>실거래 건수</span><strong>{filteredTrades.length.toLocaleString()}<em>건</em></strong></article><article><span>시장 신호</span><strong className={!chartChangeComparable ? "" : change >= 0 ? "up" : "down"}>{!chartChangeComparable ? "표본 부족" : change > 2 ? "매수 우위" : change < -2 ? "조정 구간" : "보합 구간"}</strong></article></div>
        <section className="valuation-panel">
          {selectedKey && targetTrade && peerPyeongPrice ? <>
            <div className="valuation-score"><p>AREA-ADJUSTED VALUE</p><strong>{valuationScore}<em>/100</em></strong><span className={valuationGap <= -5 ? "value-low" : valuationGap >= 5 ? "value-high" : "value-fair"}>{valuationLabel}</span></div>
            <div className="valuation-body">
              <div className="valuation-metrics"><article><span>선택 단지 평당가</span><strong>{formatPrice(subjectPyeongPrice)}<em>/평</em></strong></article><article><span>유사 면적 지역 중위</span><strong>{formatPrice(peerPyeongPrice)}<em>/평</em></strong></article><article><span>추정 적정가격</span><strong>{formatPrice(fairPrice)}</strong><small>{targetArea.toFixed(1)}㎡ · 적정 범위 {formatPrice(fairPrice * .95)}~{formatPrice(fairPrice * 1.05)}</small></article><article><span>지역 대비 가격차</span><strong className={valuationGap <= -5 ? "down" : valuationGap >= 5 ? "up" : ""}>{valuationGap >= 0 ? "+" : ""}{valuationGap.toFixed(1)}%</strong><small>비교 거래 {peerRows.length}건</small></article></div>
              <div className="valuation-gauge"><div><span>저평가</span><span>적정</span><span>고평가</span></div><i style={{ left: `${Math.max(2, Math.min(98, 50 + valuationGap))}%` }} /></div>
              <p>같은 선택 지역에서 전용면적 ±15%인 실거래의 평당가 중위와 비교한 참고 지표입니다. 감정평가나 매수 권유가 아니며 층·향·수리 상태는 반영되지 않습니다.</p>
            </div>
          </> : <div className="valuation-empty"><p>AREA-ADJUSTED VALUE</p><strong>내가 살 집의 가격은 적정할까?</strong><span>왼쪽에서 집 후보를 선택하면 같은 지역의 유사 면적 거래와 비교해 저평가·적정·고평가 구간을 보여드립니다.</span></div>}
        </section>
      </div>
    </section>

    <section className="map-section" id="map">
      <div className="section-title wide"><div><p>KOREA MARKET MAP</p><h2>실제 행정경계 기반 전국 지도</h2><span>{marketMonth ? `${marketMonth.slice(0, 4)}년 ${Number(marketMonth.slice(4))}월 완료 거래` : "전국 집계 중"} · 통계청 SGIS 시·도 경계 위에 3개월 가격 방향 표시</span></div><div className="map-controls"><select value={marketSort} onChange={(event) => setMarketSort(event.target.value as typeof marketSort)} aria-label="전국 시장 정렬"><option value="volume">최근 월 거래량순</option><option value="price">최근 월 중위가순</option><option value="rise">3개월 상승순</option><option value="fall">3개월 하락순</option></select><div className="map-legend"><i className="cold"/>하락 <i className="flat"/>보합 <i className="hot"/>상승</div></div></div>
      <div className="map-layout"><div className="real-korea-map"><img src={KOREA_BOUNDARY_SVG} alt="대한민국 17개 시도 실제 행정구역 경계 지도" loading="lazy" referrerPolicy="no-referrer" />{markets.map((market) => { const position = MAP_POSITIONS[market.short] || [50, 50]; return <button key={market.code} title={`${market.sido} ${market.change >= 0 ? "+" : ""}${market.change.toFixed(2)}% · 세부 지역 보기`} style={{ left: `${position[0]}%`, top: `${position[1]}%` }} className={`map-marker ${market.sido === selectedMapSido ? "selected" : ""} ${market.change > 1 ? "hot" : market.change < -1 ? "cold" : "flat"}`} onClick={() => setSelectedMapSido(market.sido)}><b>{market.short}</b><span>{market.change >= 0 ? "+" : ""}{market.change.toFixed(1)}%</span></button>})}{!markets.length && <div className="map-loading"><i />전국 시장을 집계하는 중…</div>}<div className="map-compass"><i />N</div></div>
        <div className="map-ranking"><h3>전국 3개월 흐름</h3><div className="ranking-labels"><span>순위</span><span>지역</span><span>중위가격</span><span>3개월</span></div>{sortedMarkets.length ? sortedMarkets.map((market, index) => <button key={market.code} onClick={() => setSelectedMapSido(market.sido)}><em>{String(index + 1).padStart(2,"0")}</em><b>{market.sido}<small>{market.count}건</small></b><span>{formatPrice(market.median)}</span><strong className={market.change >= 0 ? "up" : "down"}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</strong></button>) : <div className="ranking-loading">17개 대표 권역의 공공데이터를 확인하고 있습니다.</div>}</div>
      </div>
      <div className="region-drilldown"><div><p>SELECT DISTRICT</p><h3>{selectedMapSido} 세부 지역</h3><span>원하는 지역을 누르면 해당 시·군·구의 단지·평형별 차트로 이동합니다.</span></div><div>{mapDistricts.map((region, index) => <button key={region.code} onClick={() => chooseRegion(region)}><em>{String(index + 1).padStart(2, "0")}</em>{region.sigungu}<span>›</span></button>)}</div></div>
      <p className="map-note">행정경계: 통계청 SGIS 기반 <a href="https://github.com/statgarten/maps" target="_blank" rel="noreferrer">StatGarten Maps</a>(MIT). 색상은 각 시·도의 대표 권역 흐름을 보여주는 온도계이며, 지역 표식을 누른 뒤 세부 시·군·구를 선택하면 단지·평형별 거래로 이동합니다.</p>
    </section>

    <section className="trade-section" id="transactions"><div className="section-title wide"><div><p>RECENT CONTRACTS</p><h2>{displayName} 최근 실거래</h2></div><span>단위: 만원 · 최대 30건 표시</span></div><div className="trade-table"><div className="table-head"><span>계약일</span><span>건물명</span><span>전용면적</span><span>층</span><span>거래금액</span><span>평당가</span></div>{[...filteredTrades].reverse().slice(0, 30).map((trade) => <div className="table-row" key={trade.id}><span>{trade.date.replaceAll("-", ".")}</span><b>{trade.name}</b><span>{trade.area ? `${trade.area.toFixed(1)}㎡` : "-"}</span><span>{trade.floor === null ? "-" : `${trade.floor}층`}</span><strong>{formatPrice(trade.amount)}</strong><span>{trade.area ? `${Math.round(trade.amount / (trade.area / 3.3058)).toLocaleString()}만` : "-"}</span></div>)}</div></section>

    <section className="policy-section" id="policy"><div className="section-title wide"><div><p>POLICY RADAR · 6시간마다 자동 확인</p><h2>부동산 정책 레이더</h2><span>언론 기사가 아닌 국토교통부·정책브리핑 공식 발표만 표시합니다.{policyUpdated ? ` · ${new Date(policyUpdated).toLocaleString("ko-KR")} 확인` : ""}</span></div><a href="https://www.molit.go.kr/portal.do" target="_blank" rel="noreferrer">국토교통부 최신 정책 ↗</a></div><div className="policy-grid">{policyItems.map((policy) => <a key={policy.title} href={policy.url} target="_blank" rel="noreferrer" className={`policy-card ${policy.tone}`}><div><span>{policy.date}</span><em>{policy.scope}</em></div><b><i>{policy.label}</i>{policy.title}</b><p>{policy.summary}</p><small>공식 원문 확인 ↗</small></a>)}</div><p className="policy-method">호재·악재·중립 평가는 실수요자의 선택지, 금융·세금 부담, 공급 확대 여부를 기준으로 한 서비스 자체 해석입니다. 정책 효과는 지역과 보유 상황에 따라 달라질 수 있습니다.</p></section>

    <section className="insight"><div><p>DATA NOTE</p><h2>전국에서 동네로, 동네에서 살 집 후보로 좁혀갑니다.</h2></div><p>첫 화면은 전국 흐름을 비교하는 출발점입니다. 관심 지역을 고른 뒤 실제 거래와 평수 대비 가격을 확인해 내 조건에 맞는 집을 찾아보세요.</p></section>
    <footer><a className="brand" href="#top"><span>집값</span>의 정석</a><p>데이터로 보고, 실제로 살 집을 고르다.</p><span>데이터: 국토교통부 실거래가 공개시스템</span></footer>
  </main>;
}
