"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Region = { id: string; name: string; fullName: string; value: number; change: number };
type Point = { period: string; date: string; value: number };

const TOP_REGIONS = ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toMonthlySeries(points: Point[]) {
  const monthEnds = new Map<string, Point>();
  points.forEach((point) => {
    const month = point.date.slice(0, 7);
    monthEnds.set(month, { ...point, date: month });
  });
  return [...monthEnds.values()];
}

function MarketChart({ points }: { points: Point[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || points.length < 2) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = host.clientWidth;
      const height = host.clientHeight;
      canvas.width = width * ratio; canvas.height = height * ratio;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
      const pad = { left: 14, right: 58, top: 18, bottom: 34 };
      const plotW = width - pad.left - pad.right; const plotH = height - pad.top - pad.bottom;
      const values = points.map((p) => p.value);
      const rawMin = Math.min(...values); const rawMax = Math.max(...values);
      const margin = Math.max((rawMax - rawMin) * .22, .12);
      const min = rawMin - margin; const max = rawMax + margin;

      ctx.font = "10px Arial"; ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = pad.top + plotH / 4 * i;
        ctx.strokeStyle = "#e9e7df"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
        ctx.fillStyle = "#8f8d84"; ctx.fillText((max - (max - min) / 4 * i).toFixed(1), width - pad.right + 10, y + 3);
      }
      const coords = points.map((p, i) => ({ x: pad.left + plotW / (points.length - 1) * i, y: pad.top + plotH - (p.value - min) / (max - min) * plotH }));
      const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      gradient.addColorStop(0, "rgba(255,92,56,.24)"); gradient.addColorStop(1, "rgba(255,92,56,0)");
      ctx.beginPath(); ctx.moveTo(coords[0].x, pad.top + plotH); coords.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.lineTo(coords.at(-1)!.x, pad.top + plotH); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
      ctx.beginPath(); coords.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = "#ff5c38"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
      const last = coords.at(-1)!; ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fillStyle = "#ff5c38"; ctx.fill();
      ctx.fillStyle = "#ff5c38"; ctx.fillRect(width - pad.right + 4, last.y - 10, 49, 20); ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial"; ctx.fillText(points.at(-1)!.value.toFixed(2), width - pad.right + 8, last.y + 4);
      const labelCount = Math.min(6, points.length);
      for (let i = 0; i < labelCount; i++) {
        const index = Math.round(i * (points.length - 1) / (labelCount - 1));
        ctx.fillStyle = "#99978f"; ctx.font = "9px Arial"; ctx.fillText(points[index].date.slice(2, 7).replace("-", "."), pad.left + plotW / (labelCount - 1) * i - 12, height - 10);
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(host); return () => observer.disconnect();
  }, [points]);

  return <canvas ref={canvasRef} aria-label="선택 지역 월별 아파트 매매가격지수 차트" />;
}

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selected, setSelected] = useState("50001");
  const [series, setSeries] = useState<Point[]>([]);
  const [regionName, setRegionName] = useState("전국");
  const [regionPath, setRegionPath] = useState("전국");
  const [period, setPeriod] = useState("1년");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/market?mode=regions").then((r) => r.json()).then((data) => {
      if (data.error) throw new Error(data.error);
      setRegions(data.regions); setAsOf(data.asOf);
    }).catch(() => setError("전국 지역 목록을 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    setLoading(true); setError("");
    fetch(`/api/market?region=${selected}`).then((r) => r.json()).then((data) => {
      if (data.error) throw new Error(data.error);
      setSeries(data.series); setRegionName(data.region.name); setRegionPath(data.region.fullName); setSearch("");
    }).catch(() => setError("한국부동산원 데이터를 불러오지 못했습니다.")).finally(() => setLoading(false));
  }, [selected]);

  const monthlySeries = useMemo(() => toMonthlySeries(series), [series]);
  const pointCount = period === "3개월" ? 3 : period === "6개월" ? 6 : period === "1년" ? 12 : period === "3년" ? 36 : monthlySeries.length;
  const visible = monthlySeries.slice(-pointCount);
  const current = monthlySeries.at(-1)?.value || 0;
  const previous = monthlySeries.at(-2)?.value || current;
  const quarterAgo = monthlySeries.at(-4)?.value || previous;
  const monthlyChange = previous ? (current / previous - 1) * 100 : 0;
  const quarterChange = quarterAgo ? (current / quarterAgo - 1) * 100 : 0;
  const signal = monthlyChange > .15 && quarterChange > .3 ? "상승 우위" : monthlyChange < -.15 && quarterChange < -.3 ? "하락 우위" : "보합 흐름";

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase(); if (!query) return [];
    return regions.filter((r) => `${r.name} ${r.fullName}`.toLowerCase().includes(query)).slice(0, 9);
  }, [regions, search]);
  const provinceCards = TOP_REGIONS.map((name) => regions.find((r) => r.name === name && (r.fullName === name || name === "전국"))).filter(Boolean) as Region[];
  const ranking = [...provinceCards].filter((r) => r.name !== "전국").sort((a, b) => b.change - a.change);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  const choose = (region: Region) => { setSelected(region.id); setSearchOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <main>
    <header className="topbar" id="top">
      <a className="brand" href="#top"><span>집</span>값의 정석</a>
      <nav><a className="active" href="#market">전국 차트</a><a href="#regions">지역 비교</a><a href="#community">커뮤니티</a></nav>
      <div className="official"><i /> REB 공식 데이터 연결</div>
    </header>

    <section className="nation-hero">
      <div className="hero-copy"><p>대한민국 부동산 시장 한눈에</p><h1>전국 236개 권역의 흐름을<br />하나의 차트로 비교하세요.</h1><span>한국부동산원 아파트 매매가격지수 월별 집계 · {asOf || "최신 공표"} 기준</span></div>
      <div className="region-search">
        <label htmlFor="region-search">지역 찾기</label>
        <div className="search-box"><span>⌕</span><input id="region-search" value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} placeholder="시·도, 시·군·구를 검색하세요" autoComplete="off" /><kbd>전국</kbd></div>
        {searchOpen && search && <div className="search-popover">{searchResults.length ? searchResults.map((r) => <button key={r.id} onClick={() => choose(r)}><b>{r.name}</b><span>{r.fullName.replaceAll(">", " › ")}</span></button>) : <p>검색 결과가 없습니다.</p>}</div>}
        <div className="quick-regions">{provinceCards.slice(0, 8).map((r) => <button key={r.id} onClick={() => choose(r)} className={selected === r.id ? "active" : ""}>{r.name}</button>)}</div>
      </div>
    </section>

    <section className="data-ribbon"><div><span>선택 지역</span><strong>{regionPath.replaceAll(">", " › ")}</strong></div><div><span>현재 지수</span><strong>{current ? current.toFixed(2) : "—"}</strong></div><div><span>월간 변동</span><strong className={monthlyChange >= 0 ? "rise" : "fall"}>{current ? percent(monthlyChange) : "—"}</strong></div><p>기준시점 2026.07.06 = 100.0</p></section>

    <section className="dashboard" id="market">
      <div className="market-heading"><div><p>월별 아파트 매매가격지수</p><h2>{regionName} 시장 흐름</h2></div><button className={saved.includes(selected) ? "saved" : ""} onClick={() => setSaved(saved.includes(selected) ? saved.filter((id) => id !== selected) : [...saved, selected])}>☆ {saved.includes(selected) ? "관심지역 저장됨" : "관심지역"}</button></div>
      <div className="metric-grid">
        <article><span>현재 가격지수</span><h3>{loading ? "···" : current.toFixed(2)}</h3><p>월별 마지막 공표값</p></article>
        <article><span>전월 대비</span><h3 className={monthlyChange >= 0 ? "rise" : "fall"}>{loading ? "···" : percent(monthlyChange)}</h3><p>{monthlySeries.at(-1)?.date || "—"}</p></article>
        <article><span>3개월 모멘텀</span><h3 className={quarterChange >= 0 ? "rise" : "fall"}>{loading ? "···" : percent(quarterChange)}</h3><p>최근 3개월 누적</p></article>
        <article className="signal-card"><span>시장 신호</span><h3>{loading ? "분석 중" : signal}</h3><div className={`signal-line ${signal === "상승 우위" ? "hot" : signal === "하락 우위" ? "cold" : ""}`}><i /></div></article>
      </div>

      <div className="content-grid">
        <article className="chart-panel panel">
          <div className="panel-top"><div><span>{regionPath.replaceAll(">", " · ")}</span><h3>{current.toFixed(2)} <em className={monthlyChange >= 0 ? "rise" : "fall"}>{percent(monthlyChange)}</em></h3></div><div className="periods">{["3개월", "6개월", "1년", "3년", "전체"].map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div></div>
          <div className="chart-wrap">{error ? <div className="chart-state">{error}</div> : loading ? <div className="chart-state">공식 데이터를 불러오는 중입니다…</div> : <MarketChart points={visible} />}</div>
          <div className="chart-caption"><span><i /> 월별 아파트 매매가격지수</span><b>주간 지수의 월별 마지막 공표값 · 출처: 한국부동산원</b></div>
        </article>

        <aside className="ranking panel">
          <div className="ranking-head"><div><span>이번 주 시·도 순위</span><h3>상승률 TOP 5</h3></div><small>{asOf}</small></div>
          <div className="ranking-list">{ranking.slice(0, 5).map((r, i) => <button key={r.id} onClick={() => choose(r)}><em>{String(i + 1).padStart(2, "0")}</em><b>{r.name}</b><span className={r.change >= 0 ? "rise" : "fall"}>{percent(r.change)}</span></button>)}</div>
          <div className="ranking-bottom"><span>전국 평균</span><b className={(provinceCards[0]?.change || 0) >= 0 ? "rise" : "fall"}>{percent(provinceCards[0]?.change || 0)}</b></div>
        </aside>
      </div>
    </section>

    <section className="region-section" id="regions">
      <div className="section-heading"><div><p>전국 시장 온도</p><h2>17개 시·도 주간 변동률</h2></div><span>지역을 누르면 상세 차트가 바뀝니다</span></div>
      <div className="region-board">{provinceCards.filter((r) => r.name !== "전국").map((r) => <button key={r.id} onClick={() => choose(r)} className={selected === r.id ? "active" : ""}><span>{r.name}</span><strong className={r.change >= 0 ? "rise" : "fall"}>{percent(r.change)}</strong><i style={{ width: `${Math.min(100, Math.abs(r.change) * 240 + 10)}%` }} /></button>)}</div>
      <p className="method-note"><b>읽는 법</b> 가격지수는 개별 아파트의 거래가격이 아니라 표본주택의 가격 변화를 지수화한 공식 시장지표입니다. 지역 간 흐름과 방향성을 비교할 때 활용하세요.</p>
    </section>

    <section className="community-section" id="community">
      <div className="section-heading"><div><p>지역의 목소리</p><h2>{regionName}, 지금 현장 분위기는 어떤가요?</h2></div><button onClick={() => flash("관점 공유 기능을 준비 중입니다")}>+ 관점 공유하기</button></div>
      <div className="opinion-grid"><article><div className="avatar orange">J</div><div><span>집보는 직장인 · 2시간 전</span><b>지수 흐름과 현장 매물 분위기가 비슷하게 움직이고 있어요.</b><p>급매가 줄었지만 매수자는 여전히 신중합니다. 한두 건의 거래보다 몇 주간의 방향을 함께 보는 게 좋겠어요.</p><small>♡ 24　답글</small></div></article><article><div className="avatar blue">M</div><div><span>주말 임장러 · 5시간 전</span><b>생활권별 온도 차이는 꽤 큽니다.</b><p>같은 시 안에서도 역세권과 외곽의 분위기가 달라요. 시군구 지수까지 내려가서 비교해보세요.</p><small>♡ 18　답글</small></div></article></div>
    </section>

    <footer><a className="brand" href="#top"><span>집</span>값의 정석</a><p>전국 부동산 시장의 흐름을 더 선명하게.</p><div>공식 데이터: 한국부동산원 R-ONE</div><small>본 서비스의 지수와 분석은 참고용이며, 개별 부동산의 실제 거래가격 또는 투자수익을 보장하지 않습니다.</small></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}
