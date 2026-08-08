"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import regions from "./data/regions.json";

type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";
type Region = { code: string; sido: string; sigungu: string };
type Trade = { id: string; date: string; amount: number; area: number; floor: number | null; name: string; propertyKey: string; dong: string; jibun: string; buildYear: number | null; dealingType: string; cancelled: boolean };
type Property = { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; areas: number[] };
type ChartPoint = { month: string; price: number; average: number; volume: number };
type OverviewMarket = { short: string; sido: string; code: string; count: number; median: number; change: number };

const PROPERTY_TYPES: { key: PropertyType; label: string }[] = [
  { key: "apt", label: "아파트" }, { key: "rowhouse", label: "연립·다세대" },
  { key: "house", label: "단독·다가구" }, { key: "officetel", label: "오피스텔" },
  { key: "commercial", label: "상가·업무" }, { key: "factory", label: "공장·창고" },
];
const PERIODS = [{ label: "3개월", value: 3 }, { label: "6개월", value: 6 }, { label: "1년", value: 12 }, { label: "3년", value: 36 }, { label: "5년", value: 60 }];

function formatPrice(value: number) {
  if (!value) return "-";
  const eok = Math.floor(value / 10000); const man = Math.round(value % 10000);
  return `${eok ? `${eok}억` : ""}${man ? ` ${man.toLocaleString()}만원` : ""}`.trim();
}
function compactPrice(value: number) { return value >= 10000 ? `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}억` : `${Math.round(value / 1000)}천`; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function monthLabel(value: string) { const [year, month] = value.split("-"); return `${year.slice(2)}.${month}`; }

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
      const renderLine = (field: "price" | "average", color: string, widthLine: number) => { ctx.beginPath(); points.forEach((point, index) => { const x = xAt(index); const y = yAt(point[field]); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); };
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
  const [type, setType] = useState<PropertyType>("apt"); const [period, setPeriod] = useState(12); const [regionCode, setRegionCode] = useState("11680");
  const [regionInput, setRegionInput] = useState("서울특별시 강남구"); const [query, setQuery] = useState(""); const [submittedQuery, setSubmittedQuery] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]); const [properties, setProperties] = useState<Property[]>([]); const [selectedKey, setSelectedKey] = useState("");
  const [area, setArea] = useState("all"); const [unit, setUnit] = useState<"price" | "py">("price"); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [markets, setMarkets] = useState<OverviewMarket[]>([]); const [marketMonth, setMarketMonth] = useState("");
  const activeRegion = (regions as Region[]).find((item) => item.code === regionCode) || regions[0] as Region;

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSelectedKey(""); setArea("all");
    const params = new URLSearchParams({ type, lawd: regionCode, months: String(period), query: submittedQuery });
    fetch(`/api/trades?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "실거래가를 불러오지 못했습니다."); return data; }).then((data) => { setTrades(data.trades); setProperties(data.properties); if (data.properties.length === 1) setSelectedKey(data.properties[0].key); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, regionCode, period, submittedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/overview?type=${type}`, { signal: controller.signal }).then((response) => response.json()).then((data) => { if (data.markets) { setMarkets(data.markets); setMarketMonth(data.month); } }).catch(() => undefined);
    return () => controller.abort();
  }, [type]);

  const propertyTrades = useMemo(() => selectedKey ? trades.filter((trade) => trade.propertyKey === selectedKey) : trades, [trades, selectedKey]);
  const areas = useMemo(() => [...new Set(propertyTrades.map((trade) => Math.round(trade.area * 10) / 10).filter(Boolean))].sort((a, b) => a - b), [propertyTrades]);
  const filteredTrades = useMemo(() => propertyTrades.filter((trade) => area === "all" || Math.abs(trade.area - Number(area)) < .15), [propertyTrades, area]);
  const chartPoints = useMemo(() => {
    const grouped = new Map<string, number[]>(); filteredTrades.forEach((trade) => { const month = trade.date.slice(0, 7); const value = unit === "py" && trade.area ? trade.amount / (trade.area / 3.3058) : trade.amount; grouped.set(month, [...(grouped.get(month) || []), value]); });
    const base = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, price: median(values), volume: values.length }));
    return base.map((point, index) => ({ ...point, average: median(base.slice(Math.max(0, index - 2), index + 1).map((item) => item.price)) }));
  }, [filteredTrades, unit]);
  const latest = chartPoints.at(-1)?.price || 0; const previous = chartPoints.at(-2)?.price || latest; const change = previous ? (latest / previous - 1) * 100 : 0;
  const high = chartPoints.length ? Math.max(...chartPoints.map((point) => point.price)) : 0; const low = chartPoints.length ? Math.min(...chartPoints.map((point) => point.price)) : 0;
  const selectedProperty = properties.find((property) => property.key === selectedKey); const displayName = selectedProperty?.name || (submittedQuery ? `${submittedQuery} 검색 결과` : `${activeRegion.sigungu} 전체`);
  const latestMonth = trades.at(-1)?.date.slice(0, 7) || "";
  const previousMonth = chartPoints.at(-2)?.month || "";
  const propertyRows = useMemo(() => properties.map((property) => {
    const rows = trades.filter((trade) => trade.propertyKey === property.key); const latestValues = rows.filter((trade) => trade.date.startsWith(latestMonth)).map((trade) => trade.amount); const previousValues = rows.filter((trade) => trade.date.startsWith(previousMonth)).map((trade) => trade.amount);
    const current = latestValues.length ? median(latestValues) : property.lastAmount; const before = previousValues.length ? median(previousValues) : current;
    return { ...property, current, change: before ? (current / before - 1) * 100 : 0, monthCount: latestValues.length };
  }).sort((a, b) => b.monthCount - a.monthCount || b.count - a.count), [properties, trades, latestMonth, previousMonth]);
  const latestMonthTrades = trades.filter((trade) => trade.date.startsWith(latestMonth));
  const risingCount = propertyRows.filter((property) => property.change > 0).length; const fallingCount = propertyRows.filter((property) => property.change < 0).length;
  const regionSuggestions = useMemo(() => { const needle = regionInput.replaceAll(" ", "").toLowerCase(); return (regions as Region[]).filter((item) => `${item.sido}${item.sigungu}`.replaceAll(" ", "").toLowerCase().includes(needle)).slice(0, 8); }, [regionInput]);

  const chooseRegion = (region: Region) => { setRegionCode(region.code); setRegionInput(`${region.sido} ${region.sigungu}`); setSubmittedQuery(""); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const exactRegion = (regions as Region[]).find((item) => `${item.sido} ${item.sigungu}` === regionInput); if (exactRegion) setRegionCode(exactRegion.code); setSubmittedQuery(query.trim()); };

  return <main className="terminal-shell">
    <header className="topbar"><a href="#top" className="brand"><span>집값</span>의 정석 <em>PRO</em></a><nav><a className="active" href="#market">월간 시장</a><a href="#chart">상세 차트</a><a href="#map">전국 지도</a><a href="#transactions">거래 내역</a></nav><div className="live"><i /> 국토교통부 실거래가 연동</div></header>
    <section className="command" id="top">
      <div className="type-tabs">{PROPERTY_TYPES.map((item) => <button key={item.key} className={type === item.key ? "active" : ""} onClick={() => { setType(item.key); setSelectedKey(""); }}>{item.label}</button>)}</div>
      <form className="search-console" onSubmit={submitSearch}>
        <label><span>지역</span><input list="region-list" value={regionInput} onChange={(event) => setRegionInput(event.target.value)} aria-label="시군구 검색"/><datalist id="region-list">{regionSuggestions.map((region) => <option key={region.code} value={`${region.sido} ${region.sigungu}`} />)}</datalist></label>
        <label className="property-search"><span>단지·건물 검색 · 비워두면 전체</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 은마, 래미안, 센트럴파크" aria-label="단지 또는 건물명" /></label>
        <button type="submit">시장 조회 <b>↗</b></button>
      </form>
      <div className="scope-note"><span>{activeRegion.sido}</span><b>{activeRegion.sigungu}</b><i /> 검색어 없이 지역 내 전체 건물을 조회할 수 있습니다.</div>
    </section>

    <section className="monthly-board" id="market">
      <div className="month-intro"><p>MONTHLY MARKET BRIEF</p><h1>{latestMonth ? latestMonth.replace("-", "년 ") + "월" : "최근 한 달"} {activeRegion.sigungu} 시장</h1><span>{PROPERTY_TYPES.find((item) => item.key === type)?.label} 실거래 신고 기준</span></div>
      <article><span>한 달 거래</span><strong>{latestMonthTrades.length.toLocaleString()}<em>건</em></strong><small>전체 {trades.length.toLocaleString()}건 조회</small></article>
      <article><span>거래 건물</span><strong>{propertyRows.filter((property) => property.monthCount).length.toLocaleString()}<em>곳</em></strong><small>전체 {properties.length.toLocaleString()}개 목록</small></article>
      <article><span>상승 / 하락</span><strong className="split"><b>{risingCount}</b><i>/</i><em>{fallingCount}</em></strong><small>직전 거래월 중위가 비교</small></article>
      <article><span>지역 중위가격</span><strong>{formatPrice(median(latestMonthTrades.map((trade) => trade.amount)))}</strong><small>고가·저가 왜곡을 줄인 값</small></article>
    </section>

    <section className="market-browser" id="chart">
      <aside className="watchlist">
        <div className="watch-head"><div><p>BUILDING WATCHLIST</p><h2>{activeRegion.sigungu} 전체 목록</h2></div><span>{properties.length}</span></div>
        <div className="watch-columns"><span>건물 / 단지</span><span>최근가</span></div>
        {loading ? <div className="watch-state">전체 실거래 목록을 불러오는 중…</div> : error ? <div className="watch-state error">{error}</div> : propertyRows.length ? <div className="watch-scroll">{propertyRows.map((property, index) => <button key={property.key} className={selectedKey === property.key ? "selected" : ""} onClick={() => { setSelectedKey(property.key); setArea("all"); }}>
          <i className={`building-icon tone-${index % 5}`}>{property.name.slice(0, 1)}</i><div><b>{property.name}</b><small>{property.dong} {property.jibun || "주소 일부 비공개"} · {property.areas.slice(0, 2).join(" / ")}㎡</small></div><strong>{formatPrice(property.current)}<em className={property.change >= 0 ? "up" : "down"}>{property.change >= 0 ? "+" : ""}{property.change.toFixed(1)}% · {property.monthCount}건</em></strong>
        </button>)}</div> : <div className="watch-state">이 조건의 신고 거래가 없습니다.<button onClick={() => { setQuery(""); setSubmittedQuery(""); }}>전체 목록 보기</button></div>}
      </aside>

      <div className="detail-terminal">
        <div className="ticker-head"><div><p>{PROPERTY_TYPES.find((item) => item.key === type)?.label} / {activeRegion.sido} {activeRegion.sigungu}</p><h1>{displayName}</h1><span>{selectedProperty ? `${selectedProperty.dong} ${selectedProperty.jibun || "주소 일부 비공개"} · 조회기간 ${selectedProperty.count}건` : `목록에서 건물을 선택하거나 ${activeRegion.sigungu} 전체 흐름을 확인하세요`}</span></div><div className="ticker-price"><strong>{formatPrice(latest)}</strong><em className={change >= 0 ? "up" : "down"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</em><small>{unit === "py" ? "만원/평" : "월 중위가격"}</small></div></div>
        <div className="chart-toolbar"><div className="period-switch">{PERIODS.map((item) => <button key={item.value} className={period === item.value ? "active" : ""} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div><div className="view-switch"><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="전용면적 선택"><option value="all">전체 면적</option>{areas.map((value) => <option key={value} value={value}>전용 {value}㎡ ({(value / 3.3058).toFixed(1)}평)</option>)}</select><button className={unit === "price" ? "active" : ""} onClick={() => setUnit("price")}>실거래가</button><button className={unit === "py" ? "active" : ""} onClick={() => setUnit("py")}>평당가</button></div></div>
        <article className="chart-card">
          <div className="chart-legend"><span><i className="price-dot" />월 중위가격</span><span><i className="ma-dot" />3개월 이동평균</span><span><i className="volume-dot" />거래량</span><small>마우스를 움직여 월별 상세 확인</small></div>
          <div className="canvas-wrap">{loading ? <div className="state"><i /> 실거래 데이터를 불러오는 중입니다</div> : error ? <div className="state error"><b>데이터 연결 오류</b><span>{error}</span></div> : chartPoints.length ? <PriceChart points={chartPoints} unit={unit} /> : <div className="state"><b>선택 조건의 거래가 없습니다</b><span>왼쪽 목록에서 다른 건물을 선택하거나 전체 면적을 선택하세요.</span></div>}</div>
        </article>
        <div className="stat-strip"><article><span>최근 월 중위가</span><strong>{formatPrice(latest)}</strong></article><article><span>기간 최고 / 최저</span><strong>{compactPrice(high)} <em>/</em> {compactPrice(low)}</strong></article><article><span>실거래 건수</span><strong>{filteredTrades.length.toLocaleString()}<em>건</em></strong></article><article><span>시장 신호</span><strong className={change >= 0 ? "up" : "down"}>{change > 2 ? "매수 우위" : change < -2 ? "조정 구간" : "보합 구간"}</strong></article></div>
      </div>
    </section>

    <section className="map-section" id="map">
      <div className="section-title wide"><div><p>KOREA MARKET MAP</p><h2>전국 실거래 온도 지도</h2><span>{marketMonth ? `${marketMonth.slice(0, 4)}년 ${Number(marketMonth.slice(4))}월` : "최근 월"} · 시도별 대표 권역 중위가격 변화</span></div><div className="map-legend"><i className="cold"/>하락 <i className="flat"/>보합 <i className="hot"/>상승</div></div>
      <div className="map-layout"><div className="korea-map">{markets.map((market) => <button key={market.code} className={`map-tile map-${market.short} ${market.change > 1 ? "hot" : market.change < -1 ? "cold" : "flat"}`} onClick={() => { const region = (regions as Region[]).find((item) => item.code === market.code); if (region) chooseRegion(region); }}><b>{market.short}</b><span>{market.change >= 0 ? "+" : ""}{market.change.toFixed(1)}%</span><small>{market.count}건</small></button>)}</div>
        <div className="map-ranking"><h3>전국 월간 흐름</h3>{[...markets].sort((a,b) => b.change - a.change).map((market, index) => <button key={market.code} onClick={() => { const region = (regions as Region[]).find((item) => item.code === market.code); if (region) chooseRegion(region); }}><em>{String(index + 1).padStart(2,"0")}</em><b>{market.sido}</b><span>{formatPrice(market.median)}</span><strong className={market.change >= 0 ? "up" : "down"}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</strong></button>)}</div>
      </div>
      <p className="map-note">지도 수치는 시·도 전체 통계가 아니라 각 시·도의 대표 권역에서 신고된 실거래 중위가격 변화입니다. 전국 방향을 빠르게 탐색하기 위한 온도계로 사용하세요.</p>
    </section>

    <section className="trade-section" id="transactions"><div className="section-title wide"><div><p>RECENT CONTRACTS</p><h2>{displayName} 최근 실거래</h2></div><span>단위: 만원 · 최대 30건 표시</span></div><div className="trade-table"><div className="table-head"><span>계약일</span><span>건물명</span><span>전용면적</span><span>층</span><span>거래금액</span><span>평당가</span></div>{[...filteredTrades].reverse().slice(0, 30).map((trade) => <div className="table-row" key={trade.id}><span>{trade.date.replaceAll("-", ".")}</span><b>{trade.name}</b><span>{trade.area ? `${trade.area.toFixed(1)}㎡` : "-"}</span><span>{trade.floor === null ? "-" : `${trade.floor}층`}</span><strong>{formatPrice(trade.amount)}</strong><span>{trade.area ? `${Math.round(trade.amount / (trade.area / 3.3058)).toLocaleString()}만` : "-"}</span></div>)}</div></section>

    <section className="insight"><div><p>DATA NOTE</p><h2>공공 API에서 제공되는 모든 건물 유형을 조회합니다.</h2></div><p>검색어를 비우면 선택한 시군구의 전체 건물 목록을 불러옵니다. 주소가 일부 가려지는 연립·다세대, 단독·다가구, 상가·업무, 공장·창고는 공공데이터 특성상 동일 건물 구분이 제한될 수 있으며, 건물 사진은 실거래 API에 포함되지 않습니다.</p></section>
    <footer><a className="brand" href="#top"><span>집값</span>의 정석</a><p>대한민국 부동산 실거래를 차트로 읽다.</p><span>데이터: 국토교통부 실거래가 공개시스템</span></footer>
  </main>;
}

