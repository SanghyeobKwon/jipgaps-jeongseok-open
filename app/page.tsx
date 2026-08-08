"use client";

import { useEffect, useRef, useState } from "react";

const chartSeries: Record<string, number[]> = {
  "1년": [24.6, 24.7, 24.55, 24.8, 25.1, 25.4, 25.2, 25.9, 26.2, 26.65, 27.1, 27.3],
  "3년": [21.1, 21.8, 22.4, 22.1, 23.2, 24.1, 23.6, 24.5, 24.9, 25.5, 26.2, 27.3],
  "5년": [17.3, 18.8, 20.6, 22.7, 24.2, 23.4, 22.1, 23.8, 24.4, 25.2, 26.4, 27.3],
  "전체": [8.2, 9.6, 11.4, 13.8, 16.7, 18.5, 21.2, 23.6, 22.4, 24.1, 25.6, 27.3],
};

const comments = [
  { avatar: "J", color: "coral", name: "집보는 직장인", time: "2시간 전", body: "학군 수요는 여전히 탄탄해 보여요. 9호선 연장 기대감보다 지금의 생활권 완성도를 더 높게 봅니다.", likes: 24, tag: "실거주" },
  { avatar: "M", color: "blue", name: "마포불주먹", time: "5시간 전", body: "최근 같은 평형 2건이 27억대에 거래됐네요. 전고점 돌파보다 거래량 회복 여부를 먼저 확인할 구간 같습니다.", likes: 18, tag: "투자" },
  { avatar: "S", color: "green", name: "서울숲산책", time: "어제", body: "주말에 직접 가봤는데 단지 조경과 상권 접근성이 정말 좋았습니다. 다만 출근 시간 교통은 체크가 필요해요.", likes: 11, tag: "임장" },
];

