"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import regions from "./data/regions.json";

type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";
type Region = { code: string; sido: string; sigungu: string };
type Trade = { id: string; date: string; amount: number; area: number; floor: number | null; name: string; propertyKey: string; dong: string; buildingDong: string; jibun: string; buildYear: number | null; dealingType: string; cancelled: boolean };
type Property = { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; areas: number[] };
type ChartPoint = { month: string; price: number; average: number; volume: number };
type OverviewMarket = { short: string; sido: string; code: string; count: number; median: number; change: number };
type PolicyItem = { date: string; tone: string; label: string; scope: string; title: string; summary: string; url: string };
type SavedHome = { id: string; name: string; region: string; area: number; price: number; score: number; savedAt: string };
type ResearchMode = "live" | "connect";
type ResearchTool = { id: string; label: string; description: string; mode: ResearchMode; source: string };
type ResearchCategory = { id: string; number: string; label: string; short: string; description: string; tools: ResearchTool[] };
type CommunityCategory = { id: string; number: string; label: string; description: string; boards: string[] };
type CommunityGuide = { id: string; category: string; board: string; tag: string; title: string; summary: string; evidence: string };
type FieldFeature = { id: string; group: string; title: string; information: string; value: string; importance: 4 | 5; status: "live" | "beta" | "connect"; source: string };
type PropertyLocation = { lat: number; lng: number; roadAddress: string; jibunAddress: string };
type NearbyPlace = { id: string; name: string; category: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };
type MapFocus = "national" | "sido" | "district" | "detail";
type GeoJsonFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: Record<string, unknown> };
type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };
type NaverBounds = { getCenter: () => unknown };
type NaverDataFeature = { getProperty: (key: string) => unknown; getBounds?: () => NaverBounds };
type NaverDataLayer = { addGeoJson: (data: GeoJsonFeatureCollection) => NaverDataFeature[]; setStyle: (style: (feature: NaverDataFeature) => Record<string, unknown>) => void };
type NaverMapInstance = { data: NaverDataLayer; destroy?: () => void; fitBounds?: (bounds: unknown, margin?: number | { top: number; right: number; bottom: number; left: number }) => void; setCenter?: (center: unknown) => void; setZoom?: (zoom: number) => void };
type NaverOverlayInstance = { setMap: (map: NaverMapInstance | null) => void };
type NaverMarkerInstance = NaverOverlayInstance;
type NaverEventListener = unknown;
type NaverMapsApi = { maps: { Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance; LatLng: new (lat: number, lng: number) => unknown; LatLngBounds: new (southWest: unknown, northEast: unknown) => NaverBounds; Point: new (x: number, y: number) => unknown; Marker: new (options: Record<string, unknown>) => NaverMarkerInstance; Circle: new (options: Record<string, unknown>) => NaverOverlayInstance; Position: { TOP_RIGHT: unknown; BOTTOM_LEFT: unknown }; Event: { addListener: (target: unknown, eventName: string, listener: (event: { feature?: NaverDataFeature }) => void) => NaverEventListener; removeListener: (listener: NaverEventListener) => void } } };

declare global {
  interface Window { naver?: NaverMapsApi; __jipgapsNaverMap?: Promise<void> }
}

const SIDO_ORDER = ["서울특별시", "경기도", "인천광역시", "부산광역시", "대구광역시", "대전광역시", "울산광역시", "세종특별자치시", "강원특별자치도", "충청북도", "충청남도", "전남광주통합특별시", "전북특별자치도", "경상북도", "경상남도", "제주특별자치도"];
const SIDO_CODES: Record<string, string> = { "서울특별시": "11", "전남광주통합특별시": "12", "부산광역시": "26", "대구광역시": "27", "인천광역시": "28", "대전광역시": "30", "울산광역시": "31", "세종특별자치시": "36", "경기도": "41", "충청북도": "43", "충청남도": "44", "경상북도": "47", "경상남도": "48", "제주특별자치도": "50", "강원특별자치도": "51", "전북특별자치도": "52" };
const SEOUL_PRIORITY = ["강남구", "서초구", "송파구", "용산구", "성동구", "마포구", "영등포구", "강동구", "양천구", "광진구", "동작구", "종로구", "중구", "서대문구", "강서구", "관악구", "동대문구", "성북구", "은평구", "노원구", "구로구", "금천구", "중랑구", "도봉구", "강북구"];
function normalizeRegion(region: Region): Region {
  let sigungu = region.sigungu.trim().replace(/\s+/g, " ");
  if (region.sido === "서울특별시") sigungu = sigungu.replace(/^(?:(?:서울특별시|서울시)\s*)+/, "");
  if (region.code.startsWith("4128") && !sigungu.startsWith("고양시")) sigungu = `고양시 ${sigungu}`;
  if (region.code.startsWith("4146") && !sigungu.startsWith("용인시")) sigungu = `용인시 ${sigungu}`;
  sigungu = sigungu.replace(/시(?=[가-힣]+구$)/, "시 ");
  return { ...region, sido: region.sido === "전라북도" ? "전북특별자치도" : region.sido, sigungu };
}
const REGIONS = [...new Map((regions as Region[]).map(normalizeRegion).map((region) => [region.code, region])).values()];
function sortRegions(a: Region, b: Region) { if (a.sido === "서울특별시" && b.sido === "서울특별시") return SEOUL_PRIORITY.indexOf(a.sigungu) - SEOUL_PRIORITY.indexOf(b.sigungu); return Number(a.code) - Number(b.code); }
function areaBucket(area: number) { return area > 0 ? Math.round(area / 3.3058) : 0; }
function dongLabel(value: string) { return value ? (value.endsWith("동") ? value : `${value}동`) : ""; }

const PROPERTY_TYPES: { key: PropertyType; label: string }[] = [
  { key: "apt", label: "아파트" }, { key: "rowhouse", label: "연립·다세대" },
  { key: "house", label: "단독·다가구" }, { key: "officetel", label: "오피스텔" },
  { key: "commercial", label: "상가·업무" }, { key: "factory", label: "공장·창고" },
];
const PERIODS = [{ label: "3개월", value: 3 }, { label: "6개월", value: 6 }, { label: "1년", value: 12 }, { label: "3년", value: 36 }, { label: "5년", value: 60 }];
const NAV_ITEMS = [{ id: "home", label: "지도에서 찾기" }, { id: "chart", label: "상세 차트" }, { id: "field", label: "온라인 임장" }, { id: "research", label: "리서치" }, { id: "map", label: "전국 지도" }, { id: "community", label: "커뮤니티" }, { id: "policy", label: "정책" }];
const SIDO_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  서울특별시: { lat: 37.5665, lng: 126.978, zoom: 10 }, 부산광역시: { lat: 35.1796, lng: 129.0756, zoom: 10 }, 대구광역시: { lat: 35.8714, lng: 128.6014, zoom: 10 }, 인천광역시: { lat: 37.4563, lng: 126.7052, zoom: 9 },
  전남광주통합특별시: { lat: 35.15, lng: 126.95, zoom: 8 }, 대전광역시: { lat: 36.3504, lng: 127.3845, zoom: 10 }, 울산광역시: { lat: 35.5384, lng: 129.3114, zoom: 9 }, 세종특별자치시: { lat: 36.48, lng: 127.289, zoom: 10 },
  경기도: { lat: 37.4138, lng: 127.5183, zoom: 8 }, 강원특별자치도: { lat: 37.8228, lng: 128.1555, zoom: 8 }, 충청북도: { lat: 36.6357, lng: 127.4917, zoom: 9 }, 충청남도: { lat: 36.5184, lng: 126.8, zoom: 9 },
  전북특별자치도: { lat: 35.7175, lng: 127.153, zoom: 9 }, 경상북도: { lat: 36.4919, lng: 128.8889, zoom: 8 }, 경상남도: { lat: 35.4606, lng: 128.2132, zoom: 9 }, 제주특별자치도: { lat: 33.489, lng: 126.4983, zoom: 9 },
};
const QUICK_REGIONS = [{ code: "11680", label: "강남구" }, { code: "11650", label: "서초구" }, { code: "11710", label: "송파구" }, { code: "11200", label: "성동구" }, { code: "41135", label: "분당구" }, { code: "26350", label: "해운대구" }];
const FIELD_GROUPS = ["입지·동선", "주거환경", "동·세대", "비용·가격", "검증·비교"];
const FIELD_SCORE_EXAMPLE = [
  { label: "교통", score: 92, grade: "매우 좋음" }, { label: "생활편의", score: 91, grade: "매우 좋음" },
  { label: "학군", score: 85, grade: "좋음" }, { label: "일조", score: 84, grade: "좋음" },
  { label: "조망", score: 81, grade: "좋음" }, { label: "보행환경", score: 80, grade: "좋음" },
  { label: "소음", score: 73, grade: "보통" }, { label: "관리비", score: 76, grade: "보통" },
  { label: "주차", score: 68, grade: "주의" },
];
const FIELD_FEATURES: FieldFeature[] = [
  { id: "region", group: "입지·동선", title: "지역 온라인 임장", information: "상권·교통·학교·병원·공원·유흥시설", value: "동네를 직접 돌지 않고 생활권을 먼저 파악", importance: 5, status: "live", source: "네이버 지도·장소 검색" },
  { id: "walk", group: "입지·동선", title: "도보 임장", information: "역에서 단지까지 실제 동선과 보행 환경", value: "지도 거리와 실제 체감거리 차이를 확인", importance: 5, status: "beta", source: "네이버 길찾기 연결" },
  { id: "time", group: "입지·동선", title: "시간대 분석", information: "출근·퇴근·야간 교통과 유동인구", value: "낮과 밤의 지역 분위기 차이를 확인", importance: 5, status: "connect", source: "시간대별 교통·유동인구 원천 필요" },
  { id: "night", group: "입지·동선", title: "야간 임장", information: "가로등·골목·편의점·보행 동선", value: "밤의 생활환경과 귀가 동선을 확인", importance: 4, status: "connect", source: "공공 조도·현장 제보 데이터 필요" },
  { id: "commute", group: "입지·동선", title: "Door-to-Door 출퇴근", information: "집에서 회사까지 실제 예상 경로", value: "직선거리 대신 매일 쓰는 생활시간을 비교", importance: 5, status: "live", source: "네이버 지도 경로 검색" },
  { id: "lifestyle", group: "입지·동선", title: "개인 생활권", information: "헬스장·마트·카페·병원·학교", value: "내 생활패턴에 맞는 입지를 평가", importance: 4, status: "live", source: "선택 지역 장소 검색" },
  { id: "noise", group: "주거환경", title: "소음 지도", information: "도로·철도·상가·학교 소음", value: "조용한 지역과 동을 선택", importance: 5, status: "connect", source: "환경소음·현장 측정 데이터 필요" },
  { id: "parking", group: "주거환경", title: "시간대별 주차난", information: "혼잡·이중주차·동별 접근성", value: "실거주 주차 불편을 계약 전에 확인", importance: 5, status: "connect", source: "관리사무소·거주자 제보 필요" },
  { id: "environment", group: "주거환경", title: "냄새·환경 지도", information: "하수구·음식점·쓰레기·공장 악취", value: "온라인에서 놓치기 쉬운 환경을 확인", importance: 5, status: "connect", source: "환경 민원·인증 현장 제보 필요" },
  { id: "building", group: "동·세대", title: "동·층·방향 분석", information: "소음·도로거리·앞동거리", value: "같은 단지 안에서 더 나은 동을 판단", importance: 5, status: "beta", source: "실거래 동·층 정보 기반, 방향 데이터 보강 필요" },
  { id: "view", group: "동·세대", title: "세대별 조망", information: "앞동·산·공원·도로·하늘 개방도", value: "실제 창밖 환경을 계약 전에 예상", importance: 4, status: "connect", source: "3D 건물·세대 방향 데이터 필요" },
  { id: "sun", group: "동·세대", title: "계절별 일조", information: "시간·동·층·방향별 햇빛", value: "남향 표기보다 정밀하게 채광을 판단", importance: 4, status: "connect", source: "건물 3D·태양 궤적 계산 필요" },
  { id: "maintenance", group: "비용·가격", title: "관리비 분석", information: "월별 관리비와 주변 단지 비교", value: "매매가에 가려진 실제 주거비용을 확인", importance: 4, status: "connect", source: "K-apt 관리비 데이터 필요" },
  { id: "price", group: "비용·가격", title: "실거래·가격 분석", information: "실거래·중위가·최고가·평형 보정 가격", value: "현재 매수 가격의 적정성을 판단", importance: 5, status: "live", source: "국토교통부 실거래" },
  { id: "review", group: "검증·비교", title: "인증 주민 리뷰", information: "주차·층간소음·관리·엘리베이터", value: "실제 거주 경험으로 데이터의 빈틈을 보완", importance: 5, status: "connect", source: "거주 인증·신고 관리 체계 필요" },
  { id: "report", group: "검증·비교", title: "자동 임장 리포트", information: "장점·단점·주의사항과 표본 근거", value: "많은 데이터를 한 번에 이해", importance: 5, status: "live", source: "현재 실거래 분석 요약" },
  { id: "compare", group: "검증·비교", title: "A/B/C 단지 비교", information: "교통·가격·주차·소음·학군", value: "후보 단지를 빠르게 세 곳까지 압축", importance: 5, status: "beta", source: "관심 후보·실거래 비교" },
  { id: "proxy", group: "검증·비교", title: "대리 임장 요청", information: "현장 영상·사진·특정 항목 확인", value: "먼 지역도 필요한 부분만 대신 확인", importance: 5, status: "connect", source: "현장 파트너·거래 보호 체계 필요" },
];
const POLICIES = [
  { date: "2026.07.20", tone: "positive", label: "호재", scope: "비아파트·임대", title: "비아파트 공급 보완조치 전면 시행", summary: "토지 확보 지원금 상향과 PF 보증 강화로 오피스텔·도시형생활주택 공급 사업의 초기 자금 부담이 완화됩니다.", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148968416" },
  { date: "2026.07.15", tone: "negative", label: "악재", scope: "분양·신축", title: "기본형건축비 0.77% 인상", summary: "공사비 상승분이 분양가에 반영될 가능성이 있어 신규 주택 구매자의 가격 부담에는 부정적으로 해석됩니다.", url: "https://www.molit.go.kr/portal.do" },
  { date: "2026.05.12", tone: "neutral", label: "중립", scope: "토지거래허가", title: "세입자 있는 주택 실거주 유예 확대", summary: "임대 중 주택의 매도 편의는 개선되지만 갭투자 제한 원칙은 유지돼 수요·공급 양쪽 효과가 혼재합니다.", url: "https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95091995" },
  { date: "2026 업무계획", tone: "positive", label: "호재", scope: "주거복지·공급", title: "공적 임대주택 최소 15.2만호 공급", summary: "공공임대 14만호와 공공지원 민간임대 1.2만호 공급 계획으로 무주택 실수요자의 선택지가 확대됩니다.", url: "https://www.molit.go.kr/2026plan/251212%28%EC%9E%90%EB%A3%8C%29_%EA%B5%AD%ED%86%A0%EA%B5%90%ED%86%B5%EB%B6%80_%EC%97%85%EB%AC%B4%EB%B3%B4%EA%B3%A0_%EC%84%9C%EB%A9%B4%EC%9E%90%EB%A3%8C.pdf" },
];

const RESEARCH_CATEGORIES: ResearchCategory[] = [
  {
    id: "price", number: "01", label: "가격·실거래", short: "PRICE", description: "실제 체결가를 같은 동·평형끼리 비교해 가격의 방향과 상대 가치를 봅니다.",
    tools: [
      { id: "recent-fall", label: "최근하락", description: "직전 분기와 비교 가능한 동·평형 중 하락폭이 큰 순서로 봅니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "record-high", label: "최고가", description: "선택 지역의 최근 3개월 중위가격이 높은 동·평형을 찾습니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "top-rise", label: "최고상승", description: "직전 분기 대비 중위가격 상승률이 높은 순서로 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "price-change", label: "가격변동", description: "상승·하락 방향과 무관하게 변동폭이 큰 동·평형을 먼저 보여줍니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "price-compare", label: "가격비교", description: "같은 지역의 유사 평형 평당가와 비교해 상대 가격차를 계산합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "multi-compare", label: "여러단지비교", description: "가격 매력·거래량·가격 흐름을 합산해 여러 후보를 한 번에 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
    ],
  },
  {
    id: "demand", number: "02", label: "수급·시장심리", short: "DEMAND", description: "얼마에 거래됐는지와 함께 시장 참여자가 실제로 움직이는지를 확인합니다.",
    tools: [
      { id: "listing-change", label: "매물증감", description: "지역·단지별 매물 재고가 늘거나 줄어드는 속도를 추적합니다.", mode: "connect", source: "일별 매물 스냅샷 데이터" },
      { id: "most-bought", label: "많이산단지", description: "최근 3개월 실제 계약이 많이 체결된 동·평형을 보여줍니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "volume", label: "거래량", description: "선택 지역 안에서 분기 거래가 집중된 단지를 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "gap", label: "갭투자", description: "매매가와 동일 평형 전세가의 차이와 갭 비율을 계산합니다.", mode: "connect", source: "매매·전월세 실거래 결합" },
      { id: "sentiment", label: "매수심리", description: "상승·하락 동·평형 비중과 거래 회복 정도로 체결 심리를 읽습니다.", mode: "live", source: "실거래 기반 자체 체결심리" },
    ],
  },
  {
    id: "supply", number: "03", label: "공급·분양", short: "SUPPLY", description: "앞으로 들어올 주택과 분양 가격을 함께 봐서 지역의 공급 부담을 판단합니다.",
    tools: [
      { id: "supply-volume", label: "공급물량", description: "인허가·착공·준공·입주예정 물량을 시계열로 비교합니다.", mode: "connect", source: "국토교통부 주택건설실적·입주예정" },
      { id: "unsold", label: "미분양", description: "시·군·구별 미분양과 준공 후 미분양의 변화 속도를 봅니다.", mode: "connect", source: "국토교통부 미분양주택현황" },
      { id: "presale-price", label: "분양가비교", description: "신규 분양가를 인근 구축·신축 실거래 평당가와 비교합니다.", mode: "connect", source: "청약홈 분양정보·실거래가" },
    ],
  },
  {
    id: "location", number: "04", label: "입지·생활가치", short: "LOCATION", description: "인구·학교·단지 규모·관심도를 가격 옆에 놓고 오래 살기 좋은지를 봅니다.",
    tools: [
      { id: "population", label: "인구변화", description: "전입·전출과 연령별 인구 변화로 실수요 기반을 확인합니다.", mode: "connect", source: "행정안전부 주민등록 인구통계" },
      { id: "school", label: "학군비교", description: "학교 접근성·학업 지표와 같은 평형 가격 프리미엄을 함께 비교합니다.", mode: "connect", source: "학교알리미·교육통계" },
      { id: "mega-complex", label: "대단지", description: "세대수 기준으로 대단지를 찾고 거래 유동성과 관리비를 비교합니다.", mode: "connect", source: "K-apt 공동주택 기본정보" },
      { id: "views", label: "조회수", description: "집값의 정석 안에서 관심이 빠르게 늘어난 지역과 단지를 추적합니다.", mode: "connect", source: "서비스 익명 관심도 집계" },
    ],
  },
  {
    id: "income", number: "05", label: "수익·비주거", short: "INCOME", description: "보유 비용과 임대 현금흐름, 상가·토지 시장까지 투자 관점에서 분리해 봅니다.",
    tools: [
      { id: "rent-yield", label: "월세수익", description: "보증금을 환산한 월세 수익률과 매매가 대비 현금흐름을 계산합니다.", mode: "connect", source: "전월세·매매 실거래 결합" },
      { id: "retail", label: "상가통계", description: "상권 매출·공실·상가 실거래를 지역별로 비교합니다.", mode: "connect", source: "소상공인 상권정보·상업업무용 실거래" },
      { id: "land", label: "토지통계", description: "지목·용도지역별 토지 거래량과 면적당 가격 흐름을 봅니다.", mode: "connect", source: "국토교통부 토지 실거래" },
    ],
  },
];

const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  { id: "living", number: "01", label: "실거주·갈아타기", description: "내 예산과 생애주기에 맞는 집을 고르는 방", boards: ["전체", "첫 집 마련", "갈아타기", "지역 선택", "대출·자금", "계약 체크"] },
  { id: "price", number: "02", label: "가격·실거래", description: "호가보다 실제 거래 근거로 가격을 토론하는 방", boards: ["전체", "실거래 복기", "단지 비교", "저평가 찾기", "신고가·하락", "평형별 분석"] },
  { id: "market", number: "03", label: "수급·정책", description: "거래량·공급·정책이 시장에 미칠 영향을 읽는 방", boards: ["전체", "거래량·매물", "공급·입주", "청약·미분양", "정책·세금", "재건축 규제"] },
  { id: "location", number: "04", label: "입지·임장", description: "지도 밖의 생활 환경을 직접 확인하고 기록하는 방", boards: ["전체", "교통", "학군", "상권·생활", "재개발·재건축", "임장기"] },
  { id: "invest", number: "05", label: "투자·수익", description: "리스크와 현금흐름을 숫자로 검증하는 방", boards: ["전체", "전월세", "갭투자", "수익률", "상가·토지", "포트폴리오"] },
];

const COMMUNITY_GUIDES: CommunityGuide[] = [
  { id: "living-1", category: "living", board: "첫 집 마련", tag: "체크리스트", title: "첫 집 예산에서 취득세·중개보수까지 빼고 계산했나요?", summary: "매매가만 보지 않고 계약부터 입주까지 필요한 현금을 한 장으로 정리해 봅니다.", evidence: "자금계획표 첨부 권장" },
  { id: "living-2", category: "living", board: "갈아타기", tag: "비교 토론", title: "지금 집을 먼저 팔지, 갈 집을 먼저 살지 판단하는 기준", summary: "잔금일·대출 한도·지역 거래량을 기준으로 두 시나리오의 위험을 비교합니다.", evidence: "거래 일정과 실거래 근거" },
  { id: "price-1", category: "price", board: "평형별 분석", tag: "실거래 분석", title: "같은 단지 84㎡인데 가격 차이가 큰 이유를 어떻게 걸러낼까", summary: "동·층·방향 차이와 표본 수를 분리해 과장된 변동률을 피하는 방법을 토론합니다.", evidence: "최근 3개월 실거래" },
  { id: "price-2", category: "price", board: "저평가 찾기", tag: "단지 비교", title: "평당가가 낮으면 정말 저평가일까? 비교군부터 맞춰봅시다", summary: "입주연도와 면적이 다른 단지를 섞지 않고 비교군을 고르는 기준을 공유합니다.", evidence: "유사 면적 ±15%" },
  { id: "market-1", category: "market", board: "거래량·매물", tag: "시장 읽기", title: "가격보다 거래량이 먼저 움직이는 구간을 어떻게 볼까", summary: "직전 분기와 최근 분기의 체결 건수를 비교해 회복 신호와 일시 반등을 구분합니다.", evidence: "분기 거래량 비교" },
  { id: "market-2", category: "market", board: "정책·세금", tag: "정책 해석", title: "정책 발표를 호재·악재로 단정하기 전에 볼 세 가지", summary: "대상 지역, 시행 시점, 실제 자금 부담으로 나눠 내 상황에 미치는 영향을 검증합니다.", evidence: "정부 공식 원문 필수" },
  { id: "location-1", category: "location", board: "임장기", tag: "현장 기록", title: "지도에서는 안 보였던 출퇴근·소음·경사, 이렇게 기록하세요", summary: "시간대별 이동과 생활 동선을 같은 형식으로 남겨 다른 사람의 임장기와 비교합니다.", evidence: "방문 시각·동선 표기" },
  { id: "location-2", category: "location", board: "학군", tag: "생활 가치", title: "학교 거리와 단지 가격 프리미엄을 같이 보는 방법", summary: "직선거리보다 실제 통학 동선과 배정 가능성을 먼저 확인하는 체크리스트입니다.", evidence: "공식 배정·학교정보 확인" },
  { id: "invest-1", category: "invest", board: "전월세", tag: "현금흐름", title: "표면 수익률보다 보유비용을 넣은 순수익률로 비교합시다", summary: "공실·수선·세금·이자를 포함해 월세 투자 후보의 실제 현금흐름을 계산합니다.", evidence: "비용 가정 공개" },
  { id: "invest-2", category: "invest", board: "갭투자", tag: "리스크 점검", title: "갭이 작아도 위험할 수 있는 단지의 공통점", summary: "역전세 가능성, 입주 물량, 전세 거래 깊이를 함께 보고 레버리지 위험을 토론합니다.", evidence: "전세·매매 동시 비교" },
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

function loadNaverMap(clientId: string) {
  if (window.naver?.maps) return Promise.resolve();
  if (window.__jipgapsNaverMap) return window.__jipgapsNaverMap;
  window.__jipgapsNaverMap = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true; script.defer = true; script.dataset.jipgapsNaverMap = "true";
    script.onload = () => window.naver?.maps ? resolve() : reject(new Error("지도 SDK 초기화 실패"));
    script.onerror = () => reject(new Error("지도 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return window.__jipgapsNaverMap;
}

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
      for (let i = 0; i < 5; i++) { const y = pad.top + plotH * i / 4; ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.fillStyle = "#667085"; ctx.fillText(compactPrice(max - (max - min) * i / 4), width - pad.right + 10, y + 4); }
      const labelStep = Math.max(1, Math.ceil(points.length / 7));
      points.forEach((point, index) => { if (index % labelStep === 0 || index === points.length - 1) { const x = xAt(index); ctx.strokeStyle = "#eef0f3"; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.fillStyle = "#667085"; ctx.textAlign = "center"; ctx.fillText(monthLabel(point.month), x, height - 8); } });
      const maxVolume = Math.max(...points.map((point) => point.volume), 1); const barW = Math.max(3, Math.min(18, plotW / points.length * .58));
      points.forEach((point, index) => { const x = xAt(index); const h = point.volume / maxVolume * volumeH; ctx.fillStyle = index && point.price < points[index - 1].price ? "#8ec5ff" : "#b8d9ff"; ctx.fillRect(x - barW / 2, height - pad.bottom - h, barW, h); });
      const renderLine = (field: "price" | "average", color: string, widthLine: number) => { ctx.beginPath(); points.forEach((point, index) => { const x = xAt(index); const y = yAt(point[field]); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); };
      renderLine("average", "#8b95a5", 1.5); renderLine("price", "#0071e3", 2.3);
      const active = hover ?? points.length - 1; const point = points[active]; const x = xAt(active); const y = yAt(point.price);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "#9aa8ba88"; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#0071e3"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
      const tag = compactPrice(point.price); ctx.fillStyle = "#0071e3"; ctx.fillRect(width - pad.right + 4, y - 11, 64, 22); ctx.fillStyle = "#fff"; ctx.font = "700 11px ui-monospace"; ctx.textAlign = "center"; ctx.fillText(tag, width - pad.right + 36, y + 4);
      const boxW = 166; const boxX = Math.min(width - pad.right - boxW - 8, Math.max(pad.left + 8, x + (x > width / 2 ? -boxW - 14 : 14))); const boxY = pad.top + 8;
      ctx.fillStyle = "#fffffff5"; ctx.strokeStyle = "#dfe3e8"; ctx.lineWidth = 1; ctx.fillRect(boxX, boxY, boxW, 66); ctx.strokeRect(boxX, boxY, boxW, 66);
      ctx.textAlign = "left"; ctx.fillStyle = "#667085"; ctx.font = "10px sans-serif"; ctx.fillText(`${point.month} · 거래 ${point.volume}건`, boxX + 11, boxY + 17); ctx.fillStyle = "#1d1d1f"; ctx.font = "700 13px sans-serif"; ctx.fillText(formatPrice(point.price), boxX + 11, boxY + 38); ctx.fillStyle = "#667085"; ctx.font = "10px sans-serif"; ctx.fillText(`3개월 이동평균 ${formatPrice(point.average)}`, boxX + 11, boxY + 56);
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(host); return () => observer.disconnect();
  }, [points, hover, unit]);

  return <canvas ref={canvasRef} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const plotWidth = rect.width - 87; const index = Math.round(((event.clientX - rect.left - 15) / plotWidth) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, index))); }} onPointerLeave={() => setHover(null)} aria-label="월별 실거래 중위가격과 거래량 차트" />;
}