function PriceChart({ period }: { period: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement;
    if (!host) return;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = host.clientWidth;
      const height = host.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);
      const pad = { left: 18, right: 56, top: 18, bottom: 34 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      const data = chartSeries[period];
      const min = Math.min(...data) - 1.4;
      const max = Math.max(...data) + 1.2;

      ctx.lineWidth = 1;
      ctx.font = "11px Arial";
      ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = pad.top + (plotH / 4) * i;
        ctx.strokeStyle = "#e8e8e3";
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
        const value = max - ((max - min) / 4) * i;
        ctx.fillStyle = "#8b8b84";
        ctx.fillText(`${value.toFixed(0)}억`, width - pad.right + 10, y + 4);
      }

      const points = data.map((v, i) => ({
        x: pad.left + (plotW / (data.length - 1)) * i,
        y: pad.top + plotH - ((v - min) / (max - min)) * plotH,
      }));

      const area = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      area.addColorStop(0, "rgba(255, 92, 56, .24)");
      area.addColorStop(1, "rgba(255, 92, 56, 0)");
      ctx.beginPath(); ctx.moveTo(points[0].x, pad.top + plotH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.top + plotH); ctx.closePath();
      ctx.fillStyle = area; ctx.fill();

      ctx.beginPath();
      points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = "#ff5c38"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

      const last = points[points.length - 1];
      ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fillStyle = "#ff5c38"; ctx.fill();
      ctx.fillStyle = "#ff5c38"; ctx.fillRect(width - pad.right + 4, last.y - 10, 45, 20);
      ctx.fillStyle = "white"; ctx.font = "bold 11px Arial"; ctx.fillText("27.3억", width - pad.right + 9, last.y + 4);

      ["2025.09", "2025.11", "2026.01", "2026.03", "2026.05", "2026.07"].forEach((label, i, arr) => {
        ctx.fillStyle = "#9b9b93"; ctx.font = "10px Arial";
        ctx.fillText(label, pad.left + (plotW / (arr.length - 1)) * i - 18, height - 9);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [period]);

  return <canvas ref={canvasRef} aria-label={`${period} 실거래가 추이 차트`} />;
}

export default function Home() {
  const [period, setPeriod] = useState("1년");
  const [favorite, setFavorite] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  const [tab, setTab] = useState("단지 분석");
  const [notice, setNotice] = useState("");

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="집값의 정석 홈"><span>집</span>값의 정석</a>
        <nav aria-label="주요 메뉴">
          <a className="active" href="#chart">차트</a><a href="#analysis">지역 분석</a><a href="#community">커뮤니티</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="검색" onClick={() => flash("단지 검색을 준비 중입니다")}>⌕</button>
          <button className="login" onClick={() => flash("로그인 기능을 준비 중입니다")}>로그인</button>
        </div>
      </header>

      <section className="market-strip" id="top">
        <div><span>서울 아파트</span><strong>102.4</strong><em className="up">▲ 0.18%</em></div>
        <div><span>전국 아파트</span><strong>98.7</strong><em className="down">▼ 0.03%</em></div>
        <div><span>오늘의 거래</span><strong>1,284건</strong><em>서울 246건</em></div>
        <div><span>관심 지역</span><strong>서울 송파구</strong><em className="up">+0.32%</em></div>
        <p>2026. 08. 09 기준 · 국토교통부 실거래가</p>
      </section>

      <section className="search-row">
        <button className="crumb-search" onClick={() => flash("지역·단지 검색을 준비 중입니다")}><span>⌕</span> 지역, 단지명을 검색해보세요 <kbd>⌘ K</kbd></button>
        <div className="breadcrumbs">서울특별시 <b>›</b> 송파구 <b>›</b> 잠실동</div>
      </section>

      <section className="property-head">
        <div>
          <p className="eyebrow">서울 송파구 잠실동 19</p>
          <h1>잠실 엘스 <span>5,678세대 · 2008.09</span></h1>
          <div className="chips"><span>재건축 기대</span><span>대단지</span><span>초품아</span><span>역세권</span></div>
        </div>
        <button className={`favorite ${favorite ? "saved" : ""}`} onClick={() => setFavorite(!favorite)} aria-pressed={favorite}>☆ {favorite ? "관심단지 저장됨" : "관심단지"}</button>
      </section>

      <section className="stats-grid">
        <article className="price-card"><p>최근 실거래가 <span>84㎡ · 12층</span></p><h2>27억 3,000<small>만원</small></h2><div><b className="up">▲ 8,000</b><span>전 거래 대비</span></div></article>
        <article><p>3.3㎡당 가격</p><h3>8,027만원</h3><div><b>송파구 상위 8%</b></div></article>
        <article><p>전세가율</p><h3>47.6%</h3><div><b>13억 0,000만원</b></div></article>
        <article><p>최근 거래일</p><h3>2026. 08. 02</h3><div><b>7일 전</b></div></article>
        <article className="valuation"><p>AI 적정가 분석 <span className="info">i</span></p><h3>다소 저평가 <mark>-4.2%</mark></h3><div className="meter"><i /></div><small>예상 적정가 28.5억</small></article>
      </section>

      <section className="main-grid" id="chart">
        <div className="chart-panel panel">
          <div className="panel-head">
            <div><p>실거래가 추이</p><strong>27억 3,000만원</strong> <em className="up">+3.02%</em></div>
            <div className="periods">{Object.keys(chartSeries).map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div>
          </div>
          <div className="chart-area"><PriceChart period={period} /></div>
          <div className="chart-footer"><span className="legend-dot" /> 실거래가 <span className="dash" /> 송파구 평균 <span className="source">단위: 억원 · 84㎡ 기준</span></div>
        </div>

        <aside className="right-column">
          <article className="score-card panel" id="analysis">
            <div className="panel-head"><div><p>입지 가치 점수</p><strong>87<small>/100</small></strong></div><span className="grade">A</span></div>
            <div className="score-list">
              <div><span>교통</span><i><b style={{width:"92%"}} /></i><strong>92</strong></div>
              <div><span>학군</span><i><b style={{width:"95%"}} /></i><strong>95</strong></div>
              <div><span>생활</span><i><b style={{width:"88%"}} /></i><strong>88</strong></div>
              <div><span>환경</span><i><b style={{width:"82%"}} /></i><strong>82</strong></div>
              <div><span>미래</span><i><b style={{width:"76%"}} /></i><strong>76</strong></div>
            </div>
            <p className="analysis-note"><b>한줄 분석</b> 강남 접근성과 학군은 탁월하며, 대단지 희소성이 가격을 지지해요.</p>
          </article>
          <article className="map-card panel">
            <div className="mini-map" aria-label="잠실 엘스 주변 시설 지도">
              <span className="river">한강</span><span className="road r1" /><span className="road r2" /><span className="road r3" />
              <span className="place school">학</span><span className="place station">2</span><span className="place shop">몰</span><span className="place park">숲</span><span className="pin">집</span>
            </div>
            <div className="nearby"><div><b>도보 6분</b><span>잠실새내역</span></div><div><b>도보 3분</b><span>잠일초등학교</span></div><div><b>차량 7분</b><span>롯데월드몰</span></div></div>
          </article>
        </aside>
      </section>

      <section className="detail-panel panel">
        <div className="tabs">{["단지 분석", "거래 내역", "평형 정보", "보유 비용"].map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
        {tab === "단지 분석" ? <div className="insights">
          <article><span className="insight-icon green">↗</span><div><b>가격 경쟁력</b><h3>인근 신축 대비 <em>-12.8%</em></h3><p>비슷한 입지의 신축 단지보다 평당가가 낮아요.</p></div></article>
          <article><span className="insight-icon orange">●</span><div><b>거래 활력</b><h3>최근 3개월 <em>42건</em></h3><p>송파구 동일 규모 단지 대비 거래가 활발해요.</p></div></article>
          <article><span className="insight-icon blue">⌁</span><div><b>전세 안정성</b><h3>전세 매물 <em>보통</em></h3><p>전세가율이 안정적이며 갭 변동이 크지 않아요.</p></div></article>
        </div> : <div className="placeholder"><b>{tab}</b><span>선택한 정보의 상세 데이터가 이 영역에 표시됩니다.</span></div>}
      </section>

      <section className="community" id="community">
        <div className="section-title"><div><p>함께 보는 관점</p><h2>이 단지, 어떻게 보고 계세요?</h2></div><button onClick={() => flash("의견 작성창을 준비 중입니다")}>+ 관점 공유하기</button></div>
        <div className="community-grid">
          <div className="posts">{comments.map((comment, idx) => <article className="post" key={comment.name}>
            <div className={`avatar ${comment.color}`}>{comment.avatar}</div>
            <div className="post-body"><div className="post-meta"><b>{comment.name}</b><span>{comment.time}</span><em>{comment.tag}</em></div><p>{comment.body}</p><div className="post-actions"><button onClick={() => setLiked(liked.includes(idx) ? liked.filter((x) => x !== idx) : [...liked, idx])}>♡ {comment.likes + (liked.includes(idx) ? 1 : 0)}</button><button>답글</button></div></div>
          </article>)}</div>
          <aside className="sentiment panel"><p>커뮤니티 온도</p><div className="gauge"><div><strong>68°</strong><span>관심이 뜨거워요</span></div></div><div className="vote"><span><i className="buy" />매수 관점 <b>64%</b></span><span><i className="wait" />관망 관점 <b>36%</b></span></div><small>최근 30일 · 참여 284명</small></aside>
        </div>
      </section>

      <footer><a className="brand" href="#top"><span>집</span>값의 정석</a><p>흩어진 부동산 데이터를 한눈에, 더 나은 판단을 위한 시작.</p><div><a href="#analysis">서비스 소개</a><a href="#community">커뮤니티 가이드</a><a href="#top">데이터 기준</a></div><small>※ 본 서비스의 분석 결과는 참고용이며, 투자 판단의 책임은 사용자에게 있습니다.</small></footer>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