function NaverPlaceMap({ location, title, places }: { location: PropertyLocation; title: string; places: NearbyPlace[] }) {
  const hostRef = useRef<HTMLDivElement>(null); const [mapError, setMapError] = useState("");
  useEffect(() => {
    const host = hostRef.current; const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID; let disposed = false; let map: NaverMapInstance | null = null; const overlays: NaverOverlayInstance[] = [];
    if (!host || !clientId) return;
    loadNaverMap(clientId).then(() => {
      if (disposed || !window.naver?.maps) return;
      const maps = window.naver.maps; const center = new maps.LatLng(location.lat, location.lng);
      map = new maps.Map(host, { center, zoom: 15, minZoom: 11, zoomControl: true, scaleControl: false, mapDataControl: false });
      overlays.push(new maps.Circle({ map, center, radius: 1000, strokeColor: "#0071e3", strokeOpacity: .34, strokeWeight: 1, fillColor: "#0071e3", fillOpacity: .035 }));
      overlays.push(new maps.Circle({ map, center, radius: 500, strokeColor: "#0071e3", strokeOpacity: .72, strokeWeight: 2, fillColor: "#0071e3", fillOpacity: .065 }));
      overlays.push(new maps.Marker({ position: center, map, title, icon: { content: `<div class="nearby-home-pin"><b>${escapeMapHtml(title)}</b><span>선택 단지</span></div>`, anchor: new maps.Point(42, 42) }, zIndex: 100 }));
      const colors: Record<string, string> = { "교통": "#7c3aed", "교육": "#2563eb", "의료": "#dc2626", "장보기": "#059669", "여가": "#d97706" };
      places.slice(0, 24).forEach((place) => { const position = new maps.LatLng(place.lat, place.lng); overlays.push(new maps.Marker({ position, map, title: `${place.name} · ${place.distance}m`, icon: { content: `<div class="nearby-place-pin" style="--pin:${colors[place.category] || "#526173"}"><i></i><b>${escapeMapHtml(place.name)}</b><span>${place.distance}m</span></div>`, anchor: new maps.Point(12, 12) }, zIndex: Math.max(10, 70 - Math.round(place.distance / 30)) })); });
      setMapError("");
    }).catch((error) => { if (!disposed) setMapError(error instanceof Error ? error.message : "지도를 표시하지 못했습니다."); });
    return () => { disposed = true; overlays.forEach((overlay) => overlay.setMap(null)); map?.destroy?.(); };
  }, [location.lat, location.lng, places, title]);
  return <div className="naver-map-frame"><div ref={hostRef} className="naver-map-canvas" role="img" aria-label={`${title}와 주변 생활시설 네이버 지도`} />{mapError && <div className="naver-map-error"><b>지도 표시를 확인해주세요.</b><span>{mapError}</span></div>}</div>;
}

function escapeMapHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function legalDongName(value: string) {
  return value.replace(/(?:본|\d+)동$/, "동");
}

function geoJsonExtent(data: GeoJsonFeatureCollection) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      minLng = Math.min(minLng, value[0]); maxLng = Math.max(maxLng, value[0]); minLat = Math.min(minLat, value[1]); maxLat = Math.max(maxLat, value[1]); return;
    }
    value.forEach(walk);
  };
  data.features.forEach((feature) => walk(feature.geometry.coordinates));
  return Number.isFinite(minLng) ? { minLng, minLat, maxLng, maxLat } : null;
}

function NaverMarketMap({ markets, focus, selectedSido, activeRegion, selectedDong, selectedBoundaryDong, dongVolumes, propertyLocation, propertyName, onSelectSido, onSelectRegion, onSelectDong }: {
  markets: OverviewMarket[];
  focus: MapFocus;
  selectedSido: string;
  activeRegion: Region;
  selectedDong: string;
  selectedBoundaryDong: string;
  dongVolumes: Record<string, number>;
  propertyLocation: PropertyLocation | null;
  propertyName: string;
  onSelectSido: (sido: string) => void;
  onSelectRegion: (region: Region) => void;
  onSelectDong: (dong: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");
  const stageTitle = focus === "national" ? "대한민국 16개 시·도" : focus === "sido" ? selectedSido : focus === "detail" ? propertyName || "선택 단지" : `${activeRegion.sido} ${activeRegion.sigungu}${selectedBoundaryDong ? ` · ${selectedBoundaryDong}` : ""}`;
  const stageHint = focus === "national" ? "시·도 경계를 눌러 다음 단계로 들어가세요." : focus === "sido" ? "시·군·구 경계를 눌러 읍·면·동 지도로 확대하세요." : focus === "detail" ? "선택한 단지의 실제 주소 좌표입니다." : selectedBoundaryDong ? `${legalDongName(selectedBoundaryDong)} 실거래 조건과 연동했습니다.` : "읍·면·동 경계를 누르면 실거래 목록이 함께 바뀝니다.";

  useEffect(() => {
    const host = hostRef.current;
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    const controller = new AbortController();
    let disposed = false;
    let map: NaverMapInstance | null = null;
    const markers: NaverMarkerInstance[] = [];
    const listeners: NaverEventListener[] = [];
    if (!host) return;
    if (!clientId) {
      const timer = window.setTimeout(() => setMapError("네이버 지도 클라이언트 ID가 연결되지 않았습니다."), 0);
      return () => window.clearTimeout(timer);
    }

    const readGeoJson = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("행정경계 데이터를 불러오지 못했습니다.");
      return response.json() as Promise<GeoJsonFeatureCollection>;
    };

    loadNaverMap(clientId).then(async () => {
      if (disposed || !window.naver?.maps) return;
      const maps = window.naver.maps;
      const province = SIDO_CENTERS[selectedSido] || { lat: 36.35, lng: 127.85, zoom: 8 };
      const initial = focus === "national" ? { lat: 36.35, lng: 127.85, zoom: 7 } : focus === "detail" && propertyLocation ? { lat: propertyLocation.lat, lng: propertyLocation.lng, zoom: 17 } : province;
      map = new maps.Map(host, { center: new maps.LatLng(initial.lat, initial.lng), zoom: initial.zoom, minZoom: 6, maxZoom: 20, zoomControl: true, zoomControlOptions: { position: maps.Position.TOP_RIGHT }, scaleControl: true, mapDataControl: false, logoControlOptions: { position: maps.Position.BOTTOM_LEFT } });

      const addMarkerListener = (marker: NaverMarkerInstance, listener: () => void) => {
        listeners.push(maps.Event.addListener(marker, "click", listener));
      };
      const fitCollection = (data: GeoJsonFeatureCollection) => {
        const extent = geoJsonExtent(data); if (!extent || !map) return;
        const bounds = new maps.LatLngBounds(new maps.LatLng(extent.minLat, extent.minLng), new maps.LatLng(extent.maxLat, extent.maxLng));
        map.fitBounds?.(bounds, { top: 76, right: 34, bottom: 34, left: 34 });
      };
      const makeMarketMarker = (market: OverviewMarket, selected: boolean) => {
        const position = SIDO_CENTERS[market.sido];
        if (!position || !map) return;
        const tone = market.change > 1 ? "hot" : market.change < -1 ? "cold" : "flat";
        const change = `${market.change >= 0 ? "+" : ""}${market.change.toFixed(1)}%`;
        const marker = new maps.Marker({
          position: new maps.LatLng(position.lat, position.lng), map, title: `${market.sido} ${change}`,
          icon: { content: `<div class="naver-market-pin ${tone}${selected ? " selected" : ""}"><span>${escapeMapHtml(market.short)}</span><strong>${change}</strong></div>`, anchor: new maps.Point(34, 23) },
          zIndex: selected ? 100 : 10,
        });
        markers.push(marker); addMarkerListener(marker, () => onSelectSido(market.sido));
      };

      if (focus === "national") {
        const boundaries = await readGeoJson("/data/boundaries/sido.json");
        if (disposed || !map) return;
        map.data.addGeoJson(boundaries);
        map.data.setStyle((feature) => { const selected = String(feature.getProperty("name") || "") === selectedSido; return { fillColor: selected ? "#0071e3" : "#8ec5ff", fillOpacity: selected ? 0.34 : 0.14, strokeColor: selected ? "#0071e3" : "#6d91b8", strokeWeight: selected ? 3 : 1.4, strokeOpacity: 0.95, clickable: true }; });
        listeners.push(maps.Event.addListener(map.data, "click", (event) => { const name = String(event.feature?.getProperty("name") || ""); if (name) onSelectSido(name); }));
        markets.forEach((market) => makeMarketMarker(market, market.sido === selectedSido));
        fitCollection(boundaries);
        setMapError("");
        return;
      }

      if (focus === "detail" && propertyLocation && map) {
        const position = new maps.LatLng(propertyLocation.lat, propertyLocation.lng);
        markers.push(new maps.Marker({ position, map, title: propertyName, icon: { content: `<div class="naver-property-pin"><i></i><span>${escapeMapHtml(propertyName || "선택 단지")}</span></div>`, anchor: new maps.Point(17, 38) } }));
        setMapError("");
        return;
      }

      if (focus === "sido" && map) {
        const sidoCode = SIDO_CODES[selectedSido];
        if (!sidoCode) throw new Error("선택한 시·도의 경계 코드를 찾지 못했습니다.");
        const districts = await readGeoJson(`/data/boundaries/sgg/${sidoCode}.json`);
        if (disposed || !map) return;
        const features = map.data.addGeoJson(districts);
        map.data.setStyle((feature) => {
          const code = String(feature.getProperty("code") || ""); const selected = activeRegion.sido === selectedSido && code === activeRegion.code;
          return { fillColor: selected ? "#0071e3" : "#b8d9ff", fillOpacity: selected ? 0.34 : 0.16, strokeColor: selected ? "#0071e3" : "#7194b8", strokeWeight: selected ? 3 : 1.25, strokeOpacity: 0.9, clickable: true };
        });
        listeners.push(maps.Event.addListener(map.data, "click", (event) => {
          const code = String(event.feature?.getProperty("code") || ""); const region = REGIONS.find((item) => item.code === code); if (region) onSelectRegion(region);
        }));
        features.forEach((feature) => { const code = String(feature.getProperty("code") || ""); const name = String(feature.getProperty("name") || ""); const center = feature.getBounds?.().getCenter(); const region = REGIONS.find((item) => item.code === code); if (!center || !region || !map) return; const marker = new maps.Marker({ position: center, map, title: name, icon: { content: `<div class="naver-sigungu-label">${escapeMapHtml(name)}</div>`, anchor: new maps.Point(28, 12) }, zIndex: 20 }); markers.push(marker); addMarkerListener(marker, () => onSelectRegion(region)); });
        fitCollection(districts);
        setMapError("");
        return;
      }

      if (focus === "district" && map) {
        const dongs = await readGeoJson(`/data/boundaries/emd/${activeRegion.code}.json`);
        if (disposed || !map) return;
        const dongFeatures = map.data.addGeoJson(dongs);
        map.data.setStyle((feature) => {
          const name = String(feature.getProperty("name") || "");
          const selected = selectedBoundaryDong ? name === selectedBoundaryDong : selectedDong !== "all" && legalDongName(name) === selectedDong;
          return { fillColor: selected ? "#0071e3" : "#cfe6ff", fillOpacity: selected ? 0.42 : 0.18, strokeColor: selected ? "#0071e3" : "#7596b8", strokeWeight: selected ? 2.5 : 1.1, strokeOpacity: 0.88, clickable: true };
        });
        dongFeatures.forEach((feature) => {
          const name = String(feature.getProperty("name") || ""); const center = feature.getBounds?.().getCenter(); if (!name || !center || !map) return;
          const legalDong = legalDongName(name); const volume = dongVolumes[legalDong] || 0; const selected = selectedBoundaryDong ? name === selectedBoundaryDong : selectedDong !== "all" && legalDong === selectedDong;
          const marker = new maps.Marker({ position: center, map, title: `${name} · 최근 3개월 ${volume}건`, icon: { content: `<div class="naver-dong-label${selected ? " selected" : ""}"><b>${escapeMapHtml(name)}</b><span>${volume}건</span></div>`, anchor: new maps.Point(28, 15) }, zIndex: selected ? 80 : 20 });
          markers.push(marker); addMarkerListener(marker, () => onSelectDong(name));
        });
        listeners.push(maps.Event.addListener(map.data, "click", (event) => { const name = String(event.feature?.getProperty("name") || ""); if (name) onSelectDong(name); }));
        fitCollection(dongs);
        setMapError("");
        return;
      }
      setMapError("");
    }).catch((error) => { if (!disposed && (!(error instanceof Error) || error.name !== "AbortError")) setMapError(error instanceof Error ? error.message : "지도를 표시하지 못했습니다."); });

    return () => {
      disposed = true; controller.abort(); listeners.forEach((listener) => window.naver?.maps.Event.removeListener(listener)); markers.forEach((marker) => marker.setMap(null)); map?.destroy?.();
    };
  }, [activeRegion.code, activeRegion.sigungu, activeRegion.sido, dongVolumes, focus, markets, onSelectDong, onSelectRegion, onSelectSido, propertyLocation, propertyName, selectedBoundaryDong, selectedDong, selectedSido]);

  return <div className="naver-market-map">
    <div ref={hostRef} className="naver-market-canvas" aria-label={`${stageTitle} 네이버 지도`} />
    <div className="map-stage-card"><span>{focus === "national" ? "NATIONAL" : focus === "sido" ? "CITY · PROVINCE" : focus === "district" ? "DISTRICT" : "PROPERTY"}</span><b>{stageTitle}</b><small>{stageHint}</small></div>
    {focus === "national" && !markets.length && <div className="map-loading"><i />전국 시장 표식을 계산하는 중…</div>}
    {mapError && <div className="naver-market-error" role="status"><b>지도를 표시하지 못했습니다.</b><span>{mapError}</span></div>}
  </div>;
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
  const [activeSection, setActiveSection] = useState("home"); const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0 });
  const [selectedMapSido, setSelectedMapSido] = useState("서울특별시"); const [mapFocus, setMapFocus] = useState<MapFocus>("district"); const [selectedBoundaryDong, setSelectedBoundaryDong] = useState("");
  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([]);
  const [fieldGroup, setFieldGroup] = useState(FIELD_GROUPS[0]); const [fieldFeatureId, setFieldFeatureId] = useState("region");
  const [commuteDestination, setCommuteDestination] = useState(""); const [lifestyleKeyword, setLifestyleKeyword] = useState("마트");
  const [researchCategory, setResearchCategory] = useState("price"); const [researchTool, setResearchTool] = useState("recent-fall");
  const [communityCategory, setCommunityCategory] = useState("living"); const [communityBoard, setCommunityBoard] = useState("전체");
  const [showStudyWriter, setShowStudyWriter] = useState(false); const [studyTitle, setStudyTitle] = useState(""); const [studyBody, setStudyBody] = useState(""); const [draftSaved, setDraftSaved] = useState(false);
  const [propertyLocation, setPropertyLocation] = useState<PropertyLocation | null>(null); const [locationLoading, setLocationLoading] = useState(false); const [locationError, setLocationError] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]); const [nearbyLoading, setNearbyLoading] = useState(false); const [nearbyError, setNearbyError] = useState(""); const [nearbyCategory, setNearbyCategory] = useState("전체");
  const activeRegion = REGIONS.find((item) => item.code === regionCode) || REGIONS[0];

  useEffect(() => { const timer = window.setTimeout(() => { try { const stored = window.localStorage.getItem("jipgaps:saved-homes"); if (stored) setSavedHomes(JSON.parse(stored)); const draft = window.localStorage.getItem("jipgaps:study-draft"); if (draft) { const parsed = JSON.parse(draft); setStudyTitle(parsed.title || ""); setStudyBody(parsed.body || ""); } } catch { /* device storage is optional */ } }, 0); return () => window.clearTimeout(timer); }, []);

  useEffect(() => { const syncHash = () => { const next = window.location.hash.slice(1); if (NAV_ITEMS.some((item) => item.id === next)) setActiveSection(next); }; syncHash(); window.addEventListener("hashchange", syncHash); return () => window.removeEventListener("hashchange", syncHash); }, []);

  useEffect(() => {
    const nav = navRef.current; const link = nav?.querySelector<HTMLAnchorElement>(`a[data-view="${activeSection}"]`); if (!nav || !link) return;
    const updateIndicator = () => setNavIndicator({ left: link.offsetLeft, width: link.offsetWidth });
    updateIndicator(); const observer = new ResizeObserver(updateIndicator); observer.observe(nav); return () => observer.disconnect();
  }, [activeSection]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError(""); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all");
      const params = new URLSearchParams({ type, lawd: regionCode, months: String(Math.max(period, 6)), query: submittedQuery });
      fetch(`/api/trades?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "실거래가를 불러오지 못했습니다."); return data; }).then((data) => { setTrades(data.trades); setProperties(data.properties); if (data.properties.length === 1) setSelectedKey(data.properties[0].key); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
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
  const latestQuarterMonths = useMemo(() => [0, -1, -2].map((offset) => shiftMonth(latestMonth, offset)), [latestMonth]); const previousQuarterMonths = useMemo(() => [-3, -4, -5].map((offset) => shiftMonth(latestMonth, offset)), [latestMonth]);
  const propertyRows = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    scopedTrades.forEach((trade) => { const bucket = areaBucket(trade.area); const key = `${trade.propertyKey}|${trade.buildingDong || "-"}|${bucket}`; groups.set(key, [...(groups.get(key) || []), trade]); });
    return [...groups].map(([key, rows]) => {
      const sample = rows.at(-1)!; const quarterRows = rows.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7))); const previousRows = rows.filter((trade) => previousQuarterMonths.includes(trade.date.slice(0, 7)));
      const quarterValues = quarterRows.map((trade) => trade.amount); const previousValues = previousRows.map((trade) => trade.amount); const current = quarterValues.length ? median(quarterValues) : sample.amount; const before = previousValues.length ? median(previousValues) : 0;
      const comparable = quarterValues.length >= 2 && previousValues.length >= 2; return { key, propertyKey: sample.propertyKey, name: sample.name, dong: sample.dong, jibun: sample.jibun, buildingDong: sample.buildingDong, areaBucket: areaBucket(sample.area), areaMedian: median(rows.map((trade) => trade.area).filter(Boolean)), count: rows.length, current, change: comparable && before ? (current / before - 1) * 100 : null, quarterCount: quarterValues.length };
    }).sort((a, b) => b.quarterCount - a.quarterCount || b.count - a.count);
  }, [scopedTrades, latestQuarterMonths, previousQuarterMonths]);
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
  const activeResearchCategory = RESEARCH_CATEGORIES.find((category) => category.id === researchCategory) || RESEARCH_CATEGORIES[0];
  const activeResearchTool = RESEARCH_CATEGORIES.flatMap((category) => category.tools).find((tool) => tool.id === researchTool) || RESEARCH_CATEGORIES[0].tools[0];
  const researchRows = useMemo(() => {
    const scoreIndex = new Map(scoredCandidates.map((row) => [row.key, row]));
    const base = propertyRows.map((row) => { const scored = scoreIndex.get(row.key); return { ...row, score: scored?.score || 0, gap: scored?.gap || 0, tag: scored?.tag || "분석 후보" }; });
    const comparable = base.filter((row) => row.change !== null);
    const rows = researchTool === "recent-fall" ? comparable.filter((row) => (row.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
      : researchTool === "record-high" ? base.sort((a, b) => b.current - a.current)
      : researchTool === "top-rise" ? comparable.sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      : researchTool === "price-change" ? comparable.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
      : researchTool === "price-compare" ? base.sort((a, b) => a.gap - b.gap)
      : researchTool === "multi-compare" ? base.sort((a, b) => b.score - a.score || b.quarterCount - a.quarterCount)
      : researchTool === "sentiment" ? comparable.sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      : base.sort((a, b) => b.quarterCount - a.quarterCount || b.count - a.count);
    return rows.slice(0, 8);
  }, [propertyRows, scoredCandidates, researchTool]);
  const activeCommunityCategory = COMMUNITY_CATEGORIES.find((category) => category.id === communityCategory) || COMMUNITY_CATEGORIES[0];
  const visibleCommunityGuides = COMMUNITY_GUIDES.filter((guide) => guide.category === communityCategory && (communityBoard === "전체" || guide.board === communityBoard));
  const selectedProperty = properties.find((property) => property.key === selectedKey); const selectedVariant = propertyRows.find((property) => property.key === selectedVariantKey); const variantSuffix = selectedVariant ? `${dongLabel(selectedVariant.buildingDong)}${selectedVariant.buildingDong ? " · " : ""}전용 ${selectedVariant.areaBucket}평` : ""; const displayName = selectedProperty ? `${selectedProperty.name}${variantSuffix ? ` · ${variantSuffix}` : ""}` : (submittedQuery ? `${submittedQuery} 검색 결과` : `${activeRegion.sigungu} 전체`);
  const placePropertyKey = selectedProperty?.key || ""; const placePropertyName = selectedProperty?.name || ""; const placePropertyDong = selectedProperty?.dong || ""; const placeRegion = `${activeRegion.sido} ${activeRegion.sigungu}`; const placeAddressQuery = `${placeRegion} ${placePropertyDong} ${selectedProperty?.jibun || placePropertyName}`.replace(/\s+/g, " ").trim();
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!placePropertyKey) { setPropertyLocation(null); setLocationError(""); setLocationLoading(false); return; }
      setLocationLoading(true); setLocationError("");
      fetch(`/api/geocode?query=${encodeURIComponent(placeAddressQuery)}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "단지 위치를 확인하지 못했습니다."); return data; }).then((data) => setPropertyLocation({ lat: data.lat, lng: data.lng, roadAddress: data.roadAddress || "", jibunAddress: data.jibunAddress || "" })).catch((reason) => { if (reason.name !== "AbortError") { setLocationError(reason.message); setPropertyLocation(null); } }).finally(() => { if (!controller.signal.aborted) setLocationLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [placePropertyKey, placeAddressQuery]);
  useEffect(() => {
    const controller = new AbortController(); const timer = window.setTimeout(() => {
      if (!propertyLocation) { setNearbyPlaces([]); setNearbyError(""); return; }
      setNearbyLoading(true); setNearbyError(""); setNearbyCategory("전체");
      fetch(`/api/nearby?lat=${propertyLocation.lat}&lng=${propertyLocation.lng}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "주변 시설을 불러오지 못했습니다."); return data; }).then((data) => setNearbyPlaces(data.places || [])).catch((reason) => { if (reason.name !== "AbortError") setNearbyError(reason.message); }).finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [propertyLocation]);
  const latestQuarterTrades = scopedTrades.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7)));
  const nearbyCategories = ["전체", ...[...new Set(nearbyPlaces.map((place) => place.category))]]; const visibleNearbyPlaces = nearbyCategory === "전체" ? nearbyPlaces : nearbyPlaces.filter((place) => place.category === nearbyCategory);
  const risingCount = propertyRows.filter((property) => property.change !== null && property.change > 0).length; const fallingCount = propertyRows.filter((property) => property.change !== null && property.change < 0).length;
  const visibleProperties = useMemo(() => propertyRows.filter((property) => property.quarterCount >= minVolume).sort((a, b) => buildingSort === "price" ? b.current - a.current : buildingSort === "rise" ? (b.change ?? -Infinity) - (a.change ?? -Infinity) : buildingSort === "fall" ? (a.change ?? Infinity) - (b.change ?? Infinity) : b.quarterCount - a.quarterCount), [propertyRows, buildingSort, minVolume]);
  const sortedMarkets = useMemo(() => [...markets].sort((a, b) => marketSort === "price" ? b.median - a.median : marketSort === "rise" ? b.change - a.change : marketSort === "fall" ? a.change - b.change : b.count - a.count), [markets, marketSort]);
  const nationalDeals = markets.reduce((sum, market) => sum + market.count, 0); const activeMarkets = markets.filter((market) => market.median > 0); const nationalMedian = activeMarkets.length ? median(activeMarkets.map((market) => market.median)) : 0; const nationalChange = nationalDeals ? markets.reduce((sum, market) => sum + market.change * market.count, 0) / nationalDeals : 0;
  const sidoOptions = useMemo(() => SIDO_ORDER.filter((sido) => REGIONS.some((region) => region.sido === sido)), []);
  const sigunguOptions = useMemo(() => REGIONS.filter((region) => region.sido === activeRegion.sido).sort(sortRegions), [activeRegion.sido]);
  const mapDistricts = useMemo(() => REGIONS.filter((region) => region.sido === selectedMapSido).sort(sortRegions), [selectedMapSido]);
  const dongOptions = useMemo(() => [...new Set(trades.map((trade) => trade.dong).filter(Boolean))].sort(), [trades]);
  const mapDongVolumes = useMemo(() => { const counts: Record<string, number> = {}; trades.forEach((trade) => { if (trade.dong && latestQuarterMonths.includes(trade.date.slice(0, 7))) counts[trade.dong] = (counts[trade.dong] || 0) + 1; }); return counts; }, [trades, latestQuarterMonths]);
  const targetTrade = filteredTrades.at(-1); const targetArea = area === "all" ? targetTrade?.area || 0 : Number(area);
  const subjectPerPy = filteredTrades.filter((trade) => trade.area > 0 && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15)).slice(-20).map((trade) => trade.amount / (trade.area / 3.3058));
  const latestPeers = scopedTrades.filter((trade) => trade.propertyKey !== selectedKey && trade.area > 0 && trade.date.startsWith(latestMonth) && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15));
  const fallbackPeers = scopedTrades.filter((trade) => trade.propertyKey !== selectedKey && trade.area > 0 && (!targetArea || Math.abs(trade.area - targetArea) / targetArea <= .15));
  const peerRows = latestPeers.length >= 5 ? latestPeers : fallbackPeers.slice(-200); const peerPerPy = peerRows.map((trade) => trade.amount / (trade.area / 3.3058));
  const subjectPyeongPrice = subjectPerPy.length ? median(subjectPerPy) : 0; const peerPyeongPrice = peerPerPy.length ? median(peerPerPy) : 0; const valuationGap = peerPyeongPrice ? (subjectPyeongPrice / peerPyeongPrice - 1) * 100 : 0;
  const fairPrice = targetArea && peerPyeongPrice ? peerPyeongPrice * (targetArea / 3.3058) : 0; const valuationScore = peerPyeongPrice ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(valuationGap) * 2))) : 0; const valuationLabel = valuationGap <= -5 ? "저평가 구간" : valuationGap >= 5 ? "고평가 구간" : "적정가격 구간";
  const selectedOpportunity = scoredCandidates.find((candidate) => candidate.key === selectedVariantKey); const isSaved = selectedOpportunity ? savedHomes.some((home) => home.id === `${regionCode}|${selectedOpportunity.key}`) : false;
  const activeFieldFeature = FIELD_FEATURES.find((feature) => feature.id === fieldFeatureId) || FIELD_FEATURES[0];
  const fieldGroupFeatures = FIELD_FEATURES.filter((feature) => feature.group === fieldGroup);
  const fieldMapQuery = `${activeRegion.sido} ${activeRegion.sigungu} ${selectedDong !== "all" ? selectedDong : ""} ${selectedProperty?.name || ""}`.replace(/\s+/g, " ").trim();
  const fieldMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(fieldMapQuery)}`;
  const commuteUrl = commuteDestination.trim() ? `https://map.naver.com/p/search/${encodeURIComponent(`${fieldMapQuery} ${commuteDestination.trim()} 길찾기`)}` : "";
  const chooseRegion = useCallback((region: Region, scrollToTop = true) => { setRegionCode(region.code); setRegionInput(`${region.sido} ${region.sigungu}`); setSelectedMapSido(region.sido); setMapFocus("district"); setSelectedBoundaryDong(""); setSelectedDong("all"); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setSubmittedQuery(""); setQuery(""); if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const chooseMapSido = useCallback((sido: string) => { setSelectedMapSido(sido); setMapFocus("sido"); setSelectedBoundaryDong(""); }, []);
  const chooseMapRegion = useCallback((region: Region) => chooseRegion(region, false), [chooseRegion]);
  const chooseMapDong = useCallback((dong: string) => { const legalDong = legalDongName(dong); setSelectedBoundaryDong(dong); if (dongOptions.includes(legalDong)) { setSelectedDong(legalDong); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); } }, [dongOptions]);
  const openGangnamMap = useCallback(() => { const gangnam = REGIONS.find((region) => region.code === "11680"); if (gangnam) chooseRegion(gangnam, false); }, [chooseRegion]);
  const openHaengdangMap = useCallback(() => { const seongdong = REGIONS.find((region) => region.code === "11200"); if (seongdong) { chooseRegion(seongdong, false); setSelectedDong("행당동"); } }, [chooseRegion]);
  const selectSido = (sido: string) => { const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0]; if (next) chooseRegion(next); };
  const selectSigungu = (code: string) => { const next = REGIONS.find((region) => region.code === code); if (next) chooseRegion(next); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const exactRegion = REGIONS.find((item) => `${item.sido} ${item.sigungu}` === regionInput); if (exactRegion) setRegionCode(exactRegion.code); setSubmittedQuery(query.trim()); };
  const changeView = (view: string) => { setActiveSection(view); window.history.replaceState(null, "", `#${view}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const selectCandidate = (candidate: { propertyKey: string; buildingDong: string; areaBucket: number; key: string }) => { setSelectedKey(candidate.propertyKey); setSelectedBuildingDong(candidate.buildingDong); setSelectedAreaBucket(candidate.areaBucket); setSelectedVariantKey(candidate.key); setArea("all"); changeView("chart"); };
  const toggleSavedHome = () => { if (!selectedOpportunity) return; const id = `${regionCode}|${selectedOpportunity.key}`; const next = isSaved ? savedHomes.filter((home) => home.id !== id) : [...savedHomes, { id, name: selectedOpportunity.name, region: `${activeRegion.sido} ${activeRegion.sigungu}`, area: selectedOpportunity.areaBucket, price: selectedOpportunity.current, score: selectedOpportunity.score, savedAt: new Date().toISOString() }].slice(-6); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } };
  const researchMetric = (row: typeof researchRows[number]) => researchTool === "record-high" ? formatPrice(row.current) : researchTool === "price-compare" ? `${row.gap >= 0 ? "+" : ""}${row.gap.toFixed(1)}%` : researchTool === "multi-compare" ? `${row.score}점` : researchTool === "most-bought" || researchTool === "volume" ? `${row.quarterCount}건` : `${(row.change ?? 0) >= 0 ? "+" : ""}${(row.change ?? 0).toFixed(1)}%`;
  const saveStudyDraft = (event: React.FormEvent) => { event.preventDefault(); if (!studyTitle.trim() || !studyBody.trim()) return; try { window.localStorage.setItem("jipgaps:study-draft", JSON.stringify({ category: activeCommunityCategory.label, board: communityBoard === "전체" ? activeCommunityCategory.boards[1] : communityBoard, title: studyTitle.trim(), body: studyBody.trim(), savedAt: new Date().toISOString() })); setDraftSaved(true); } catch { setDraftSaved(false); } };

  return <main className="terminal-shell" data-view={activeSection}>
    <header className="topbar"><a href="#home" className="brand" onClick={(event) => { event.preventDefault(); changeView("home"); }}><span>집값</span>의 정석 <em>PRO</em></a><nav ref={navRef}>{NAV_ITEMS.map((item) => <a key={item.id} data-view={item.id} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>{item.label}</a>)}<i className="nav-indicator" style={{ left: navIndicator.left, width: navIndicator.width }} /></nav><button className="saved-badge" onClick={() => changeView("chart")}>관심 후보 <b>{savedHomes.length}</b></button><div className="live"><i /> 실거래 연동</div></header>
    {activeSection !== "home" && <div className="screen-context"><div><span>{NAV_ITEMS.find((item) => item.id === activeSection)?.label}</span><b>{activeRegion.sido} · {activeRegion.sigungu}{selectedDong !== "all" ? ` · ${selectedDong}` : ""}</b></div><button onClick={() => changeView("home")}>지역·주택 다시 선택</button></div>}
    <section className="command app-view view-home" id="top">
      <div className="hero-copy"><div><p>KOREA REAL ESTATE INTELLIGENCE</p><h1>사는 집도, 투자하는 집도<br/><span>숫자로 먼저 고르세요.</span></h1><b>전국 실거래를 분기 단위로 비교하고, 평형별 가격 매력과 거래 흐름까지 한 번에 확인합니다.</b></div><div className="hero-proof"><span><i>01</i>실거래 원문 기반</span><span><i>02</i>동·평형 단위 비교</span><span><i>03</i>판단 근거 공개</span></div></div>
      <div className="finder-panel"><div className="finder-title"><div><span>어디를 보고 계세요?</span><b>지역과 주택 유형을 고르면 매수 후보를 바로 추립니다.</b></div><small>최근 3개월 기준</small></div><div className="type-tabs">{PROPERTY_TYPES.map((item) => <button key={item.key} className={type === item.key ? "active" : ""} onClick={() => { setType(item.key); setSelectedKey(""); setSelectedVariantKey(""); }}>{item.label}</button>)}</div>
      <form className="search-console" onSubmit={submitSearch}>
        <label><span>시·도</span><select value={activeRegion.sido} onChange={(event) => selectSido(event.target.value)} aria-label="시도 선택">{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={regionCode} onChange={(event) => selectSigungu(event.target.value)} aria-label="시군구 선택">{sigunguOptions.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={selectedDong} onChange={(event) => { setSelectedDong(event.target.value); setSelectedBoundaryDong(""); setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); }} aria-label="읍면동 선택"><option value="all">전체 읍·면·동</option>{dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}</select></label>
        <label className="property-search"><span>단지·건물명 · 비워두면 전체</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 행당대림, 서울숲리버뷰" aria-label="단지 또는 건물명" /></label>
        <button type="submit">시장 조회 <b>↗</b></button>
      </form>
      <div className="quick-regions"><span>인기 지역</span>{QUICK_REGIONS.map((quick) => <button key={quick.code} onClick={() => { const region = REGIONS.find((item) => item.code === quick.code); if (region) chooseRegion(region); }}>{quick.label}</button>)}</div><div className="scope-note"><span>{activeRegion.sido}</span><b>{activeRegion.sigungu}</b>{selectedDong !== "all" && <><i /><b>{selectedDong}</b></>}<i /> 선택 지역의 단지·동·평형을 같은 조건끼리 비교합니다.</div></div>
    </section>

    <section className="national-overview" id="national"><div><p>NATIONAL BUYING TEMPERATURE</p><h1>전국 3개월 온도판</h1><span>대표 권역의 최근 3개월과 직전 3개월 가격 방향을 비교합니다.</span></div><article><span>최근 3개월 표본 거래</span><strong>{markets.length ? nationalDeals.toLocaleString() : "집계 중"}{markets.length > 0 && <em>건</em>}</strong><small>{marketMonth || "공공데이터 확인 중"} 기준 대표 권역</small></article><article><span>전국 중위가격</span><strong>{markets.length ? formatPrice(nationalMedian) : "-"}</strong><small>16개 대표 권역 중위값</small></article><article><span>직전 3개월 대비</span><strong className={markets.length ? nationalChange >= 0 ? "up" : "down" : ""}>{markets.length ? `${nationalChange >= 0 ? "+" : ""}${nationalChange.toFixed(2)}%` : "-"}</strong><small>거래량 가중 변화율</small></article><a href="#map" onClick={(event) => { event.preventDefault(); changeView("map"); }}>전국 기회 찾기 →</a></section>

    <section className="monthly-board" id="market">
      <div className="month-intro"><p>QUARTERLY MARKET BRIEF</p><h1>{activeRegion.sigungu} 최근 3개월</h1><span>{PROPERTY_TYPES.find((item) => item.key === type)?.label} 실거래 신고 기준 · {latestQuarterMonths[2] || "-"} ~ {latestQuarterMonths[0] || "-"}</span></div>
      <article><span>분기 거래</span><strong>{latestQuarterTrades.length.toLocaleString()}<em>건</em></strong><small>전체 {trades.length.toLocaleString()}건 조회</small></article>
      <article><span>거래 건물</span><strong>{new Set(latestQuarterTrades.map((trade) => trade.propertyKey)).size.toLocaleString()}<em>곳</em></strong><small>최근 3개월 거래 건물</small></article>
      <article><span>상승 / 하락</span><strong className="split"><b>{risingCount}</b><i>/</i><em>{fallingCount}</em></strong><small>최근 3개월과 직전 3개월 비교</small></article>
      <article><span>분기 중위가격</span><strong>{formatPrice(median(latestQuarterTrades.map((trade) => trade.amount)))}</strong><small>고가·저가 왜곡을 줄인 값</small></article>
    </section>

    <section className="opportunity-section" aria-label="매수 검토 후보"><div className="opportunity-head"><div><p>SMART SHORTLIST</p><h2>{activeRegion.sigungu}에서 먼저 볼 후보</h2><span>평형별 가격 매력 45% · 거래량 35% · 가격 흐름 20%를 합산한 탐색 점수입니다.</span></div><b>추천이 아닌 검토 우선순위</b></div><div className="opportunity-grid">{loading ? <div className="opportunity-empty">후보를 계산하고 있습니다…</div> : scoredCandidates.length ? scoredCandidates.slice(0, 3).map((candidate, index) => <button key={candidate.key} onClick={() => selectCandidate(candidate)}><span className="candidate-rank">0{index + 1}</span><div><em>{candidate.tag}</em><h3>{candidate.name}</h3><p>{candidate.dong} · {dongLabel(candidate.buildingDong) || "동 정보 없음"} · 전용 {candidate.areaBucket}평</p></div><strong>{candidate.score}<small>/100</small><i>{formatPrice(candidate.current)}</i></strong></button>) : <div className="opportunity-empty"><b>이 지역은 아직 표본이 부족합니다.</b><span>아파트 또는 인기 지역을 선택하면 거래가 있는 후보를 빠르게 확인할 수 있습니다.</span></div>}</div>{savedHomes.length > 0 && <div className="saved-shelf"><span>내 관심 후보</span>{savedHomes.map((home) => <article key={home.id}><div><b>{home.name}</b><small>{home.region} · {home.area}평</small></div><strong>{home.score}점 · {formatPrice(home.price)}</strong><button aria-label={`${home.name} 관심 후보에서 삭제`} onClick={() => { const next = savedHomes.filter((item) => item.id !== home.id); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } }}>×</button></article>)}</div>}</section>

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
        <section className="facility-panel">
          <header><div><p>NEARBY LIFE MAP</p><h2>{selectedProperty ? `${selectedProperty.name}에서 얼마나 가까울까?` : "집 하나를 고르면 주변 생활권이 자동으로 열립니다"}</h2><span>{selectedProperty ? `${placeRegion} ${placePropertyDong} · 500m·1km 반경 안의 교통·교육·의료·장보기·여가 시설` : "왼쪽 목록에서 집을 선택하면 별도 검색 없이 주변 시설과 거리를 계산합니다."}</span></div>{selectedProperty && <div><b>{nearbyPlaces.length}<small>곳</small></b><span>1km 안 시설</span><em>자동 거리 계산</em></div>}</header>
          {selectedProperty ? <div className="facility-layout">
            <div className="facility-map">{locationLoading ? <div className="facility-state"><i />단지 좌표를 확인하고 있습니다.</div> : propertyLocation ? <><NaverPlaceMap location={propertyLocation} title={selectedProperty.name} places={visibleNearbyPlaces} /><span className="facility-address">{propertyLocation.roadAddress || propertyLocation.jibunAddress || placeAddressQuery}</span><div className="radius-key"><span><i />500m 생활권</span><span><i />1km 생활권</span></div></> : <div className="facility-state error"><b>지도 위치를 표시하지 못했습니다.</b><span>{locationError || "네이버 지도 API 권한을 확인해주세요."}</span></div>}</div>
            <div className="nearby-browser"><div className="nearby-tabs">{nearbyCategories.map((category) => <button key={category} className={nearbyCategory === category ? "active" : ""} onClick={() => setNearbyCategory(category)}>{category}<small>{category === "전체" ? nearbyPlaces.length : nearbyPlaces.filter((place) => place.category === category).length}</small></button>)}</div>{nearbyLoading ? <div className="nearby-state"><i />1km 안 생활시설을 찾고 있습니다.</div> : nearbyError ? <div className="nearby-state error"><b>주변 시설을 불러오지 못했습니다.</b><span>{nearbyError}</span></div> : visibleNearbyPlaces.length ? <div className="nearby-list">{visibleNearbyPlaces.map((place) => <article key={place.id}><em>{place.category}</em><div><b>{place.name}</b><span>{place.distance <= 500 ? "500m 생활권" : "1km 생활권"}</span></div><strong>{place.distance.toLocaleString()}m<small>직선거리</small></strong><p>도보 약 {place.walkingMinutes}분<small>경로 보정 추정</small></p></article>)}</div> : <div className="nearby-state"><b>이 범위에서 등록된 시설이 없습니다.</b><span>다른 분류를 선택하거나 지도의 최신 등록 상태를 확인해주세요.</span></div>}</div>
          </div> : <div className="facility-empty"><span>01</span><b>단지 선택</b><i>→</i><span>02</span><b>정확한 주소 좌표 확인</b><i>→</i><span>03</span><b>주변 생활시설 비교</b></div>}
          <p className="facility-note">단지 좌표와 배경 지도는 네이버 Maps, 주변 시설은 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap 기여자</a> 데이터를 사용합니다. 거리는 두 좌표 사이의 직선거리이며, 도보 시간은 경로 굴곡을 20% 반영한 참고 추정값입니다. 횡단보도·경사·출입구를 반영한 실제 길찾기 시간과는 다를 수 있습니다.</p>
        </section>
      </div>
    </section>

    <section className="field-intelligence" id="field">
      <header className="field-heading"><div><span>온라인 임장</span><h2>집을 보러 가기 전에,<br/>생활부터 시뮬레이션하세요.</h2><p>현재 선택한 지역과 단지를 기준으로 이동·환경·세대·비용을 한 흐름에서 점검합니다.</p></div><div className="field-status-summary"><b>{FIELD_FEATURES.filter((feature) => feature.status === "live").length}<small>바로 사용</small></b><b>{FIELD_FEATURES.filter((feature) => feature.status === "beta").length}<small>베타</small></b><b>{FIELD_FEATURES.filter((feature) => feature.status === "connect").length}<small>데이터 연결</small></b></div></header>
      <div className="field-context"><span>분석 위치</span><b>{fieldMapQuery}</b><small>상단 지역·단지 선택과 자동 동기화됩니다.</small></div>
      <div className="field-shell">
        <nav className="field-groups" aria-label="온라인 임장 분류">{FIELD_GROUPS.map((group) => <button key={group} className={fieldGroup === group ? "active" : ""} onClick={() => { setFieldGroup(group); setFieldFeatureId(FIELD_FEATURES.find((feature) => feature.group === group)?.id || "region"); }}><span>{group}</span><b>{FIELD_FEATURES.filter((feature) => feature.group === group).length}</b></button>)}</nav>
        <div className="field-feature-list">{fieldGroupFeatures.map((feature) => <button key={feature.id} className={fieldFeatureId === feature.id ? "active" : ""} onClick={() => setFieldFeatureId(feature.id)}><div><b>{feature.title}</b><span>{feature.information}</span></div><em className={feature.status}>{feature.status === "live" ? "사용 가능" : feature.status === "beta" ? "베타" : "연결 예정"}</em><i className="importance-meter" aria-label={`중요도 5점 중 ${feature.importance}점`}>{[1,2,3,4,5].map((point) => <span key={point} className={point <= feature.importance ? "on" : ""} />)}</i></button>)}</div>
        <article className="field-workspace">
          <header><span className={activeFieldFeature.status}>{activeFieldFeature.status === "live" ? "LIVE" : activeFieldFeature.status === "beta" ? "BETA" : "DATA CONNECT"}</span><small>{activeFieldFeature.source}</small><h3>{activeFieldFeature.title}</h3><p>{activeFieldFeature.value}</p></header>
          {activeFieldFeature.id === "region" && <div className="field-action-panel"><b>{fieldMapQuery}</b><p>단지를 선택하면 1km 안의 교통·교육·의료·장보기·여가 시설과 거리를 자동으로 계산합니다.</p><button onClick={() => changeView("chart")}>자동 생활권 지도 보기 →</button></div>}
          {activeFieldFeature.id === "walk" && <div className="field-action-panel"><b>{fieldMapQuery}</b><p>실제 보행 경로는 횡단보도와 출입구를 반영한 최신 길찾기 결과로 최종 확인합니다.</p><a href={fieldMapUrl} target="_blank" rel="noreferrer">실제 도보 경로 확인 ↗</a></div>}
          {activeFieldFeature.id === "commute" && <div className="field-action-panel"><label><span>회사·학교·자주 가는 곳</span><input value={commuteDestination} onChange={(event) => setCommuteDestination(event.target.value)} placeholder="예: 광화문역" /></label>{commuteUrl ? <a href={commuteUrl} target="_blank" rel="noreferrer">Door-to-Door 경로 확인 ↗</a> : <button disabled>목적지를 입력해주세요</button>}<small>출발지는 현재 선택한 단지 또는 지역입니다.</small></div>}
          {activeFieldFeature.id === "lifestyle" && <div className="field-action-panel"><div className="lifestyle-chips">{["마트","병원","학교","헬스장","카페","공원"].map((keyword) => <button key={keyword} className={lifestyleKeyword === keyword ? "active" : ""} onClick={() => setLifestyleKeyword(keyword)}>{keyword}</button>)}</div><b>{fieldMapQuery} 주변 {lifestyleKeyword}</b><button onClick={() => changeView("chart")}>자동 생활권 지도 보기 →</button></div>}
          {activeFieldFeature.id === "price" && <div className="field-facts"><div><span>최근 3개월 거래</span><strong>{latestQuarterTrades.length.toLocaleString()}건</strong></div><div><span>분기 중위가격</span><strong>{formatPrice(median(latestQuarterTrades.map((trade) => trade.amount)))}</strong></div><div><span>유사 면적 대비</span><strong>{selectedKey && peerPyeongPrice ? `${valuationGap >= 0 ? "+" : ""}${valuationGap.toFixed(1)}%` : "단지 선택 필요"}</strong></div><a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>상세 가격 차트 보기 →</a></div>}
          {activeFieldFeature.id === "report" && <div className="field-report"><h4>현재 실거래 자동 요약</h4><ul><li>{activeRegion.sigungu}에서 최근 3개월 신고 거래 {latestQuarterTrades.length.toLocaleString()}건을 확인했습니다.</li><li>{propertyRows.length ? `동·평형 조건 ${propertyRows.length.toLocaleString()}개를 같은 기준으로 비교할 수 있습니다.` : "현재 조건은 비교 가능한 동·평형 표본이 부족합니다."}</li><li>{selectedKey && peerPyeongPrice ? `선택 후보는 유사 면적 지역 중위보다 ${Math.abs(valuationGap).toFixed(1)}% ${valuationGap > 0 ? "높습니다." : "낮습니다."}` : "단지를 선택하면 유사 면적 실거래와 가격 차이를 계산합니다."}</li></ul><small>생성형 문장이 아니라 현재 화면의 실거래 계산값을 요약합니다.</small></div>}
          {activeFieldFeature.id === "compare" && <div className="field-compare">{savedHomes.length ? savedHomes.slice(0,3).map((home) => <div key={home.id}><b>{home.name}</b><span>{home.region} · {home.area}평</span><strong>{home.score}점</strong></div>) : <p>가격 차트에서 관심 후보를 담으면 최대 3개 단지를 한눈에 비교할 수 있습니다.</p>}<a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>비교 후보 고르기 →</a></div>}
          {!(["region","walk","commute","lifestyle","price","report","compare"].includes(activeFieldFeature.id)) && <div className="field-connect"><span>{activeFieldFeature.information}</span><strong>{activeFieldFeature.source} 연결이 필요합니다.</strong><p>현장·센서·공식 원천이 확보되기 전에는 그럴듯한 추정 점수를 표시하지 않습니다. 데이터 출처와 갱신일을 확인한 뒤 같은 화면에 연결합니다.</p><div><i />원천 검증 <i />주소·동 매칭 <i />사용자 교차 확인</div></div>}
        </article>
      </div>
      <section className="field-scorecard" aria-label="온라인 임장 평가 예시">
        <header><div><span>평가 예시</span><h3>한눈에 보는 임장 점수</h3><p>평가 방식과 화면 구성을 미리 확인하는 예시입니다. 실제 단지 점수는 항목별 공식·현장 데이터 연결 후 산출합니다.</p></div><div className="field-total"><strong>82</strong><span>종합 점수</span><b>추천</b></div></header>
        <div className="field-score-head"><span>평가항목</span><span>점수</span><span>평가</span></div>
        <div className="field-score-rows">{FIELD_SCORE_EXAMPLE.map((item) => <div key={item.label}><b>{item.label}</b><span className="field-score-bar"><i style={{ width: `${item.score}%` }} /></span><strong>{item.score}</strong><em className={item.grade === "주의" ? "caution" : item.grade === "보통" ? "neutral" : "good"}>{item.grade}</em></div>)}</div>
        <footer><span>예시 데이터</span><p>현재 수치는 화면 설계를 위한 샘플이며 특정 지역·단지의 실제 평가가 아닙니다.</p></footer>
      </section>
    </section>

    <section className="research-section" id="research">
      <div className="research-heading">
        <div><p>REAL ESTATE RESEARCH DESK</p><h2>21가지 부동산 리서치, 한 흐름으로</h2><span>기능을 나열하지 않고 가격 → 수급 → 공급 → 입지 → 수익 순서로 매수 판단을 좁혀갑니다.</span></div>
        <div className="research-counts"><article><strong>21</strong><span>전체 도구</span></article><article><strong>09</strong><span>실거래 즉시 분석</span></article><article><strong>12</strong><span>공식 데이터 연결 대상</span></article></div>
      </div>
      <div className="research-scope"><span>현재 분석 범위</span><b>{activeRegion.sido}</b><i>›</i><b>{activeRegion.sigungu}</b>{selectedDong !== "all" && <><i>›</i><b>{selectedDong}</b></>}<em>{PROPERTY_TYPES.find((item) => item.key === type)?.label}</em><small>위 지역 선택과 자동 동기화</small></div>
      <div className="research-shell">
        <aside className="research-axis" aria-label="리서치 대분류">
          {RESEARCH_CATEGORIES.map((category) => <button key={category.id} className={researchCategory === category.id ? "active" : ""} aria-pressed={researchCategory === category.id} onClick={() => { setResearchCategory(category.id); setResearchTool(category.tools[0].id); }}><em>{category.number}</em><span><b>{category.label}</b><small>{category.short}</small></span><i>{category.tools.length}</i></button>)}
        </aside>
        <div className="research-workspace">
          <div className="research-category-head"><div><span>{activeResearchCategory.number} / {activeResearchCategory.short}</span><h3>{activeResearchCategory.label}</h3><p>{activeResearchCategory.description}</p></div><b>{activeResearchCategory.tools.filter((tool) => tool.mode === "live").length}개 LIVE</b></div>
          <div className="research-tool-grid">{activeResearchCategory.tools.map((tool) => <button key={tool.id} className={researchTool === tool.id ? "active" : ""} aria-pressed={researchTool === tool.id} onClick={() => setResearchTool(tool.id)}><span>{tool.label}</span><small className={tool.mode}>{tool.mode === "live" ? "● LIVE" : "○ DATA"}</small></button>)}</div>
          <article className="research-output">
            <header><div><span className={activeResearchTool.mode}>{activeResearchTool.mode === "live" ? "실거래 LIVE" : "공식 데이터 연결 설계"}</span><h3>{activeResearchTool.label}</h3><p>{activeResearchTool.description}</p></div><small>DATA · {activeResearchTool.source}</small></header>
            {activeResearchTool.mode === "live" ? <div className="research-live-board">
              <div className="research-table-head"><span>순위</span><span>단지 · 동 · 평형</span><span>3개월 중위가</span><span>도구 기준</span></div>
              {loading ? <div className="research-state"><i />선택 지역의 실거래를 계산하고 있습니다.</div> : error ? <div className="research-state error">{error}</div> : researchRows.length ? researchRows.map((row, index) => <button key={row.key} onClick={() => selectCandidate(row)}><em>{String(index + 1).padStart(2, "0")}</em><span className={`research-building tone-${index % 5}`}>{row.name.slice(0, 1)}</span><b>{row.name}<small>{row.dong} · {dongLabel(row.buildingDong) || "동 정보 없음"} · 전용 {row.areaBucket}평 · {row.quarterCount}건</small></b><span>{formatPrice(row.current)}</span><strong className={researchTool === "record-high" || researchTool === "multi-compare" || researchTool === "most-bought" || researchTool === "volume" ? "" : researchTool === "price-compare" ? row.gap >= 0 ? "up" : "down" : (row.change ?? 0) >= 0 ? "up" : "down"}>{researchMetric(row)}</strong></button>) : <div className="research-state"><b>이 조건에서 비교 가능한 표본이 없습니다.</b><span>시·군·구 전체 또는 다른 주택 유형으로 범위를 넓혀보세요.</span></div>}
            </div> : <div className="research-connect-state"><div><span>CONNECT NEXT</span><strong>값을 추정해 채우지 않고<br/>공식 원천부터 연결합니다.</strong><p>{activeResearchTool.label}에는 현재 실거래 API 외에 <b>{activeResearchTool.source}</b>가 필요합니다. 연결 전에는 그럴듯한 가짜 수치를 보여주지 않습니다.</p></div><ol><li><em>01</em><b>원천 검증</b><span>공식 기관·갱신주기 확인</span></li><li><em>02</em><b>지역 코드 통합</b><span>시·군·구·읍면동 매칭</span></li><li><em>03</em><b>교차 분석</b><span>실거래와 같은 화면에 결합</span></li></ol></div>}
          </article>
        </div>
      </div>
      <p className="research-note">가격·거래량 도구는 현재 선택 지역의 신고 실거래로 즉시 계산합니다. 매물·전세·공급·인구·학군 데이터는 별도 공식 원천 연결이 필요한 기능으로 구분해 표시했습니다.</p>
    </section>

    <section className="map-section" id="map">
      <div className="map-current-location" aria-live="polite"><div><span>현재 보고 있는 위치</span><strong>{selectedMapSido}<i>›</i>{selectedMapSido === activeRegion.sido ? activeRegion.sigungu : "시·군·구를 선택하세요"}{selectedMapSido === activeRegion.sido && selectedDong !== "all" && <><i>›</i>{selectedDong}</>}</strong><small>{selectedMapSido === activeRegion.sido ? `${PROPERTY_TYPES.find((item) => item.key === type)?.label} · 최근 3개월 실거래 기준` : "아래 지역 목록에서 세부 지역을 선택하면 차트와 함께 변경됩니다."}</small></div><button onClick={() => { changeView("home"); window.setTimeout(() => document.querySelector<HTMLSelectElement>('.search-console select')?.focus(), 250); }}>지역 다시 선택</button></div>
      <div className="section-title wide"><div><p>KOREA MARKET MAP</p><h2>전국 경계에서 행당동까지</h2><span>{marketMonth ? `${marketMonth.slice(0, 4)}년 ${Number(marketMonth.slice(4))}월 기준 최근 3개월` : "전국 집계 중"} · 전국 16개 시·도 → 256개 시·군·구 → 3,558개 읍·면·동 → 단지 순으로 확대</span></div><div className="map-controls"><button type="button" className="gangnam-map-shortcut" onClick={openGangnamMap}>강남구 바로보기 ↗</button><button type="button" className="gangnam-map-shortcut secondary" onClick={openHaengdangMap}>행당동 예시보기 ↗</button><select value={marketSort} onChange={(event) => setMarketSort(event.target.value as typeof marketSort)} aria-label="전국 시장 정렬"><option value="volume">최근 3개월 거래량순</option><option value="price">최근 3개월 중위가순</option><option value="rise">직전 3개월 대비 상승순</option><option value="fall">직전 3개월 대비 하락순</option></select><div className="map-legend"><i className="cold"/>하락 <i className="flat"/>보합 <i className="hot"/>상승</div></div></div>
      <div className="map-level-tabs" aria-label="지도 확대 단계">
        <button className={mapFocus === "national" ? "active" : ""} aria-pressed={mapFocus === "national"} onClick={() => setMapFocus("national")}><em>01</em><span>전국</span><small>16개 시·도</small></button>
        <button className={mapFocus === "sido" ? "active" : ""} aria-pressed={mapFocus === "sido"} onClick={() => setMapFocus("sido")}><em>02</em><span>{selectedMapSido}</span><small>시·도 전체</small></button>
        <button className={mapFocus === "district" ? "active" : ""} aria-pressed={mapFocus === "district"} disabled={selectedMapSido !== activeRegion.sido} onClick={() => setMapFocus("district")}><em>03</em><span>{selectedMapSido === activeRegion.sido ? `${activeRegion.sigungu} 전체` : "시·군·구 선택"}</span><small>읍·면·동 경계 · 거래량</small></button>
        <button className={mapFocus === "detail" ? "active" : ""} aria-pressed={mapFocus === "detail"} disabled={!propertyLocation || selectedMapSido !== activeRegion.sido} onClick={() => setMapFocus("detail")}><em>04</em><span>{propertyLocation && selectedProperty ? selectedProperty.name : "단지 상세"}</span><small>{propertyLocation ? "실제 주소 좌표" : "차트에서 단지 선택"}</small></button>
      </div>
      <div className="map-sibling-selector"><div><b>{selectedMapSido} 지역 선택</b><span>지도에서 시·도를 고른 뒤 원하는 시·군·구를 바로 비교하세요.</span></div><div>{mapDistricts.map((region) => <button key={region.code} className={region.code === regionCode ? "active" : ""} onClick={() => chooseRegion(region, false)}>{region.sigungu}<small>{region.code === regionCode ? "선택됨" : "보기"}</small></button>)}</div></div>
      <div className="map-layout"><NaverMarketMap markets={markets} focus={mapFocus} selectedSido={selectedMapSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} dongVolumes={mapDongVolumes} propertyLocation={propertyLocation} propertyName={selectedProperty?.name || ""} onSelectSido={chooseMapSido} onSelectRegion={chooseMapRegion} onSelectDong={chooseMapDong} />
        <div className="map-ranking"><h3>전국 3개월 흐름</h3><div className="ranking-labels"><span>순위</span><span>지역</span><span>중위가격</span><span>3개월</span></div>{sortedMarkets.length ? sortedMarkets.map((market, index) => <button key={market.code} className={market.sido === selectedMapSido ? "selected" : ""} aria-pressed={market.sido === selectedMapSido} onClick={() => chooseMapSido(market.sido)}><em>{String(index + 1).padStart(2,"0")}</em><b>{market.sido}<small>{market.count}건</small></b><span>{formatPrice(market.median)}</span><strong className={market.change >= 0 ? "up" : "down"}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</strong></button>) : <div className="ranking-loading">16개 대표 권역의 공공데이터를 확인하고 있습니다.</div>}</div>
      </div>
      <div className="region-drilldown"><div><p>SELECT DISTRICT</p><h3>{selectedMapSido} 세부 지역</h3><span>지역을 누르면 지도는 해당 시·군·구 전체로 확대되고, 실거래 차트 조건도 함께 바뀝니다.</span></div><div>{mapDistricts.map((region, index) => <button key={region.code} className={region.code === regionCode ? "selected" : ""} aria-pressed={region.code === regionCode} onClick={() => chooseRegion(region, false)}><em>{String(index + 1).padStart(2, "0")}</em>{region.sigungu}<span>›</span></button>)}</div></div>
      <p className="map-note">배경 지도·주소 좌표는 네이버 지도 API, 가격 표식은 국토교통부 실거래를 사용합니다. 전국 경계는 <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer">2026-07-01 SGIS 기반 행정구역 경계</a>(CC BY 4.0)를 사용한 화면 탐색용 참고선입니다.</p>
    </section>

    <section className="trade-section" id="transactions"><div className="section-title wide"><div><p>RECENT CONTRACTS</p><h2>{displayName} 최근 실거래</h2></div><span>단위: 만원 · 최대 30건 표시</span></div><div className="trade-table"><div className="table-head"><span>계약일</span><span>건물명</span><span>전용면적</span><span>층</span><span>거래금액</span><span>평당가</span></div>{[...filteredTrades].reverse().slice(0, 30).map((trade) => <div className="table-row" key={trade.id}><span>{trade.date.replaceAll("-", ".")}</span><b>{trade.name}</b><span>{trade.area ? `${trade.area.toFixed(1)}㎡` : "-"}</span><span>{trade.floor === null ? "-" : `${trade.floor}층`}</span><strong>{formatPrice(trade.amount)}</strong><span>{trade.area ? `${Math.round(trade.amount / (trade.area / 3.3058)).toLocaleString()}만` : "-"}</span></div>)}</div></section>

    <section className="study-community" id="community">
      <div className="study-heading"><div><p>JIPGAPS STUDY COMMUNITY</p><h2>광고보다 근거가 먼저인 부동산 스터디</h2><span>질문이 섞이지 않도록 5개 대분류와 25개 세부 게시판으로 나눴습니다. 글마다 지역·평형·근거 출처를 붙이는 구조입니다.</span></div><div><strong>5</strong><span>대분류</span><i /><strong>25</strong><span>세부 게시판</span></div></div>
      <div className="study-shell">
        <aside className="study-categories" aria-label="커뮤니티 대분류">{COMMUNITY_CATEGORIES.map((category) => <button key={category.id} className={communityCategory === category.id ? "active" : ""} aria-pressed={communityCategory === category.id} onClick={() => { setCommunityCategory(category.id); setCommunityBoard("전체"); setDraftSaved(false); }}><em>{category.number}</em><span><b>{category.label}</b><small>{category.description}</small></span><i>›</i></button>)}</aside>
        <div className="study-stage">
          <header><div><span>{activeCommunityCategory.number} / STUDY ROOM</span><h3>{activeCommunityCategory.label}</h3><p>{activeCommunityCategory.description}</p></div><button type="button" onClick={() => { setShowStudyWriter((value) => !value); setDraftSaved(false); }}>{showStudyWriter ? "초안 닫기" : "+ 분석 글 초안 쓰기"}</button></header>
          <div className="study-board-tabs" aria-label={`${activeCommunityCategory.label} 세부 게시판`}>{activeCommunityCategory.boards.map((board) => <button key={board} className={communityBoard === board ? "active" : ""} aria-pressed={communityBoard === board} onClick={() => { setCommunityBoard(board); setDraftSaved(false); }}>{board}</button>)}</div>
          {showStudyWriter && <form className="study-writer" onSubmit={saveStudyDraft}><div><span>선택한 방</span><b>{activeCommunityCategory.label} · {communityBoard === "전체" ? activeCommunityCategory.boards[1] : communityBoard}</b></div><label><span>제목</span><input value={studyTitle} onChange={(event) => { setStudyTitle(event.target.value); setDraftSaved(false); }} maxLength={80} placeholder="무엇을 비교했고 어떤 판단이 궁금한가요?" required /></label><label><span>분석 내용</span><textarea value={studyBody} onChange={(event) => { setStudyBody(event.target.value); setDraftSaved(false); }} maxLength={1500} placeholder="지역·단지·평형, 확인한 실거래와 내 관점을 함께 적어주세요." required /></label><div className="study-writer-actions"><small>안전한 오픈 베타 전까지 초안은 이 기기에만 저장됩니다. 공개 게시와 댓글은 로그인·신고 기능을 갖춘 뒤 연결합니다.</small><button type="submit">{draftSaved ? "이 기기에 저장됨 ✓" : "초안 저장"}</button></div></form>}
          <div className="study-topic-head"><div><b>{communityBoard === "전체" ? "운영팀이 먼저 여는 토론" : communityBoard}</b><span>사실과 의견을 분리하는 글쓰기 예시</span></div><small>{visibleCommunityGuides.length}개 주제</small></div>
          {visibleCommunityGuides.length ? <div className="study-topic-grid">{visibleCommunityGuides.map((guide) => <article key={guide.id}><div><span>{guide.board}</span><em>{guide.tag}</em></div><h4>{guide.title}</h4><p>{guide.summary}</p><div className="study-topic-foot"><b>근거</b><span>{guide.evidence}</span><button type="button" onClick={() => { setCommunityBoard(guide.board); setStudyTitle(guide.title); setShowStudyWriter(true); setDraftSaved(false); }}>이 주제로 쓰기 ↗</button></div></article>)}</div> : <div className="study-empty"><span>{communityBoard}</span><b>아직 운영팀이 준비한 예시 주제가 없습니다.</b><p>이 게시판에서 가장 먼저 검증하고 싶은 질문을 초안으로 남겨보세요.</p><button type="button" onClick={() => setShowStudyWriter(true)}>첫 분석 초안 쓰기</button></div>}
        </div>
      </div>
      <div className="study-rules"><article><em>01</em><b>근거 먼저</b><span>실거래·정부 원문·현장 사진처럼 확인 가능한 출처를 붙입니다.</span></article><article><em>02</em><b>조건을 정확히</b><span>지역·단지·동·평형·기간을 적어 다른 조건끼리 섞지 않습니다.</span></article><article><em>03</em><b>광고는 분리</b><span>중개·매물 유도·수익 보장 글은 일반 분석 게시판과 섞지 않습니다.</span></article></div>
    </section>

    <section className="policy-section" id="policy"><div className="section-title wide"><div><p>POLICY RADAR · 6시간마다 자동 확인</p><h2>부동산 정책 레이더</h2><span>언론 기사가 아닌 국토교통부·정책브리핑 공식 발표만 표시합니다.{policyUpdated ? ` · ${new Date(policyUpdated).toLocaleString("ko-KR")} 확인` : ""}</span></div><a href="https://www.molit.go.kr/portal.do" target="_blank" rel="noreferrer">국토교통부 최신 정책 ↗</a></div><div className="policy-grid">{policyItems.map((policy) => <a key={policy.title} href={policy.url} target="_blank" rel="noreferrer" className={`policy-card ${policy.tone}`}><div><span>{policy.date}</span><em>{policy.scope}</em></div><b><i>{policy.label}</i>{policy.title}</b><p>{policy.summary}</p><small>공식 원문 확인 ↗</small></a>)}</div><p className="policy-method">호재·악재·중립 평가는 실수요자의 선택지, 금융·세금 부담, 공급 확대 여부를 기준으로 한 서비스 자체 해석입니다. 정책 효과는 지역과 보유 상황에 따라 달라질 수 있습니다.</p></section>

    <section className="insight"><div><p>DATA NOTE</p><h2>전국에서 동네로, 동네에서 살 집 후보로 좁혀갑니다.</h2></div><p>첫 화면은 전국 흐름을 비교하는 출발점입니다. 관심 지역을 고른 뒤 실제 거래와 평수 대비 가격을 확인해 내 조건에 맞는 집을 찾아보세요.</p></section>
    <footer><a className="brand" href="#home" onClick={(event) => { event.preventDefault(); changeView("home"); }}><span>집값</span>의 정석</a><p>데이터로 보고, 실제로 살 집을 고르다.</p><span>데이터: 국토교통부 실거래가 공개시스템</span></footer>
  </main>;
}
