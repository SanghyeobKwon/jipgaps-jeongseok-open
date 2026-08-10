"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Baby, Building2, BusFront, Drama, Dumbbell, Film, GraduationCap, HeartPulse, Hospital, Landmark, Library, Mail, MapPin, Monitor, Moon, Pill, School, ShoppingBasket, ShoppingCart, Stethoscope, Store, Sun, TrainFront, Trees, Trophy, WashingMachine, Waves, type LucideIcon } from "lucide-react";
import regions from "./data/regions.json";

type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";
type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
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
type PropertyMapLocation = PropertyLocation & { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; propertyType: PropertyType; scope: "selected" | "nearby" };
type NearbyPlace = { id: string; name: string; category: string; subCategory: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };
type FacilityMeta = { label: string; description: string; color: string; icon: LucideIcon; subtypes: string[] };
const NEARBY_CATEGORIES: FacilityMeta[] = [
  { label: "교통", description: "역·터미널", color: "#6d3ed1", icon: TrainFront, subtypes: ["지하철역", "기차역", "버스터미널"] },
  { label: "교육", description: "보육·학교", color: "#2463c7", icon: GraduationCap, subtypes: ["어린이집", "유치원", "초등학교", "중학교", "고등학교"] },
  { label: "의료", description: "병원·약국", color: "#c83d4f", icon: HeartPulse, subtypes: ["종합병원", "병·의원", "약국", "치과"] },
  { label: "장보기", description: "마트·시장", color: "#15805d", icon: ShoppingBasket, subtypes: ["대형마트", "슈퍼마켓", "편의점", "전통시장"] },
  { label: "문화·여가", description: "영화·공원", color: "#b66716", icon: Film, subtypes: ["영화관", "공연장", "공원", "도서관", "박물관"] },
  { label: "운동", description: "체육·운동", color: "#087f8c", icon: Dumbbell, subtypes: ["헬스장", "수영장", "체육관"] },
  { label: "생활", description: "금융·행정", color: "#526173", icon: Landmark, subtypes: ["은행", "우체국", "주민센터", "세탁소"] },
];
const FACILITY_SUBTYPE_ICONS: Record<string, LucideIcon> = {
  "지하철역": TrainFront, "기차역": TrainFront, "버스터미널": BusFront,
  "어린이집": Baby, "유치원": School, "초등학교": School, "중학교": School, "고등학교": GraduationCap,
  "종합병원": Hospital, "병·의원": Stethoscope, "약국": Pill, "치과": HeartPulse,
  "대형마트": ShoppingCart, "슈퍼마켓": Store, "편의점": Store, "전통시장": ShoppingBasket,
  "영화관": Film, "공연장": Drama, "공원": Trees, "도서관": Library, "박물관": Landmark,
  "헬스장": Dumbbell, "수영장": Waves, "체육관": Trophy,
  "은행": Landmark, "우체국": Mail, "주민센터": Building2, "세탁소": WashingMachine,
};

function FacilityIcon({ name, size = 16 }: { name: string; size?: number }) {
  const category = NEARBY_CATEGORIES.find((item) => item.label === name); const Icon = FACILITY_SUBTYPE_ICONS[name] || category?.icon || MapPin;
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}
type MapFocus = "national" | "sido" | "district" | "buildings" | "detail";
type DongMetric = "price" | "py" | "volume";
type DongMarketStat = { count: number; median: number; perPy: number };
type GeoJsonFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: Record<string, unknown> };
type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };
type KakaoLatLng = unknown;
type KakaoBounds = { extend: (latLng: KakaoLatLng) => void };
type KakaoMapInstance = { setBounds: (bounds: KakaoBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void; getLevel: () => number; setLevel: (level: number) => void; addControl?: (control: unknown, position: unknown) => void; relayout?: () => void };
type KakaoOverlayInstance = { setMap: (map: KakaoMapInstance | null) => void };
type KakaoEventListener = { target: unknown; eventName: string; listener: (...args: unknown[]) => void };
type KakaoMapsApi = { maps: {
  load: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: Record<string, unknown>) => KakaoOverlayInstance;
  Circle: new (options: Record<string, unknown>) => KakaoOverlayInstance;
  Polygon: new (options: Record<string, unknown>) => KakaoOverlayInstance;
  ZoomControl: new () => unknown;
  ControlPosition: { TOPRIGHT: unknown };
  event: { addListener: (target: unknown, eventName: string, listener: (...args: unknown[]) => void) => void; removeListener: (target: unknown, eventName: string, listener: (...args: unknown[]) => void) => void };
} };

declare global {
  interface Window {
    kakao?: KakaoMapsApi;
    __jipgapsKakaoMap?: Promise<void>;
  }
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
const PROPERTY_MAP_META: Record<PropertyType, { label: string; short: string }> = {
  apt: { label: "아파트 단지", short: "아파트" },
  rowhouse: { label: "연립·다세대 주거", short: "연립·다세대" },
  house: { label: "단독·다가구 주거", short: "단독·다가구" },
  officetel: { label: "오피스텔", short: "오피스텔" },
  commercial: { label: "상가·업무 건물", short: "상가·업무" },
  factory: { label: "공장·창고", short: "공장·창고" },
};
const PERIODS = [{ label: "3개월", value: 3 }, { label: "6개월", value: 6 }, { label: "1년", value: 12 }, { label: "3년", value: 36 }, { label: "5년", value: 60 }];
const NAV_ITEMS = [{ id: "home", label: "지도에서 찾기", mobileLabel: "찾기" }, { id: "chart", label: "상세 차트", mobileLabel: "차트" }, { id: "field", label: "온라인 임장", mobileLabel: "임장" }, { id: "research", label: "리서치", mobileLabel: "리서치" }, { id: "map", label: "전국 지도", mobileLabel: "전국" }, { id: "community", label: "커뮤니티", mobileLabel: "커뮤니티" }, { id: "policy", label: "정책", mobileLabel: "정책" }];
const THEME_OPTIONS: { key: ThemePreference; label: string; icon: LucideIcon }[] = [
  { key: "light", label: "라이트", icon: Sun },
  { key: "dark", label: "다크", icon: Moon },
  { key: "system", label: "시스템", icon: Monitor },
];
const SIDO_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  서울특별시: { lat: 37.5665, lng: 126.978, zoom: 10 }, 부산광역시: { lat: 35.1796, lng: 129.0756, zoom: 10 }, 대구광역시: { lat: 35.8714, lng: 128.6014, zoom: 10 }, 인천광역시: { lat: 37.4563, lng: 126.7052, zoom: 9 },
  전남광주통합특별시: { lat: 35.15, lng: 126.95, zoom: 8 }, 대전광역시: { lat: 36.3504, lng: 127.3845, zoom: 10 }, 울산광역시: { lat: 35.5384, lng: 129.3114, zoom: 9 }, 세종특별자치시: { lat: 36.48, lng: 127.289, zoom: 10 },
  경기도: { lat: 37.4138, lng: 127.5183, zoom: 8 }, 강원특별자치도: { lat: 37.8228, lng: 128.1555, zoom: 8 }, 충청북도: { lat: 36.6357, lng: 127.4917, zoom: 9 }, 충청남도: { lat: 36.5184, lng: 126.8, zoom: 9 },
  전북특별자치도: { lat: 35.7175, lng: 127.153, zoom: 9 }, 경상북도: { lat: 36.4919, lng: 128.8889, zoom: 8 }, 경상남도: { lat: 35.4606, lng: 128.2132, zoom: 9 }, 제주특별자치도: { lat: 33.489, lng: 126.4983, zoom: 9 },
};
const QUICK_REGIONS = [{ code: "11680", label: "강남구" }, { code: "11650", label: "서초구" }, { code: "11710", label: "송파구" }, { code: "11200", label: "성동구" }, { code: "41135", label: "분당구" }, { code: "26350", label: "해운대구" }];
const FIELD_GROUPS = ["입지·동선", "주거환경", "동·세대", "비용·가격", "검증·비교"];
const FIELD_LEVELS = [
  { id: "region", label: "지역 임장", summary: "지역 자체를 분석", example: "강남구·성동구·분당·동탄", group: "입지·동선", featureId: "region", status: "사용 가능" },
  { id: "complex", label: "단지 임장", summary: "아파트 단지를 분석", example: "래미안·자이 등 개별 단지", group: "비용·가격", featureId: "price", status: "사용 가능" },
  { id: "unit", label: "동·호수 임장", summary: "동·층·방향에 따른 차이 분석", example: "101동·15층·전용 84㎡", group: "동·세대", featureId: "building", status: "베타" },
  { id: "life", label: "생활 임장", summary: "실제 하루 동선을 시뮬레이션", example: "출근·귀가·장보기·주차·산책·학교·병원", group: "입지·동선", featureId: "lifestyle", status: "일부 사용 가능" },
];
const TIME_SLOTS = [
  { hour: "06", label: "오전 06:00", phase: "하루 시작", title: "첫 이동과 이른 아침 생활환경", tone: "dawn", checks: [{ label: "첫차·버스", detail: "이른 출근에 필요한 첫차와 배차 간격" }, { label: "보행 조명", detail: "해 뜨기 전 골목과 역까지의 밝기" }, { label: "산책 동선", detail: "공원·하천·아침 운동 경로의 접근성" }, { label: "생활 소음", detail: "배송·청소·등교 준비 시간대의 소음" }] },
  { hour: "09", label: "오전 09:00", phase: "출근·통학", title: "출근길과 학교 앞이 가장 바쁜 시간", tone: "rush", checks: [{ label: "출근 혼잡", detail: "역·정류장·주요 도로로 몰리는 이동" }, { label: "통학 동선", detail: "학교 앞 횡단보도와 학생 이동 경로" }, { label: "차량 진출입", detail: "단지 출입구와 간선도로 합류 구간" }, { label: "상가 영업", detail: "아침 식사·카페·생활 상권의 운영 상태" }] },
  { hour: "12", label: "오후 12:00", phase: "낮 생활권", title: "상권과 보행환경을 선명하게 보는 시간", tone: "noon", checks: [{ label: "생활 상권", detail: "마트·병원·은행·식당의 실제 접근성" }, { label: "보행 쾌적성", detail: "그늘·경사·보도 폭과 횡단 대기" }, { label: "공사 소음", detail: "주변 공사장과 낮 시간 작업 소음" }, { label: "공원 이용", detail: "공원·광장·휴식공간의 이용 밀도" }] },
  { hour: "18", label: "오후 18:00", phase: "퇴근·하교", title: "퇴근 동선과 저녁 생활이 겹치는 시간", tone: "evening", checks: [{ label: "퇴근 혼잡", detail: "역 출구·버스 환승·주요 도로 정체" }, { label: "학원가 이동", detail: "학생 이동과 학원 차량 정차 구간" }, { label: "주차 진입", detail: "입주 차량 집중과 단지 출입구 대기" }, { label: "저녁 상권", detail: "장보기·외식·배달 수요가 모이는 위치" }] },
  { hour: "22", label: "오후 22:00", phase: "야간 귀가", title: "밤길 안전과 소음의 성격이 드러나는 시간", tone: "night", checks: [{ label: "귀가 동선", detail: "역에서 단지까지 가로등과 보행 시야" }, { label: "야간 상권", detail: "음식점·주점·편의점 주변 유동" }, { label: "생활 소음", detail: "도로·상가·야외 공간의 밤 소음" }, { label: "주차 상태", detail: "늦은 귀가 시 빈자리와 이중주차 가능성" }] },
  { hour: "01", label: "오전 01:00", phase: "심야", title: "늦은 귀가의 마지막 이동 조건", tone: "late", checks: [{ label: "심야 교통", detail: "막차 이후 버스·택시 이용 가능성" }, { label: "보행 안전", detail: "인적이 적은 골목과 비상 대피 지점" }, { label: "24시간 시설", detail: "편의점·약국·응급의료 접근성" }, { label: "심야 소음", detail: "유흥 상권·간선도로·오토바이 소음" }] },
];
const NOISE_SOURCES = [
  { id: "car", label: "자동차", detail: "간선도로·교차로" }, { id: "bus", label: "버스", detail: "정류장·차고지" },
  { id: "subway", label: "지하철", detail: "역 출입구·지상 구간" }, { id: "rail", label: "철도", detail: "선로·건널목" },
  { id: "aircraft", label: "항공기", detail: "비행 경로" }, { id: "retail", label: "상가", detail: "음식점·주점·배달" },
  { id: "school", label: "학교", detail: "등·하교·운동장" }, { id: "construction", label: "공사장", detail: "공사 시간·중장비" },
];
const FIELD_SCORE_EXAMPLE = [
  { label: "교통", score: 92, grade: "매우 좋음" }, { label: "생활편의", score: 91, grade: "매우 좋음" },
  { label: "학군", score: 85, grade: "좋음" }, { label: "일조", score: 84, grade: "좋음" },
  { label: "조망", score: 81, grade: "좋음" }, { label: "보행환경", score: 80, grade: "좋음" },
  { label: "소음", score: 73, grade: "보통" }, { label: "관리비", score: 76, grade: "보통" },
  { label: "주차", score: 68, grade: "주의" },
];
const FIELD_FEATURES: FieldFeature[] = [
  { id: "region", group: "입지·동선", title: "지역 온라인 임장", information: "상권·교통·학교·병원·공원·유흥시설", value: "동네를 직접 돌지 않고 생활권을 먼저 파악", importance: 5, status: "live", source: "카카오맵·로컬 장소 검색" },
  { id: "walk", group: "입지·동선", title: "도보 임장", information: "역에서 단지까지 실제 동선과 보행 환경", value: "지도 거리와 실제 체감거리 차이를 확인", importance: 5, status: "beta", source: "카카오맵 길찾기 연결" },
  { id: "time", group: "입지·동선", title: "시간대 분석", information: "출근·퇴근·야간 교통과 유동인구", value: "낮과 밤의 지역 분위기 차이를 확인", importance: 5, status: "connect", source: "시간대별 교통·유동인구 원천 필요" },
  { id: "night", group: "입지·동선", title: "야간 임장", information: "가로등·골목·편의점·보행 동선", value: "밤의 생활환경과 귀가 동선을 확인", importance: 4, status: "connect", source: "공공 조도·현장 제보 데이터 필요" },
  { id: "commute", group: "입지·동선", title: "Door-to-Door 출퇴근", information: "집에서 회사까지 실제 예상 경로", value: "직선거리 대신 매일 쓰는 생활시간을 비교", importance: 5, status: "live", source: "카카오맵 경로 검색" },
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
function formatDongMetric(stat: DongMarketStat | undefined, metric: DongMetric) {
  if (!stat?.count) return "거래 없음";
  if (metric === "price") return compactPrice(stat.median);
  if (metric === "py") return `${compactPrice(stat.perPy)}/평`;
  return `${stat.count}건`;
}
function monthLabel(value: string) { const [year, month] = value.split("-"); return `${year.slice(2)}.${month}`; }
function shiftMonth(value: string, offset: number) { if (!value) return ""; const [year, month] = value.split("-").map(Number); const date = new Date(year, month - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

function loadKakaoMap(appKey: string) {
  if (window.__jipgapsKakaoMap) return window.__jipgapsKakaoMap;
  window.__jipgapsKakaoMap = new Promise<void>((resolve, reject) => {
    const finish = () => window.kakao?.maps.load(() => resolve());
    if (window.kakao?.maps) { finish(); return; }
    document.querySelector<HTMLScriptElement>('script[data-jipgaps-kakao-map="true"]')?.remove();
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true; script.defer = true; script.dataset.jipgapsKakaoMap = "true";
    const timeout = window.setTimeout(() => reject(new Error("카카오 지도 연결 시간이 초과되었습니다.")), 12000);
    script.onload = () => { window.clearTimeout(timeout); if (window.kakao?.maps) finish(); else reject(new Error("카카오 지도 SDK 초기화에 실패했습니다.")); };
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error("카카오 지도 SDK를 불러오지 못했습니다. JavaScript 키와 허용 도메인을 확인해주세요.")); };
    document.head.appendChild(script);
  }).catch((error) => { window.__jipgapsKakaoMap = undefined; throw error; });
  return window.__jipgapsKakaoMap;
}

function safeMapMessage(error: unknown) {
  return error instanceof Error ? error.message : "카카오 지도를 표시하지 못했습니다.";
}

function safelyRemoveKakaoOverlay(overlay: KakaoOverlayInstance) {
  try { overlay.setMap(null); } catch { /* Ignore cleanup errors from an incomplete map instance. */ }
}

function safelyRemoveKakaoListener(listener: KakaoEventListener) {
  try { window.kakao?.maps.event.removeListener(listener.target, listener.eventName, listener.listener); } catch { /* Ignore cleanup errors from an incomplete SDK. */ }
}

function kakaoLevelForZoom(zoom: number) {
  return Math.max(1, Math.min(14, 20 - zoom));
}

function MapFallback({ lat, lng, title, message }: { lat: number; lng: number; title: string; message: string }) {
  const delta = .035;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  const kakaoUrl = `https://map.kakao.com/link/map/${encodeURIComponent(title)},${lat},${lng}`;
  return <div className="safe-map-fallback">
    <iframe title={`${title} 안전 지도`} src={src} loading="lazy" referrerPolicy="no-referrer" />
    <div className="safe-map-notice"><b>안전 지도로 전환됨</b><span>{message}</span><a href={kakaoUrl} target="_blank" rel="noreferrer">카카오맵에서 열기 →</a></div>
  </div>;
}

function PriceChart({ points, unit, theme }: { points: ChartPoint[]; unit: "price" | "py"; theme: ResolvedTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; const host = canvas?.parentElement;
    if (!canvas || !host || !points.length) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1; const width = host.clientWidth; const height = host.clientHeight;
      canvas.width = width * ratio; canvas.height = height * ratio; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const rootStyle = getComputedStyle(document.documentElement); const color = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback;
      const chartGrid = color("--chart-grid", "#e5e7eb"); const chartGridSoft = color("--chart-grid-soft", "#eef0f3"); const chartMuted = color("--chart-muted", "#667085"); const chartText = color("--chart-text", "#1d1d1f"); const chartPrice = color("--chart-price", "#0071e3"); const chartAverage = color("--chart-average", "#8b95a5"); const chartTooltip = color("--chart-tooltip", "#fffffff5"); const chartBorder = color("--chart-border", "#dfe3e8"); const chartPointStroke = color("--chart-point-stroke", "#ffffff");
      const pad = { left: 15, right: 72, top: 22, bottom: 30 }; const volumeH = 64; const gap = 18;
      const chartBottom = height - pad.bottom - volumeH - gap; const plotW = width - pad.left - pad.right; const plotH = chartBottom - pad.top;
      const all = points.flatMap((point) => [point.price, point.average]).filter(Boolean); const rawMin = Math.min(...all); const rawMax = Math.max(...all);
      const margin = Math.max((rawMax - rawMin) * .18, rawMax * .035, 1); const min = rawMin - margin; const max = rawMax + margin;
      const xAt = (index: number) => points.length === 1 ? pad.left + plotW / 2 : pad.left + plotW * index / (points.length - 1);
      const yAt = (value: number) => pad.top + (max - value) / (max - min) * plotH;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) { const y = pad.top + plotH * i / 4; ctx.strokeStyle = chartGrid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.fillStyle = chartMuted; ctx.fillText(compactPrice(max - (max - min) * i / 4), width - pad.right + 10, y + 4); }
      const labelStep = Math.max(1, Math.ceil(points.length / 7));
      points.forEach((point, index) => { if (index % labelStep === 0 || index === points.length - 1) { const x = xAt(index); ctx.strokeStyle = chartGridSoft; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.fillStyle = chartMuted; ctx.textAlign = "center"; ctx.fillText(monthLabel(point.month), x, height - 8); } });
      const maxVolume = Math.max(...points.map((point) => point.volume), 1); const barW = Math.max(3, Math.min(18, plotW / points.length * .58));
      points.forEach((point, index) => { const x = xAt(index); const h = point.volume / maxVolume * volumeH; ctx.fillStyle = index && point.price < points[index - 1].price ? color("--chart-volume-down", "#8ec5ff") : color("--chart-volume-up", "#b8d9ff"); ctx.fillRect(x - barW / 2, height - pad.bottom - h, barW, h); });
      const renderLine = (field: "price" | "average", color: string, widthLine: number) => { ctx.beginPath(); points.forEach((point, index) => { const x = xAt(index); const y = yAt(point[field]); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = widthLine; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); };
      renderLine("average", chartAverage, 1.5); renderLine("price", chartPrice, 2.3);
      const active = hover ?? points.length - 1; const point = points[active]; const x = xAt(active); const y = yAt(point.price);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = color("--chart-crosshair", "#9aa8ba88"); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = chartPrice; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = chartPointStroke; ctx.lineWidth = 2; ctx.stroke();
      const tag = compactPrice(point.price); ctx.fillStyle = chartPrice; ctx.fillRect(width - pad.right + 4, y - 11, 64, 22); ctx.fillStyle = "#fff"; ctx.font = "700 11px ui-monospace"; ctx.textAlign = "center"; ctx.fillText(tag, width - pad.right + 36, y + 4);
      const boxW = 166; const boxX = Math.min(width - pad.right - boxW - 8, Math.max(pad.left + 8, x + (x > width / 2 ? -boxW - 14 : 14))); const boxY = pad.top + 8;
      ctx.fillStyle = chartTooltip; ctx.strokeStyle = chartBorder; ctx.lineWidth = 1; ctx.fillRect(boxX, boxY, boxW, 66); ctx.strokeRect(boxX, boxY, boxW, 66);
      ctx.textAlign = "left"; ctx.fillStyle = chartMuted; ctx.font = "10px sans-serif"; ctx.fillText(`${point.month} · 거래 ${point.volume}건`, boxX + 11, boxY + 17); ctx.fillStyle = chartText; ctx.font = "700 13px sans-serif"; ctx.fillText(formatPrice(point.price), boxX + 11, boxY + 38); ctx.fillStyle = chartMuted; ctx.font = "10px sans-serif"; ctx.fillText(`3개월 이동평균 ${formatPrice(point.average)}`, boxX + 11, boxY + 56);
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(host); return () => observer.disconnect();
  }, [points, hover, theme, unit]);

  return <canvas ref={canvasRef} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const plotWidth = rect.width - 87; const index = Math.round(((event.clientX - rect.left - 15) / plotWidth) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, index))); }} onPointerLeave={() => setHover(null)} aria-label="월별 실거래 중위가격과 거래량 차트" />;
}

function KakaoPlaceMap({ location, title, places, active }: { location: PropertyLocation; title: string; places: NearbyPlace[]; active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null); const [mapError, setMapError] = useState("");
  useEffect(() => {
    const host = hostRef.current; const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY; let disposed = false; const overlays: KakaoOverlayInstance[] = [];
    if (!host || !active) return;
    if (!appKey) { const timer = window.setTimeout(() => setMapError("카카오 지도 JavaScript 키가 연결되지 않았습니다."), 0); return () => window.clearTimeout(timer); }
    loadKakaoMap(appKey).then(() => {
      if (disposed || !window.kakao?.maps) return;
      const maps = window.kakao.maps; const center = new maps.LatLng(location.lat, location.lng);
      const map = new maps.Map(host, { center, level: 5 });
      map.addControl?.(new maps.ZoomControl(), maps.ControlPosition.TOPRIGHT);
      overlays.push(new maps.Circle({ map, center, radius: 1000, strokeColor: "#0071e3", strokeOpacity: .34, strokeWeight: 1, fillColor: "#0071e3", fillOpacity: .035 }));
      overlays.push(new maps.Circle({ map, center, radius: 500, strokeColor: "#0071e3", strokeOpacity: .72, strokeWeight: 2, fillColor: "#0071e3", fillOpacity: .065 }));
      overlays.push(new maps.CustomOverlay({ position: center, map, content: `<div class="nearby-home-pin"><b>${escapeMapHtml(title)}</b><span>선택 단지</span></div>`, xAnchor: .5, yAnchor: 1, zIndex: 100 }));
      const colors = Object.fromEntries(NEARBY_CATEGORIES.map((category) => [category.label, category.color]));
      places.slice(0, 28).forEach((place) => { const position = new maps.LatLng(place.lat, place.lng); overlays.push(new maps.CustomOverlay({ position, map, content: `<div class="nearby-place-pin" title="${escapeMapHtml(`${place.subCategory} · ${place.name} · ${place.distance}m`)}" style="--pin:${colors[place.category] || "#526173"}"><i></i><b>${escapeMapHtml(place.subCategory || place.category)} · ${escapeMapHtml(place.name)}</b><span>${place.distance}m</span></div>`, xAnchor: .16, yAnchor: .5, zIndex: Math.max(10, 70 - Math.round(place.distance / 30)) })); });
      setMapError("");
    }).catch((error) => { if (!disposed) setMapError(safeMapMessage(error)); });
    return () => { disposed = true; overlays.forEach(safelyRemoveKakaoOverlay); host.replaceChildren(); };
  }, [active, location.lat, location.lng, places, title]);
  return <div className="naver-map-frame">{mapError ? <MapFallback lat={location.lat} lng={location.lng} title={title} message={mapError} /> : <div ref={hostRef} className="naver-map-canvas" role="img" aria-label={`${title}와 주변 생활시설 카카오 지도`} />}</div>;
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

function nearbyDongContext(data: GeoJsonFeatureCollection, selectedBoundaryDong: string, selectedDong: string) {
  const selectedFeatures = data.features.filter((feature) => {
    const name = String(feature.properties.name || "");
    return selectedBoundaryDong ? name === selectedBoundaryDong : legalDongName(name) === selectedDong;
  });
  const targets = selectedFeatures.length ? selectedFeatures : data.features.filter((feature) => legalDongName(String(feature.properties.name || "")) === selectedDong);
  const targetExtent = geoJsonExtent({ type: "FeatureCollection", features: targets });
  if (!targetExtent) return { boundaryDongs: [] as string[], legalDongs: [] as string[] };
  const lngPad = Math.max((targetExtent.maxLng - targetExtent.minLng) * .72, .006);
  const latPad = Math.max((targetExtent.maxLat - targetExtent.minLat) * .72, .005);
  const expanded = { minLng: targetExtent.minLng - lngPad, minLat: targetExtent.minLat - latPad, maxLng: targetExtent.maxLng + lngPad, maxLat: targetExtent.maxLat + latPad };
  const selectedNames = new Set(targets.map((feature) => String(feature.properties.name || "")));
  const boundaryDongs = data.features.filter((feature) => {
    const extent = geoJsonExtent({ type: "FeatureCollection", features: [feature] });
    if (!extent) return false;
    return extent.maxLng >= expanded.minLng && extent.minLng <= expanded.maxLng && extent.maxLat >= expanded.minLat && extent.minLat <= expanded.maxLat;
  }).map((feature) => String(feature.properties.name || "")).filter((name) => name && !selectedNames.has(name));
  const legalDongs = [...new Set(boundaryDongs.map(legalDongName).filter((name) => name && name !== selectedDong))];
  return { boundaryDongs, legalDongs };
}

type AdministrativeFocus = "national" | "sido" | "district";
type ProjectedBoundary = { code: string; name: string; path: string; centerX: number; centerY: number; width: number; height: number };
const NATIONAL_LABEL_OFFSETS: Record<string, [number, number]> = {
  "서울특별시": [48, -32], "인천광역시": [-28, 9], "세종특별자치시": [-36, -38], "대전광역시": [26, 10],
  "대구광역시": [-18, 12], "울산광역시": [24, 8], "부산광역시": [20, 16], "전남광주통합특별시": [-26, 8],
};
const SIDO_MAP_LABELS: Record<string, string> = {
  "서울특별시": "서울", "경기도": "경기", "인천광역시": "인천", "부산광역시": "부산", "대구광역시": "대구", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
  "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남", "전남광주통합특별시": "전남·광주", "전북특별자치도": "전북", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주",
};
const NATIONAL_PRIMARY_LABELS = new Set(["경기도", "강원특별자치도", "충청남도", "전북특별자치도", "전남광주통합특별시", "경상북도", "경상남도", "제주특별자치도"]);
const ROAD_MAP_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY);

function compactAdministrativeLabel(name: string, focus: AdministrativeFocus) {
  if (focus === "national") return SIDO_MAP_LABELS[name] || name;
  const compact = name.replace(/\s+/g, "");
  if (focus === "sido") {
    const cityDistrict = compact.match(/^.+?시(.+구)$/);
    if (cityDistrict) return cityDistrict[1];
    const shortened = compact.replace(/특별자치시$|특별시$|광역시$|자치시$|시$|군$|구$/, "");
    return shortened.length > 1 ? shortened : compact;
  }
  return compact;
}

function visibleAdministrativeLabels(boundaries: ProjectedBoundary[], focus: AdministrativeFocus, selectedCode: string) {
  const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
  const visible = new Set<string>();
  const limit = focus === "national" ? 9 : focus === "sido" ? 7 : 8;
  const candidates = [...boundaries]
    .filter((boundary) => focus !== "national" || boundary.code === selectedCode || NATIONAL_PRIMARY_LABELS.has(boundary.name))
    .sort((a, b) => Number(b.code === selectedCode) - Number(a.code === selectedCode) || b.width * b.height - a.width * a.height);
  candidates.forEach((boundary) => {
    if (visible.size >= limit && boundary.code !== selectedCode) return;
    const label = compactAdministrativeLabel(boundary.name, focus);
    const offset = focus === "national" ? NATIONAL_LABEL_OFFSETS[boundary.name] || [0, 0] : [0, 0];
    const centerX = boundary.centerX + offset[0]; const centerY = boundary.centerY + offset[1];
    const boxWidth = Math.max(52, label.length * (focus === "district" ? 23 : 21));
    const boxHeight = focus === "district" ? 38 : 34;
    const box = { left: centerX - boxWidth / 2, right: centerX + boxWidth / 2, top: centerY - boxHeight / 2, bottom: centerY + boxHeight / 2 };
    const selected = boundary.code === selectedCode;
    const overlaps = occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
    if (selected || !overlaps) { visible.add(boundary.code); occupied.push(box); }
  });
  return visible;
}

function coordinateRings(value: unknown) {
  const rings: number[][][] = [];
  const visit = (item: unknown) => {
    if (!Array.isArray(item) || !item.length) return;
    if (Array.isArray(item[0]) && typeof item[0][0] === "number" && typeof item[0][1] === "number") rings.push(item as number[][]);
    else item.forEach(visit);
  };
  visit(value);
  return rings;
}

function expandGeoExtent(extent: NonNullable<ReturnType<typeof geoJsonExtent>>, lngRatio: number, latRatio: number) {
  const lngPad = (extent.maxLng - extent.minLng) * lngRatio;
  const latPad = (extent.maxLat - extent.minLat) * latRatio;
  return { minLng: extent.minLng - lngPad, minLat: extent.minLat - latPad, maxLng: extent.maxLng + lngPad, maxLat: extent.maxLat + latPad };
}

function projectAdministrativeBoundaries(data: GeoJsonFeatureCollection, width = 760, height = 560, viewportExtent?: NonNullable<ReturnType<typeof geoJsonExtent>>) {
  const extent = viewportExtent || geoJsonExtent(data);
  if (!extent) return [];
  const pad = 12;
  const lngSpan = Math.max(.001, extent.maxLng - extent.minLng); const latSpan = Math.max(.001, extent.maxLat - extent.minLat);
  const scale = Math.min((width - pad * 2) / lngSpan, (height - pad * 2 - 14) / latSpan);
  const contentWidth = lngSpan * scale; const contentHeight = latSpan * scale;
  const offsetX = (width - contentWidth) / 2; const offsetY = (height - contentHeight) / 2 - 5;
  return data.features.map((feature) => {
    const rings = coordinateRings(feature.geometry.coordinates); const points = rings.flat();
    const projected = points.map(([lng, lat]) => [offsetX + (lng - extent.minLng) * scale, offsetY + (extent.maxLat - lat) * scale]);
    const xs = projected.map((point) => point[0]); const ys = projected.map((point) => point[1]);
    const path = rings.map((ring) => ring.map(([lng, lat], index) => `${index ? "L" : "M"}${(offsetX + (lng - extent.minLng) * scale).toFixed(1)},${(offsetY + (extent.maxLat - lat) * scale).toFixed(1)}`).join(" ") + " Z").join(" ");
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return { code: String(feature.properties.code || ""), name: String(feature.properties.name || ""), path, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
  }).filter((feature) => feature.path && feature.name);
}

function KoreaFocusLocator({ active, selectedSido }: { active: boolean; selectedSido: string }) {
  const [data, setData] = useState<GeoJsonFeatureCollection | null>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch("/data/boundaries/sido.json", { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("대한민국 경계를 불러오지 못했습니다."))).then(setData).catch(() => { /* The primary administrative map remains available if this context view fails. */ });
    return () => controller.abort();
  }, [active]);
  const boundaries = useMemo(() => data ? projectAdministrativeBoundaries(data, 240, 190) : [], [data]);
  if (!boundaries.length) return null;
  return <aside className="country-focus-locator" aria-label={`대한민국 안에서 ${selectedSido}의 위치`}><div><span>대한민국 안의 위치</span><b>{selectedSido}</b></div><svg viewBox="0 0 240 190" role="img" aria-label={`${selectedSido}가 윤곽선으로 표시된 대한민국 지도`}>{boundaries.map((boundary) => { const selected = boundary.name === selectedSido; return <g key={boundary.code} className={`country-focus-region${selected ? " selected" : ""}`}><path className="country-focus-surface" d={boundary.path} fillRule="evenodd" /></g>; })}</svg><small>현재 시·도의 위치를 보여줍니다.</small></aside>;
}

function AdministrativeMarketMap({ focus, active, markets, selectedSido, activeRegion, selectedDong, selectedBoundaryDong, dongStats, dongMetric, onDongMetricChange, onSelectSido, onSelectRegion, onSelectDong, onOpenBuildings }: {
  focus: AdministrativeFocus; active: boolean; markets: OverviewMarket[]; selectedSido: string; activeRegion: Region; selectedDong: string; selectedBoundaryDong: string; dongStats: Record<string, DongMarketStat>; dongMetric: DongMetric;
  onDongMetricChange: (metric: DongMetric) => void; onSelectSido: (sido: string) => void; onSelectRegion: (region: Region) => void; onSelectDong: (dong: string) => void; onOpenBuildings: () => void;
}) {
  const [data, setData] = useState<GeoJsonFeatureCollection | null>(null); const [boundaryError, setBoundaryError] = useState(""); const [boundaryRetry, setBoundaryRetry] = useState(0);
  const [capitalContext, setCapitalContext] = useState<GeoJsonFeatureCollection | null>(null);
  const boundaryUrl = focus === "national" ? "/data/boundaries/sido.json" : focus === "sido" ? `/data/boundaries/sgg/${SIDO_CODES[selectedSido]}.json` : `/data/boundaries/emd/${activeRegion.code}.json`;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => {
      setData(null); setBoundaryError("");
      fetch(boundaryUrl, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error("행정경계 데이터를 불러오지 못했습니다."); return response.json(); }).then(setData).catch((error) => { if (error instanceof Error && error.name !== "AbortError") setBoundaryError(error.message); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [active, boundaryRetry, boundaryUrl]);
  useEffect(() => {
    if (!active || focus !== "sido" || selectedSido !== "서울특별시") return;
    const controller = new AbortController();
    fetch("/data/boundaries/sido.json", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("수도권 경계를 불러오지 못했습니다.")))
      .then(setCapitalContext)
      .catch(() => setCapitalContext(null));
    return () => controller.abort();
  }, [active, focus, selectedSido]);
  const mapExtent = useMemo(() => {
    if (!data) return undefined;
    const extent = geoJsonExtent(data);
    return focus === "sido" && selectedSido === "서울특별시" && extent ? expandGeoExtent(extent, .3, .24) : undefined;
  }, [data, focus, selectedSido]);
  const boundaries = useMemo(() => data ? projectAdministrativeBoundaries(data, 760, 560, mapExtent) : [], [data, mapExtent]);
  const capitalBoundaries = useMemo(() => {
    if (!capitalContext || !mapExtent) return [];
    const nearby = { ...capitalContext, features: capitalContext.features.filter((feature) => ["서울특별시", "경기도", "인천광역시"].includes(String(feature.properties.name || ""))) };
    return projectAdministrativeBoundaries(nearby, 760, 560, mapExtent);
  }, [capitalContext, mapExtent]);
  const stageTitle = focus === "national" ? "대한민국 전체" : focus === "sido" ? selectedSido : `${activeRegion.sido} ${activeRegion.sigungu}`;
  const stageHint = focus === "national" ? "대표 지역명만 크게 표시했습니다. 모든 경계는 바로 선택할 수 있습니다." : focus === "sido" ? `${selectedSido} 안의 시·군·구를 누르면 다음 지도로 이동합니다.` : `지역명을 크게 보기 위해 대표 동만 표시합니다. 경계를 누르면 같은 지도에서 선택됩니다.`;
  const districtValues = Object.values(dongStats).map((stat) => dongMetric === "price" ? stat.median : dongMetric === "py" ? stat.perPy : stat.count).filter((value) => value > 0);
  const districtMid = districtValues.length ? median(districtValues) : 0;
  const isSelected = (boundary: ProjectedBoundary) => focus === "national" ? boundary.name === selectedSido : focus === "sido" ? boundary.code === activeRegion.code : selectedBoundaryDong ? boundary.name === selectedBoundaryDong : selectedDong !== "all" && legalDongName(boundary.name) === selectedDong;
  const selectedBoundaryCode = boundaries.find(isSelected)?.code || "";
  const visibleLabels = useMemo(() => visibleAdministrativeLabels(boundaries, focus, selectedBoundaryCode), [boundaries, focus, selectedBoundaryCode]);
  const selectBoundary = (boundary: ProjectedBoundary) => {
    if (focus === "national") onSelectSido(boundary.name);
    else if (focus === "sido") { const region = REGIONS.find((item) => item.code === boundary.code); if (region) onSelectRegion(region); }
    else onSelectDong(boundary.name);
  };
  const boundaryMetric = (boundary: ProjectedBoundary) => {
    if (focus === "national") { const market = markets.find((item) => item.sido === boundary.name); return market ? `${market.change >= 0 ? "+" : ""}${market.change.toFixed(1)}%` : "집계 중"; }
    if (focus === "district") return formatDongMetric(dongStats[legalDongName(boundary.name)], dongMetric);
    return boundary.code === activeRegion.code ? "선택됨" : "보기";
  };
  const boundaryTone = (boundary: ProjectedBoundary) => {
    if (focus === "district") {
      const stat = dongStats[legalDongName(boundary.name)];
      if (!stat?.count || !districtMid) return "no-data";
      const value = dongMetric === "price" ? stat.median : dongMetric === "py" ? stat.perPy : stat.count;
      return value >= districtMid * 1.15 ? "price-high" : value <= districtMid * .85 ? "price-low" : "price-mid";
    }
    if (focus !== "national") return "neutral";
    const change = markets.find((item) => item.sido === boundary.name)?.change || 0;
    return change > 1 ? "hot" : change < -1 ? "cold" : "flat";
  };
  return <div className={`administrative-market-map level-${focus}`}>
    <div className="administrative-map-head"><div><b>{stageTitle}</b><small>{stageHint}</small></div><div className="administrative-map-actions">{focus === "district" && <div className="dong-metric-tabs" aria-label="동네 가격 지도 지표">{([['price', '중위가격'], ['py', '평당가'], ['volume', '거래량']] as const).map(([metric, label]) => <button type="button" key={metric} className={dongMetric === metric ? "active" : ""} aria-pressed={dongMetric === metric} onClick={() => onDongMetricChange(metric)}>{label}</button>)}</div>}<div className={`administrative-map-key key-${focus}`} aria-label="지도 색상 범례">{focus === "national" ? <><span><i className="cold" />하락</span><span><i className="flat" />보합</span><span><i className="hot" />상승</span></> : focus === "district" ? <><span><i className="price-low" />낮음</span><span><i className="price-mid" />중간</span><span><i className="price-high" />높음</span></> : <span><i className="selected" />선택 경계</span>}</div><div className="administrative-map-mode"><i />행정경계 데이터</div></div></div>
    {data ? <svg className="administrative-map-svg" viewBox={focus === "national" ? "100 0 560 560" : "0 0 760 560"} role="img" aria-label={`${stageTitle} 행정구역 선택 지도`}>
      {capitalBoundaries.length > 0 && <g className="capital-context" aria-hidden="true">
        {capitalBoundaries.map((boundary) => <path key={boundary.code} className={`capital-context-region context-${boundary.code}`} d={boundary.path} fillRule="evenodd" />)}
        <g className="capital-context-labels"><text x="690" y="78" textAnchor="middle">경기도</text><text x="72" y="322" textAnchor="middle">인천광역시</text></g>
      </g>}
      {boundaries.map((boundary) => {
        const selected = isSelected(boundary);
        return <g key={boundary.code} className={`administrative-region tone-${boundaryTone(boundary)}${selected ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`${boundary.name} ${boundaryMetric(boundary)}`} onClick={() => selectBoundary(boundary)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectBoundary(boundary); } }}>
          <title>{boundary.name} · {boundaryMetric(boundary)}</title>
          <path className="administrative-region-hit" d={boundary.path} fillRule="evenodd" />
          <path className="administrative-region-surface" d={boundary.path} fillRule="evenodd" />
        </g>;
      })}
      <g className="administrative-label-layer" aria-hidden="true">{boundaries.map((boundary) => {
        if (!visibleLabels.has(boundary.code)) return null;
        const selected = isSelected(boundary); const offset = focus === "national" ? NATIONAL_LABEL_OFFSETS[boundary.name] || [0, 0] : [0, 0]; const labelX = boundary.centerX + offset[0]; const labelY = boundary.centerY + offset[1];
        return <g key={boundary.code} className={`administrative-label${selected ? " selected" : ""}`} transform={`translate(${labelX} ${labelY})`}>
          {(offset[0] !== 0 || offset[1] !== 0) && <line className="administrative-label-line" x1={-offset[0]} y1={-offset[1]} x2="0" y2="0" />}
          <text className="administrative-label-name" textAnchor="middle" dominantBaseline="middle">{compactAdministrativeLabel(boundary.name, focus)}</text>
        </g>;
      })}</g>
    </svg> : <div className="administrative-map-loading"><i />행정경계를 조립하고 있습니다.</div>}
    <div className="administrative-map-foot"><span><i />선택 지역</span><b>{focus === "national" ? selectedSido : focus === "sido" ? activeRegion.sigungu : selectedBoundaryDong || "동을 선택하세요"}</b><small>{focus === "district" ? selectedBoundaryDong ? `${formatDongMetric(dongStats[legalDongName(selectedBoundaryDong)], dongMetric)} · 선택한 뒤 건물 지도를 열 수 있습니다.` : "경계를 누르면 지역명과 실거래 요약을 먼저 확인합니다." : "경계를 누르면 한 단계씩 확대됩니다."}</small>{focus === "district" && selectedBoundaryDong && <button type="button" className="administrative-map-open" disabled={!ROAD_MAP_AVAILABLE} onClick={onOpenBuildings}>{ROAD_MAP_AVAILABLE ? "건물 지도 보기" : "카카오 지도 키 연결 전"}</button>}</div>
    {boundaryError && <div className="administrative-map-error" role="status"><b>행정경계를 불러오지 못했습니다.</b><span>{boundaryError}</span><button type="button" onClick={() => setBoundaryRetry((value) => value + 1)}>다시 불러오기</button></div>}
  </div>;
}

function KakaoMarketMap({ markets, focus, active, propertyType, selectedSido, activeRegion, selectedDong, selectedBoundaryDong, nearbyBoundaryDongs, nearbyLegalDongs, dongStats, dongMetric, onDongMetricChange, buildingLocations, buildingsLoading, buildingsError, propertyLocation, propertyName, onSelectSido, onSelectRegion, onSelectDong, onOpenBuildings, onSelectProperty }: {
  markets: OverviewMarket[];
  focus: MapFocus;
  active: boolean;
  propertyType: PropertyType;
  selectedSido: string;
  activeRegion: Region;
  selectedDong: string;
  selectedBoundaryDong: string;
  nearbyBoundaryDongs: string[];
  nearbyLegalDongs: string[];
  dongStats: Record<string, DongMarketStat>;
  dongMetric: DongMetric;
  onDongMetricChange: (metric: DongMetric) => void;
  buildingLocations: PropertyMapLocation[];
  buildingsLoading: boolean;
  buildingsError: string;
  propertyLocation: PropertyLocation | null;
  propertyName: string;
  onSelectSido: (sido: string) => void;
  onSelectRegion: (region: Region) => void;
  onSelectDong: (dong: string) => void;
  onOpenBuildings: () => void;
  onSelectProperty: (key: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");
  const stageTitle = focus === "national" ? "대한민국 16개 시·도" : focus === "sido" ? selectedSido : focus === "detail" ? propertyName || "선택 단지" : focus === "buildings" ? `${activeRegion.sido} ${activeRegion.sigungu} · ${selectedDong === "all" ? legalDongName(selectedBoundaryDong) : selectedDong}` : `${activeRegion.sido} ${activeRegion.sigungu}${selectedBoundaryDong ? ` · ${selectedBoundaryDong}` : ""}`;
  const selectedLocationCount = buildingLocations.filter((building) => building.scope === "selected").length;
  const nearbyLocationCount = buildingLocations.length - selectedLocationCount;
  const stageHint = focus === "national" ? "시·도 경계를 눌러 다음 단계로 들어가세요." : focus === "sido" ? "시·군·구 경계를 눌러 읍·면·동 지도로 확대하세요." : focus === "detail" ? "선택한 단지의 검증된 실제 주소 좌표입니다." : focus === "buildings" ? buildingsLoading ? "선택한 동과 인접 동의 최근 실거래 건물 좌표를 확인하고 있습니다." : buildingsError ? buildingsError : `${selectedDong} ${selectedLocationCount}곳 · 인접 ${nearbyLegalDongs.length}개 동 ${nearbyLocationCount}곳을 함께 표시합니다.` : selectedBoundaryDong ? `${legalDongName(selectedBoundaryDong)} 실거래 조건과 연동했습니다.` : "읍·면·동 경계를 누르면 실거래 건물 지도로 확대됩니다.";
  const fallbackLocation = propertyLocation || buildingLocations[0] || SIDO_CENTERS[selectedSido] || { lat: 36.35, lng: 127.85, zoom: 8 };

  useEffect(() => {
    const host = hostRef.current;
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    const controller = new AbortController();
    let disposed = false;
    const overlays: KakaoOverlayInstance[] = [];
    const listeners: KakaoEventListener[] = [];
    if (!host || !active || (focus !== "buildings" && focus !== "detail")) return;
    if (!appKey) {
      const timer = window.setTimeout(() => setMapError("카카오 지도 JavaScript 키가 연결되지 않았습니다."), 0);
      return () => window.clearTimeout(timer);
    }

    const readGeoJson = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("행정경계 데이터를 불러오지 못했습니다.");
      return response.json() as Promise<GeoJsonFeatureCollection>;
    };

    loadKakaoMap(appKey).then(async () => {
      if (disposed || !window.kakao?.maps) return;
      const maps = window.kakao.maps;
      const province = SIDO_CENTERS[selectedSido] || { lat: 36.35, lng: 127.85, zoom: 8 };
      const initial = focus === "detail" && propertyLocation ? { lat: propertyLocation.lat, lng: propertyLocation.lng, zoom: 17 } : province;
      const map = new maps.Map(host, { center: new maps.LatLng(initial.lat, initial.lng), level: kakaoLevelForZoom(initial.zoom) });
      map.addControl?.(new maps.ZoomControl(), maps.ControlPosition.TOPRIGHT);

      const addListener = (target: unknown, eventName: string, listener: (...args: unknown[]) => void) => {
        maps.event.addListener(target, eventName, listener); listeners.push({ target, eventName, listener });
      };
      const fitCollection = (data: GeoJsonFeatureCollection) => {
        const extent = geoJsonExtent(data); if (!extent) return;
        const bounds = new maps.LatLngBounds();
        bounds.extend(new maps.LatLng(extent.minLat, extent.minLng)); bounds.extend(new maps.LatLng(extent.maxLat, extent.maxLng));
        map.setBounds(bounds, 76, 34, 34, 34);
      };
      if (focus === "detail" && propertyLocation) {
        const position = new maps.LatLng(propertyLocation.lat, propertyLocation.lng);
        overlays.push(new maps.CustomOverlay({ position, map, content: `<div class="naver-property-pin" title="${escapeMapHtml(propertyName || "선택 단지")}"><i></i><span>${escapeMapHtml(propertyName || "선택 단지")}</span></div>`, xAnchor: .5, yAnchor: 1, zIndex: 100 }));
        setMapError("");
        return;
      }

      if (focus === "buildings") {
        const dongs = await readGeoJson(`/data/boundaries/emd/${activeRegion.code}.json`);
        if (disposed) return;
        const targetDong = selectedBoundaryDong || selectedDong;
        const nearbyBoundarySet = new Set(nearbyBoundaryDongs);
        dongs.features.forEach((feature) => {
          const name = String(feature.properties.name || "");
          const selected = selectedBoundaryDong ? name === targetDong : legalDongName(name) === selectedDong;
          const nearby = nearbyBoundarySet.has(name);
          const geometryType = String(feature.geometry.type || "");
          const rawCoordinates = feature.geometry.coordinates;
          const polygonCoordinates = geometryType === "Polygon" ? [rawCoordinates] : geometryType === "MultiPolygon" && Array.isArray(rawCoordinates) ? rawCoordinates : [];
          polygonCoordinates.forEach((polygonValue) => {
            if (!Array.isArray(polygonValue)) return;
            const path = polygonValue.map((ringValue) => Array.isArray(ringValue) ? ringValue.flatMap((coordinate) => Array.isArray(coordinate) && typeof coordinate[0] === "number" && typeof coordinate[1] === "number" ? [new maps.LatLng(coordinate[1], coordinate[0])] : []) : []).filter((ring) => ring.length >= 3);
            if (!path.length) return;
            const polygon = new maps.Polygon({ map, path, clickable: true, fillColor: selected ? "#0068d8" : nearby ? "#8fc6ef" : "#dbe5ed", fillOpacity: selected ? .27 : nearby ? .13 : .025, strokeColor: selected ? "#0054b1" : nearby ? "#4389bb" : "#aebbc7", strokeWeight: selected ? 3 : nearby ? 1.5 : .7, strokeOpacity: selected ? 1 : nearby ? .8 : .28, strokeStyle: "solid", zIndex: selected ? 4 : nearby ? 3 : 1 });
            overlays.push(polygon); addListener(polygon, "click", () => { if (name) onSelectDong(name); });
          });
        });
        const visibleDongs = dongs.features.filter((feature) => {
          const name = String(feature.properties.name || "");
          const selected = selectedBoundaryDong ? name === targetDong : legalDongName(name) === selectedDong;
          return selected || nearbyBoundarySet.has(name);
        });
        if (visibleDongs.length) fitCollection({ type: "FeatureCollection", features: visibleDongs });
        else fitCollection(dongs);
        buildingLocations.forEach((building) => {
          const button = document.createElement("button");
          button.type = "button"; button.className = `naver-building-pin kind-${building.propertyType} scope-${building.scope}`; button.setAttribute("aria-label", `${building.dong} ${building.name} ${formatPrice(building.lastAmount)}`); button.innerHTML = `<strong>${escapeMapHtml(formatPrice(building.lastAmount))}</strong><span>${escapeMapHtml(building.scope === "selected" ? selectedDong : building.dong)} · ${building.count}건</span>`; button.addEventListener("click", () => onSelectProperty(building.key));
          overlays.push(new maps.CustomOverlay({ position: new maps.LatLng(building.lat, building.lng), map, content: button, xAnchor: .18, yAnchor: 1, zIndex: (building.scope === "selected" ? 90 : 40) + Math.min(building.count, 50) }));
        });
        setMapError("");
        return;
      }

      setMapError("");
    }).catch((error) => { if (!disposed && (!(error instanceof Error) || error.name !== "AbortError")) setMapError(safeMapMessage(error)); });

    return () => {
      disposed = true; controller.abort(); listeners.forEach(safelyRemoveKakaoListener); overlays.forEach(safelyRemoveKakaoOverlay); host.replaceChildren();
    };
  }, [active, activeRegion.code, activeRegion.sigungu, activeRegion.sido, buildingLocations, buildingsError, buildingsLoading, focus, markets, nearbyBoundaryDongs, nearbyLegalDongs, onSelectDong, onSelectProperty, onSelectRegion, onSelectSido, propertyLocation, propertyName, propertyType, selectedBoundaryDong, selectedDong, selectedSido]);

  if (focus === "national" || focus === "sido" || focus === "district") return <AdministrativeMarketMap key={`${focus}-${selectedSido}-${activeRegion.code}`} focus={focus} active={active} markets={markets} selectedSido={selectedSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} dongStats={dongStats} dongMetric={dongMetric} onDongMetricChange={onDongMetricChange} onSelectSido={onSelectSido} onSelectRegion={onSelectRegion} onSelectDong={onSelectDong} onOpenBuildings={onOpenBuildings} />;

  return <div className="naver-market-map">
    {mapError ? <MapFallback lat={fallbackLocation.lat} lng={fallbackLocation.lng} title={stageTitle} message={mapError} /> : <div ref={hostRef} className="naver-market-canvas" aria-label={`${stageTitle} 카카오 지도`} />}
    <KoreaFocusLocator active={active} selectedSido={selectedSido} />
    <div className="map-stage-card"><span>{focus === "buildings" ? "BUILDINGS" : "PROPERTY"}</span><b>{stageTitle}</b><small>{stageHint}</small></div>
    {focus === "buildings" && <div className={`building-map-legend kind-${propertyType}`}><i /><span>현재 표시</span><b>{PROPERTY_MAP_META[propertyType].label}</b><small>진한 마커는 {selectedDong} · 연한 마커는 주변 동</small></div>}
  </div>;
}

export default function Home() {
  const navRef = useRef<HTMLElement>(null);
  const themeInteractedRef = useRef(false);
  const [type, setType] = useState<PropertyType>("apt"); const [period, setPeriod] = useState(12); const [regionCode, setRegionCode] = useState("11680");
  const [regionInput, setRegionInput] = useState("서울특별시 강남구"); const [query, setQuery] = useState(""); const [submittedQuery, setSubmittedQuery] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]); const [properties, setProperties] = useState<Property[]>([]); const [selectedKey, setSelectedKey] = useState("");
  const [selectedDong, setSelectedDong] = useState("all"); const [selectedBuildingDong, setSelectedBuildingDong] = useState(""); const [selectedAreaBucket, setSelectedAreaBucket] = useState<number | null>(null); const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [area, setArea] = useState("all"); const [unit, setUnit] = useState<"price" | "py">("price"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [dataRetry, setDataRetry] = useState(0);
  const [markets, setMarkets] = useState<OverviewMarket[]>([]); const [marketMonth, setMarketMonth] = useState(""); const [marketError, setMarketError] = useState(""); const [marketRetry, setMarketRetry] = useState(0);
  const [buildingSort, setBuildingSort] = useState<"volume" | "price" | "rise" | "fall">("volume"); const [minVolume, setMinVolume] = useState(0); const [propertyLimit, setPropertyLimit] = useState(30); const [marketSort, setMarketSort] = useState<"volume" | "price" | "rise" | "fall">("volume");
  const [policyItems, setPolicyItems] = useState<readonly PolicyItem[]>(POLICIES); const [policyUpdated, setPolicyUpdated] = useState("");
  const [activeSection, setActiveSection] = useState("home"); const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0 });
  const [themePreference, setThemePreference] = useState<ThemePreference>("system"); const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [selectedMapSido, setSelectedMapSido] = useState("서울특별시"); const [mapFocus, setMapFocus] = useState<MapFocus>("district"); const [selectedBoundaryDong, setSelectedBoundaryDong] = useState(""); const [boundaryDongOptions, setBoundaryDongOptions] = useState<string[]>([]); const [nearbyBoundaryDongs, setNearbyBoundaryDongs] = useState<string[]>([]); const [nearbyLegalDongs, setNearbyLegalDongs] = useState<string[]>([]); const [mapPickerDong, setMapPickerDong] = useState(""); const [dongMetric, setDongMetric] = useState<DongMetric>("price");
  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([]);
  const [fieldGroup, setFieldGroup] = useState(FIELD_GROUPS[0]); const [fieldFeatureId, setFieldFeatureId] = useState("region"); const [timeSlotIndex, setTimeSlotIndex] = useState(3); const [noiseSources, setNoiseSources] = useState(() => NOISE_SOURCES.map((source) => source.id));
  const [commuteDestination, setCommuteDestination] = useState(""); const [lifestyleKeyword, setLifestyleKeyword] = useState("마트");
  const [researchCategory, setResearchCategory] = useState("price"); const [researchTool, setResearchTool] = useState("recent-fall");
  const [communityCategory, setCommunityCategory] = useState("living"); const [communityBoard, setCommunityBoard] = useState("전체");
  const [showStudyWriter, setShowStudyWriter] = useState(false); const [studyTitle, setStudyTitle] = useState(""); const [studyBody, setStudyBody] = useState(""); const [draftSaved, setDraftSaved] = useState(false);
  const [propertyLocation, setPropertyLocation] = useState<PropertyLocation | null>(null); const [locationLoading, setLocationLoading] = useState(false); const [locationError, setLocationError] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]); const [nearbyLoading, setNearbyLoading] = useState(false); const [nearbyError, setNearbyError] = useState(""); const [nearbyCategory, setNearbyCategory] = useState("전체"); const [nearbySubtype, setNearbySubtype] = useState("전체");
  const [buildingLocations, setBuildingLocations] = useState<PropertyMapLocation[]>([]); const [buildingsLoading, setBuildingsLoading] = useState(false); const [buildingsError, setBuildingsError] = useState("");
  const activeRegion = REGIONS.find((item) => item.code === regionCode) || REGIONS[0];
  const chooseThemePreference = (next: ThemePreference) => { themeInteractedRef.current = true; try { window.localStorage.setItem("jipgaps:theme", next); } catch { /* device storage is optional */ } setThemePreference(next); };

  useEffect(() => { const timer = window.setTimeout(() => { try { const stored = window.localStorage.getItem("jipgaps:saved-homes"); if (stored) setSavedHomes(JSON.parse(stored)); const draft = window.localStorage.getItem("jipgaps:study-draft"); if (draft) { const parsed = JSON.parse(draft); setStudyTitle(parsed.title || ""); setStudyBody(parsed.body || ""); } } catch { /* device storage is optional */ } }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { try { const stored = window.localStorage.getItem("jipgaps:theme"); if (stored === "light" || stored === "dark" || stored === "system") setThemePreference(stored); } catch { /* device storage is optional */ } }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const bootstrapped = document.documentElement.dataset.themePreference;
      if (!themeInteractedRef.current && themePreference === "system" && (bootstrapped === "light" || bootstrapped === "dark")) return;
      const next: ResolvedTheme = themePreference === "system" ? media.matches ? "dark" : "light" : themePreference;
      document.documentElement.dataset.theme = next;
      document.documentElement.dataset.themePreference = themePreference;
      document.documentElement.style.colorScheme = next;
      setResolvedTheme(next);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themePreference]);

  useEffect(() => { const syncHash = () => { const next = window.location.hash.slice(1); if (NAV_ITEMS.some((item) => item.id === next)) { setActiveSection(next); if (next === "field") { const requestedId = new URLSearchParams(window.location.search).get("feature"); const requestedFeature = FIELD_FEATURES.find((feature) => feature.id === requestedId); if (requestedFeature) { setFieldGroup(requestedFeature.group); setFieldFeatureId(requestedFeature.id); } } window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }))); } }; syncHash(); window.addEventListener("hashchange", syncHash); return () => window.removeEventListener("hashchange", syncHash); }, []);

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
  }, [type, regionCode, period, submittedQuery, dataRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { setMarketError(""); fetch(`/api/overview?type=${type}&basis=quarter-v2`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error || !data.markets) throw new Error(data.error || "전국 실거래 집계를 불러오지 못했습니다."); return data; }).then((data) => { setMarkets(data.markets); setMarketMonth(data.month); }).catch((reason) => { if (reason.name !== "AbortError") setMarketError(reason.message); }); }, marketRetry ? 0 : 3000);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [type, marketRetry]);

  useEffect(() => {
    const controller = new AbortController(); fetch("/api/policies", { signal: controller.signal }).then((response) => response.json()).then((data) => { if (data.policies?.length) { setPolicyItems(data.policies); setPolicyUpdated(data.updatedAt); } }).catch(() => undefined); return () => controller.abort();
  }, []);

  const scopedTrades = useMemo(() => selectedDong === "all" ? trades : trades.filter((trade) => trade.dong === selectedDong), [trades, selectedDong]);
  const propertyTrades = useMemo(() => selectedKey ? scopedTrades.filter((trade) => trade.propertyKey === selectedKey && (!selectedBuildingDong || trade.buildingDong === selectedBuildingDong) && (selectedAreaBucket === null || areaBucket(trade.area) === selectedAreaBucket)) : scopedTrades, [scopedTrades, selectedKey, selectedBuildingDong, selectedAreaBucket]);
  const areas = useMemo(() => selectedKey ? [...new Set(propertyTrades.map((trade) => Math.round(trade.area * 10) / 10).filter(Boolean))].sort((a, b) => a - b) : [], [propertyTrades, selectedKey]);
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
      const params = new URLSearchParams({ query: placeAddressQuery, sido: activeRegion.sido, sigungu: activeRegion.sigungu, dong: placePropertyDong });
      fetch(`/api/geocode?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "단지 위치를 확인하지 못했습니다."); return data; }).then((data) => setPropertyLocation({ lat: data.lat, lng: data.lng, roadAddress: data.roadAddress || "", jibunAddress: data.jibunAddress || "" })).catch((reason) => { if (reason.name !== "AbortError") { setLocationError(reason.message); setPropertyLocation(null); } }).finally(() => { if (!controller.signal.aborted) setLocationLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeRegion.sigungu, activeRegion.sido, placeAddressQuery, placePropertyDong, placePropertyKey]);
  useEffect(() => {
    const controller = new AbortController(); const timer = window.setTimeout(() => {
      if (!propertyLocation) { setNearbyPlaces([]); setNearbyError(""); return; }
      setNearbyLoading(true); setNearbyError(""); setNearbyCategory("전체"); setNearbySubtype("전체");
      const nearbyArea = `${placeRegion} ${placePropertyDong}`.trim();
      fetch(`/api/nearby?taxonomy=2&lat=${propertyLocation.lat}&lng=${propertyLocation.lng}&area=${encodeURIComponent(nearbyArea)}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "주변 시설을 불러오지 못했습니다."); return data; }).then((data) => setNearbyPlaces(data.places || [])).catch((reason) => { if (reason.name !== "AbortError") setNearbyError(reason.message); }).finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [propertyLocation, placeRegion, placePropertyDong]);
  const latestQuarterTrades = scopedTrades.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7)));
  const nearbyCategories = ["전체", ...NEARBY_CATEGORIES.map((category) => category.label)]; const activeFacilityCategory = NEARBY_CATEGORIES.find((category) => category.label === nearbyCategory); const nearbySubtypeOptions = activeFacilityCategory ? ["전체", ...activeFacilityCategory.subtypes] : [];
  const visibleNearbyPlaces = nearbyPlaces.filter((place) => (nearbyCategory === "전체" || place.category === nearbyCategory) && (nearbySubtype === "전체" || place.subCategory === nearbySubtype));
  const nearbyWithin500 = nearbyPlaces.filter((place) => place.distance <= 500).length;
  const risingCount = propertyRows.filter((property) => property.change !== null && property.change > 0).length; const fallingCount = propertyRows.filter((property) => property.change !== null && property.change < 0).length;
  const visibleProperties = useMemo(() => propertyRows.filter((property) => property.quarterCount >= minVolume).sort((a, b) => buildingSort === "price" ? b.current - a.current : buildingSort === "rise" ? (b.change ?? -Infinity) - (a.change ?? -Infinity) : buildingSort === "fall" ? (a.change ?? Infinity) - (b.change ?? Infinity) : b.quarterCount - a.quarterCount), [propertyRows, buildingSort, minVolume]);
  const renderedProperties = visibleProperties.slice(0, propertyLimit);
  const sortedMarkets = useMemo(() => [...markets].sort((a, b) => marketSort === "price" ? b.median - a.median : marketSort === "rise" ? b.change - a.change : marketSort === "fall" ? a.change - b.change : b.count - a.count), [markets, marketSort]);
  const nationalDeals = markets.reduce((sum, market) => sum + market.count, 0); const activeMarkets = markets.filter((market) => market.median > 0); const nationalMedian = activeMarkets.length ? median(activeMarkets.map((market) => market.median)) : 0; const nationalChange = nationalDeals ? markets.reduce((sum, market) => sum + market.change * market.count, 0) / nationalDeals : 0;
  const sidoOptions = useMemo(() => SIDO_ORDER.filter((sido) => REGIONS.some((region) => region.sido === sido)), []);
  const sigunguOptions = useMemo(() => REGIONS.filter((region) => region.sido === activeRegion.sido).sort(sortRegions), [activeRegion.sido]);
  const mapDistricts = useMemo(() => REGIONS.filter((region) => region.sido === selectedMapSido).sort(sortRegions), [selectedMapSido]);
  const dongOptions = useMemo(() => [...new Set(trades.map((trade) => trade.dong).filter(Boolean))].sort(), [trades]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/data/boundaries/emd/${activeRegion.code}.json`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("동 경계를 불러오지 못했습니다."))).then((data: GeoJsonFeatureCollection) => setBoundaryDongOptions(data.features.map((feature) => String(feature.properties.name || "")).filter(Boolean))).catch((error) => { if (error instanceof Error && error.name !== "AbortError") setBoundaryDongOptions([]); });
    return () => controller.abort();
  }, [activeRegion.code]);
  useEffect(() => {
    if (selectedDong === "all") return;
    const controller = new AbortController();
    fetch(`/data/boundaries/emd/${activeRegion.code}.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("주변 동 경계를 불러오지 못했습니다.")))
      .then((data: GeoJsonFeatureCollection) => {
        const context = nearbyDongContext(data, selectedBoundaryDong, selectedDong);
        setNearbyBoundaryDongs(context.boundaryDongs);
        setNearbyLegalDongs(context.legalDongs);
      })
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") { setNearbyBoundaryDongs([]); setNearbyLegalDongs([]); } });
    return () => controller.abort();
  }, [activeRegion.code, selectedBoundaryDong, selectedDong]);
  const mapDongChoices = boundaryDongOptions.length ? boundaryDongOptions : dongOptions;
  const mapDongStats = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    trades.forEach((trade) => { if (trade.dong && latestQuarterMonths.includes(trade.date.slice(0, 7))) groups.set(trade.dong, [...(groups.get(trade.dong) || []), trade]); });
    const stats: Record<string, DongMarketStat> = {};
    groups.forEach((rows, dong) => {
      const perPyValues = rows.filter((trade) => trade.area > 0).map((trade) => trade.amount / (trade.area / 3.3058));
      stats[dong] = { count: rows.length, median: median(rows.map((trade) => trade.amount)), perPy: perPyValues.length ? median(perPyValues) : 0 };
    });
    return stats;
  }, [trades, latestQuarterMonths]);
  const buildingCandidates = useMemo(() => {
    const selected = properties.filter((property) => property.dong === selectedDong).sort((a, b) => b.count - a.count || b.lastAmount - a.lastAmount);
    const nearby = properties.filter((property) => property.dong !== selectedDong && nearbyLegalDongs.includes(property.dong)).sort((a, b) => b.count - a.count || b.lastAmount - a.lastAmount);
    return [...selected.slice(0, 18), ...nearby.slice(0, 12)].slice(0, 30);
  }, [nearbyLegalDongs, properties, selectedDong]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (mapFocus !== "buildings" || selectedDong === "all" || !buildingCandidates.length) {
        setBuildingLocations([]); setBuildingsError(""); setBuildingsLoading(false); return;
      }
      setBuildingsLoading(true); setBuildingsError("");
      fetch("/api/property-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sido: activeRegion.sido,
          sigungu: activeRegion.sigungu,
          dong: selectedDong,
          properties: buildingCandidates.map((property) => ({ key: property.key, name: property.name, dong: property.dong, jibun: property.jibun, count: property.count, lastAmount: property.lastAmount, propertyType: type })),
        }),
        signal: controller.signal,
      }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "건물 위치를 불러오지 못했습니다."); return data; })
        .then((data) => {
          const locations = (data.locations || []).map((location: Omit<PropertyMapLocation, "scope">) => ({ ...location, scope: location.dong === selectedDong ? "selected" as const : "nearby" as const }));
          setBuildingLocations(locations);
          if (!locations.length) setBuildingsError("선택한 동과 주변 동의 거래 건물 주소를 지도 좌표와 연결하지 못했습니다.");
        })
        .catch((reason) => { if (reason.name !== "AbortError") { setBuildingLocations([]); setBuildingsError(reason.message); } })
        .finally(() => { if (!controller.signal.aborted) setBuildingsLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeRegion.sigungu, activeRegion.sido, buildingCandidates, mapFocus, selectedDong, type]);
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
  const activeTimeSlot = TIME_SLOTS[timeSlotIndex];
  const fieldMapQuery = `${activeRegion.sido} ${activeRegion.sigungu} ${selectedDong !== "all" ? selectedDong : ""} ${selectedProperty?.name || ""}`.replace(/\s+/g, " ").trim();
  const fieldMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(fieldMapQuery)}`;
  const commuteUrl = commuteDestination.trim() ? `https://map.kakao.com/link/search/${encodeURIComponent(`${fieldMapQuery} ${commuteDestination.trim()} 길찾기`)}` : "";
  const resetPropertySelection = useCallback(() => { setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); setPropertyLocation(null); setPropertyLimit(30); }, []);
  const chooseRegion = useCallback((region: Region, scrollToTop = true) => { setRegionCode(region.code); setRegionInput(`${region.sido} ${region.sigungu}`); setSelectedMapSido(region.sido); setMapFocus("district"); setSelectedBoundaryDong(""); setMapPickerDong(""); setSelectedDong("all"); resetPropertySelection(); setSubmittedQuery(""); setQuery(""); if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" }); }, [resetPropertySelection]);
  const chooseMapSido = useCallback((sido: string) => {
    const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0];
    setSelectedMapSido(sido); setMapFocus("sido"); setSelectedBoundaryDong(""); setMapPickerDong(""); setSelectedDong("all"); resetPropertySelection(); setSubmittedQuery(""); setQuery("");
    if (next) { setRegionCode(next.code); setRegionInput(`${next.sido} ${next.sigungu}`); }
  }, [resetPropertySelection]);
  const chooseMapRegion = useCallback((region: Region) => chooseRegion(region, false), [chooseRegion]);
  const chooseMapDong = useCallback((dong: string) => { const legalDong = legalDongName(dong); setSelectedBoundaryDong(dong); setMapPickerDong(dong); setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); resetPropertySelection(); setSelectedDong(legalDong || dong); }, [resetPropertySelection]);
  const openMapBuildings = useCallback(() => { if (ROAD_MAP_AVAILABLE && selectedDong !== "all") setMapFocus("buildings"); }, [selectedDong]);
  const chooseMapProperty = useCallback((key: string) => { setSelectedKey(key); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); setMapFocus("detail"); }, []);
  const openGangnamMap = useCallback(() => { const gangnam = REGIONS.find((region) => region.code === "11680"); if (gangnam) chooseRegion(gangnam, false); }, [chooseRegion]);
  const openHaengdangMap = useCallback(() => { const seongdong = REGIONS.find((region) => region.code === "11200"); if (seongdong) { chooseRegion(seongdong, false); setSelectedBoundaryDong("행당1동"); setMapPickerDong("행당1동"); setSelectedDong("행당동"); setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); } }, [chooseRegion]);
  const selectSido = (sido: string) => { const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0]; if (next) chooseRegion(next); };
  const selectSigungu = (code: string) => { const next = REGIONS.find((region) => region.code === code); if (next) chooseRegion(next); };
  const chooseFieldFeature = (featureId: string) => { const feature = FIELD_FEATURES.find((item) => item.id === featureId); if (!feature) return; setFieldGroup(feature.group); setFieldFeatureId(feature.id); setActiveSection("field"); const url = new URL(window.location.href); url.searchParams.set("feature", feature.id); url.hash = "field"; window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); };
  const changeView = (view: string) => { setActiveSection(view); const url = new URL(window.location.href); url.hash = view; if (view === "field") url.searchParams.set("feature", fieldFeatureId); else url.searchParams.delete("feature"); window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const exactRegion = REGIONS.find((item) => `${item.sido} ${item.sigungu}` === regionInput); if (exactRegion) setRegionCode(exactRegion.code); const nextQuery = query.trim(); setSubmittedQuery(nextQuery); if (nextQuery) changeView("chart"); };
  const selectCandidate = (candidate: { propertyKey: string; buildingDong: string; areaBucket: number; key: string }) => { setSelectedKey(candidate.propertyKey); setSelectedBuildingDong(candidate.buildingDong); setSelectedAreaBucket(candidate.areaBucket); setSelectedVariantKey(candidate.key); setArea("all"); changeView("chart"); };
  const toggleSavedHome = () => { if (!selectedOpportunity) return; const id = `${regionCode}|${selectedOpportunity.key}`; const next = isSaved ? savedHomes.filter((home) => home.id !== id) : [...savedHomes, { id, name: selectedOpportunity.name, region: `${activeRegion.sido} ${activeRegion.sigungu}`, area: selectedOpportunity.areaBucket, price: selectedOpportunity.current, score: selectedOpportunity.score, savedAt: new Date().toISOString() }].slice(-6); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } };
  const researchMetric = (row: typeof researchRows[number]) => researchTool === "record-high" ? formatPrice(row.current) : researchTool === "price-compare" ? `${row.gap >= 0 ? "+" : ""}${row.gap.toFixed(1)}%` : researchTool === "multi-compare" ? `${row.score}점` : researchTool === "most-bought" || researchTool === "volume" ? `${row.quarterCount}건` : `${(row.change ?? 0) >= 0 ? "+" : ""}${(row.change ?? 0).toFixed(1)}%`;
  const saveStudyDraft = (event: React.FormEvent) => { event.preventDefault(); if (!studyTitle.trim() || !studyBody.trim()) return; try { window.localStorage.setItem("jipgaps:study-draft", JSON.stringify({ category: activeCommunityCategory.label, board: communityBoard === "전체" ? activeCommunityCategory.boards[1] : communityBoard, title: studyTitle.trim(), body: studyBody.trim(), savedAt: new Date().toISOString() })); setDraftSaved(true); } catch { setDraftSaved(false); } };
  const mapLocationTitle = mapFocus === "national" ? "대한민국 전체" : mapFocus === "sido" ? selectedMapSido : `${activeRegion.sido} › ${activeRegion.sigungu}${selectedDong !== "all" ? ` › ${selectedDong}` : ""}`;
  const mapLocationDescription = mapFocus === "national" ? "전국 16개 시·도의 최근 3개월 시장 흐름" : mapFocus === "sido" ? `${selectedMapSido} 시·군·구 선택 단계` : `${PROPERTY_TYPES.find((item) => item.key === type)?.label} · 최근 3개월 실거래 기준`;
  const selectedMapMarket = markets.find((market) => market.sido === selectedMapSido);
  const selectedMapDongStat = selectedDong !== "all" ? mapDongStats[legalDongName(selectedBoundaryDong || selectedDong)] : undefined;
  const mapBuildingRows = useMemo(() => [...buildingLocations].sort((a, b) => Number(b.scope === "selected") - Number(a.scope === "selected") || b.count - a.count || b.lastAmount - a.lastAmount), [buildingLocations]);
  const selectedMapBuildingCount = mapBuildingRows.filter((building) => building.scope === "selected").length;
  const nearbyMapBuildingCount = mapBuildingRows.length - selectedMapBuildingCount;
  const mapBuildingMedian = mapBuildingRows.length ? median(mapBuildingRows.map((building) => building.lastAmount).filter(Boolean)) : 0;

  return <main className="terminal-shell" data-view={activeSection}>
    <header className="topbar">
      <a href="#home" className="brand" onClick={(event) => { event.preventDefault(); changeView("home"); }}><span>집값</span>의 정석 <em>PRO</em></a>
      <nav ref={navRef}>{NAV_ITEMS.map((item) => <a key={item.id} data-view={item.id} aria-label={item.label} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>{item.label}</a>)}<i className="nav-indicator" style={{ left: navIndicator.left, width: navIndicator.width }} /></nav>
      <div className="theme-switcher" role="group" aria-label="화면 테마">
        {THEME_OPTIONS.map((option) => { const Icon = option.icon; return <button type="button" key={option.key} className={themePreference === option.key ? "active" : ""} aria-pressed={themePreference === option.key} title={`${option.label} 모드`} onClick={() => chooseThemePreference(option.key)}><Icon size={14} strokeWidth={1.9} aria-hidden="true" /><span>{option.label}</span></button>; })}
      </div>
      <button className="saved-badge" onClick={() => changeView("chart")}>관심 후보 <b>{savedHomes.length}</b></button><div className="live"><i /> 실거래 연동</div>
    </header>
    <nav className="mobile-primary-nav" aria-label="주요 화면">{NAV_ITEMS.map((item) => <a key={item.id} aria-label={item.label} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>{item.mobileLabel}</a>)}</nav>
    {activeSection !== "home" && <div className="screen-context"><div><span>{NAV_ITEMS.find((item) => item.id === activeSection)?.label}</span><b>{activeRegion.sido} · {activeRegion.sigungu}{selectedDong !== "all" ? ` · ${selectedDong}` : ""}</b></div><button onClick={() => changeView("home")}>지역·주택 다시 선택</button></div>}
    <section className="command app-view view-home" id="top">
      <div className="hero-copy"><div><p>KOREA REAL ESTATE INTELLIGENCE</p><h1>사는 집도, 투자하는 집도<br/><span>숫자로 먼저 고르세요.</span></h1><b>전국 실거래를 분기 단위로 비교하고, 평형별 가격 매력과 거래 흐름까지 한 번에 확인합니다.</b></div><div className="hero-proof"><span><i>01</i>실거래 원문 기반</span><span><i>02</i>동·평형 단위 비교</span><span><i>03</i>판단 근거 공개</span></div></div>
      <div className="finder-panel"><div className="finder-title"><div><span>어디를 보고 계세요?</span><b>지역과 주택 유형을 고르면 매수 후보를 바로 추립니다.</b></div><small>최근 3개월 기준</small></div><div className="type-tabs">{PROPERTY_TYPES.map((item) => <button key={item.key} className={type === item.key ? "active" : ""} onClick={() => { setType(item.key); setSelectedKey(""); setSelectedVariantKey(""); }}>{item.label}</button>)}</div>
      <form className="search-console" onSubmit={submitSearch}>
        <label><span>시·도</span><select value={activeRegion.sido} onChange={(event) => selectSido(event.target.value)} aria-label="시도 선택">{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={regionCode} onChange={(event) => selectSigungu(event.target.value)} aria-label="시군구 선택">{sigunguOptions.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={selectedDong} onChange={(event) => { const dong = event.target.value; setSelectedDong(dong); setSelectedBoundaryDong(""); resetPropertySelection(); if (dong !== "all") setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); }} aria-label="읍면동 선택"><option value="all">전체 읍·면·동</option>{dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}</select></label>
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
        <div className="watch-head"><div><p>AREA-SPECIFIC WATCHLIST</p><h2>{activeRegion.sigungu} 동·평형별 3개월 순위</h2></div><span>{Math.min(propertyLimit, visibleProperties.length)}/{visibleProperties.length}</span></div>
        <div className="watch-filters"><select value={buildingSort} onChange={(event) => { setBuildingSort(event.target.value as typeof buildingSort); setPropertyLimit(30); }} aria-label="건물 목록 정렬"><option value="volume">3개월 거래량순</option><option value="price">3개월 중위가순</option><option value="rise">직전 분기 대비 상승순</option><option value="fall">직전 분기 대비 하락순</option></select><select value={minVolume} onChange={(event) => { setMinVolume(Number(event.target.value)); setPropertyLimit(30); }} aria-label="최소 거래량"><option value="0">거래량 전체</option><option value="1">3개월 1건 이상</option><option value="3">3개월 3건 이상</option><option value="5">3개월 5건 이상</option></select></div>
        <div className="watch-columns"><span>건물 / 단지</span><span>최근가</span></div>
        {loading ? <div className="watch-state">전체 실거래 목록을 불러오는 중…</div> : error ? <div className="watch-state error"><b>실거래 목록을 불러오지 못했습니다.</b><span>{error}</span><button type="button" onClick={() => setDataRetry((value) => value + 1)}>다시 불러오기</button></div> : visibleProperties.length ? <div className="watch-scroll">{renderedProperties.map((property, index) => <button key={property.key} className={selectedVariantKey === property.key ? "selected" : ""} onClick={() => { setSelectedKey(property.propertyKey); setSelectedBuildingDong(property.buildingDong); setSelectedAreaBucket(property.areaBucket); setSelectedVariantKey(property.key); setArea("all"); }}>
          <i className={`building-icon tone-${index % 5}`}>{property.name.slice(0, 1)}</i><div><b>{property.name}</b><small>{property.dong} · {dongLabel(property.buildingDong) || "동 정보 없음"} · 전용 {property.areaBucket}평 ({property.areaMedian.toFixed(1)}㎡)</small></div><strong>{formatPrice(property.current)}{property.change === null ? <em className="sample-low">표본 부족 · 3개월 {property.quarterCount}건</em> : <em className={property.change >= 0 ? "up" : "down"}>{property.change >= 0 ? "+" : ""}{property.change.toFixed(1)}% · 3개월 {property.quarterCount}건</em>}</strong>
        </button>)}{renderedProperties.length < visibleProperties.length && <button type="button" className="watch-more" onClick={() => setPropertyLimit((value) => value + 30)}><b>30개 더 보기</b><span>{renderedProperties.length.toLocaleString()}개 표시 중 · 전체 {visibleProperties.length.toLocaleString()}개</span></button>}</div> : <div className="watch-state">이 조건의 신고 거래가 없습니다.<button onClick={() => { setQuery(""); setSubmittedQuery(""); setPropertyLimit(30); }}>전체 목록 보기</button></div>}
      </aside>

      <div className="detail-terminal">
        <div className="ticker-head"><div><p>{PROPERTY_TYPES.find((item) => item.key === type)?.label} / {activeRegion.sido} {activeRegion.sigungu}</p><h1>{displayName}</h1><span>{selectedProperty ? `${selectedProperty.dong} ${selectedProperty.jibun || "주소 일부 비공개"} · 같은 동·전용평형만 비교` : `목록에서 동·평형을 선택하거나 ${activeRegion.sigungu} 전체 흐름을 확인하세요`}</span></div><div className="ticker-price"><strong>{formatPrice(latest)}</strong>{chartChangeComparable ? <em className={change >= 0 ? "up" : "down"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</em> : <em className="sample-low">표본 부족</em>}<small>{unit === "py" ? "만원/평" : "월 중위가격"}</small>{selectedOpportunity && <button className={isSaved ? "saved" : ""} onClick={toggleSavedHome}>{isSaved ? "★ 관심 후보 저장됨" : "☆ 관심 후보에 담기"}</button>}</div></div>
        <div className="chart-toolbar"><div className="period-switch">{PERIODS.map((item) => <button key={item.value} className={period === item.value ? "active" : ""} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div><div className="view-switch"><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="전용면적 선택"><option value="all">전체 면적</option>{areas.map((value) => <option key={value} value={value}>전용 {value}㎡ ({(value / 3.3058).toFixed(1)}평)</option>)}</select><button className={unit === "price" ? "active" : ""} onClick={() => setUnit("price")}>실거래가</button><button className={unit === "py" ? "active" : ""} onClick={() => setUnit("py")}>평당가</button></div></div>
        <article className="chart-card">
          <div className="chart-legend"><span><i className="price-dot" />월 중위가격</span><span><i className="ma-dot" />3개월 이동평균</span><span><i className="volume-dot" />거래량</span><small>마우스를 움직여 월별 상세 확인</small></div>
          <div className="canvas-wrap">{loading ? <div className="state"><i /> 실거래 데이터를 불러오는 중입니다</div> : error ? <div className="state error"><b>실거래 데이터를 불러오지 못했습니다.</b><span>{error}</span><button type="button" onClick={() => setDataRetry((value) => value + 1)}>다시 불러오기</button></div> : chartPoints.length ? <PriceChart points={chartPoints} unit={unit} theme={resolvedTheme} /> : <div className="state"><b>선택 조건의 거래가 없습니다</b><span>왼쪽 목록에서 다른 건물을 선택하거나 전체 면적을 선택하세요.</span></div>}</div>
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
          <header><div><p>NEARBY LIFE MAP</p><h2>{selectedProperty ? `${selectedProperty.name}에서 어떤 생활을 누릴 수 있을까?` : "집 하나를 고르면 주변 생활권이 자동으로 열립니다"}</h2><span>{selectedProperty ? `${placeRegion} ${placePropertyDong} · 7개 생활 영역과 영화관·공연장·학교·병원 등 28개 세부 유형` : "왼쪽 목록에서 집을 선택하면 별도 검색 없이 주변 시설과 거리를 계산합니다."}</span></div>{selectedProperty && <div><b>{nearbyPlaces.length}<small>곳</small></b><span>1km 안 시설</span><em>세부 유형 분석</em></div>}</header>
          {selectedProperty ? <><div className="facility-radar-summary" aria-label="생활권 반경별 편의시설 집계"><div className="radar-totals"><span><b>{nearbyWithin500}</b><small>500m 안</small></span><span><b>{nearbyPlaces.length}</b><small>1km 안</small></span></div><div className="radar-category-counts">{NEARBY_CATEGORIES.map((category) => { const inside500 = nearbyPlaces.filter((place) => place.category === category.label && place.distance <= 500).length; const inside1000 = nearbyPlaces.filter((place) => place.category === category.label).length; const CategoryIcon = category.icon; return <button key={category.label} className={nearbyCategory === category.label ? "active" : ""} aria-pressed={nearbyCategory === category.label} style={{ "--facility-color": category.color } as React.CSSProperties} onClick={() => { setNearbyCategory(category.label); setNearbySubtype("전체"); }}><i><CategoryIcon size={16} strokeWidth={1.9} aria-hidden="true" /></i><span>{category.label}<small>{category.description}</small></span><b>{inside500}<small> / {inside1000}</small></b><em>500m / 1km</em></button>; })}</div></div><div className="facility-layout">
            <div className="facility-map">{locationLoading ? <div className="facility-state"><i />단지 좌표를 확인하고 있습니다.</div> : propertyLocation ? <><KakaoPlaceMap location={propertyLocation} title={selectedProperty.name} places={visibleNearbyPlaces} active={activeSection === "chart"} /><span className="facility-address">{propertyLocation.roadAddress || propertyLocation.jibunAddress || placeAddressQuery}</span><div className="radius-key"><span><i />500m 생활권</span><span><i />1km 생활권</span></div></> : <div className="facility-state error"><b>지도 위치를 표시하지 못했습니다.</b><span>{locationError || "선택 지역과 일치하는 주소 좌표가 없습니다."}</span></div>}</div>
            <div className="nearby-browser">
              <div className="nearby-tabs">{nearbyCategories.map((category) => { const meta = NEARBY_CATEGORIES.find((item) => item.label === category); return <button key={category} className={nearbyCategory === category ? "active" : ""} aria-pressed={nearbyCategory === category} onClick={() => { setNearbyCategory(category); setNearbySubtype("전체"); }}><FacilityIcon name={category} size={14} /><span>{category}</span><small>{category === "전체" ? nearbyPlaces.length : nearbyPlaces.filter((place) => place.category === category).length}</small>{meta && <em>{meta.description}</em>}</button>; })}</div>
              {activeFacilityCategory && <div className="nearby-subtype-tabs" aria-label={`${activeFacilityCategory.label} 세부 유형`}>{nearbySubtypeOptions.map((subtype) => <button key={subtype} className={nearbySubtype === subtype ? "active" : ""} aria-pressed={nearbySubtype === subtype} onClick={() => setNearbySubtype(subtype)}><FacilityIcon name={subtype === "전체" ? activeFacilityCategory.label : subtype} size={14} /><span>{subtype === "전체" ? `${activeFacilityCategory.label} 전체` : subtype}</span><small>{subtype === "전체" ? nearbyPlaces.filter((place) => place.category === nearbyCategory).length : nearbyPlaces.filter((place) => place.category === nearbyCategory && place.subCategory === subtype).length}</small></button>)}</div>}
              {nearbyLoading ? <div className="nearby-state"><i />1km 안 생활시설을 세부 유형별로 찾고 있습니다.</div> : nearbyError ? <div className="nearby-state error"><b>주변 시설을 불러오지 못했습니다.</b><span>{nearbyError}</span></div> : visibleNearbyPlaces.length ? <div className="nearby-list">{visibleNearbyPlaces.map((place) => { const meta = NEARBY_CATEGORIES.find((item) => item.label === place.category); return <article key={place.id} style={{ "--facility-color": meta?.color || "#526173" } as React.CSSProperties}><i className="nearby-place-icon"><FacilityIcon name={place.subCategory || place.category} size={17} /></i><div><em>{place.subCategory || place.category}</em><b>{place.name}</b><span>{place.category} · {place.distance <= 500 ? "500m 생활권" : "1km 생활권"}</span></div><strong>{place.distance.toLocaleString()}m<small>직선거리</small></strong><p>도보 약 {place.walkingMinutes}분<small>경로 보정 추정</small></p></article>; })}</div> : <div className="nearby-state"><b>{nearbySubtype === "전체" ? "이 범위에서 등록된 시설이 없습니다." : `1km 안에 확인된 ${nearbySubtype}이 없습니다.`}</b><span>0건도 생활권 판단에 필요한 결과입니다. 다른 세부 유형을 함께 비교해보세요.</span></div>}
            </div>
          </div></> : <div className="facility-empty"><span>01</span><b>단지 선택</b><i>→</i><span>02</span><b>정확한 주소 좌표 확인</b><i>→</i><span>03</span><b>주변 생활시설 비교</b></div>}
          <p className="facility-note">단지 좌표와 배경 지도, 주변 시설은 카카오맵·로컬 API를 사용합니다. 7개 생활 영역을 영화관·공연장·공원·학교·병원·마트 등 28개 유형으로 나눈 결과이며, 거리는 직선거리입니다. 도보 시간은 경로 굴곡을 20% 반영한 참고값으로 실제 길찾기와 다를 수 있습니다.</p>
        </section>
      </div>
    </section>

    <section className="field-intelligence" id="field">
      <header className="field-heading"><div><span>온라인 임장</span><h2>집을 보러 가기 전에,<br/>생활부터 시뮬레이션하세요.</h2><p>현재 선택한 지역과 단지를 기준으로 이동·환경·세대·비용을 한 흐름에서 점검합니다.</p></div><div className="field-status-summary"><b>{FIELD_FEATURES.filter((feature) => feature.status === "live").length}<small>바로 사용</small></b><b>{FIELD_FEATURES.filter((feature) => feature.status === "beta").length}<small>베타</small></b><b>{FIELD_FEATURES.filter((feature) => feature.status === "connect").length}<small>데이터 연결</small></b></div></header>
      <div className="field-quick-tools" aria-label="온라인 임장 바로가기"><span>바로가기</span><button type="button" className={fieldFeatureId === "time" ? "active" : ""} onClick={() => chooseFieldFeature("time")}><b>시간대 분석</b><small>06·09·12·18·22·01시</small></button><button type="button" className={fieldFeatureId === "noise" ? "active" : ""} onClick={() => chooseFieldFeature("noise")}><b>소음 지도</b><small>소음원·시간대별 확인</small></button></div>
      <nav className="field-level-path" aria-label="온라인 임장 4단계">{FIELD_LEVELS.map((level, index) => { const activeLevel = fieldFeatureId === level.featureId; const liveContext = level.id === "region" ? `${activeRegion.sigungu} 지역` : level.id === "complex" ? selectedProperty?.name || level.example : level.id === "unit" ? selectedVariant ? `${dongLabel(selectedVariant.buildingDong) || "동 정보 없음"} · 전용 ${selectedVariant.areaBucket}평` : level.example : level.example; return <button type="button" key={level.id} className={activeLevel ? "active" : ""} aria-pressed={activeLevel} onClick={() => chooseFieldFeature(level.featureId)}><em>LEVEL {index + 1}</em><b>{level.label}</b><span>{level.summary}</span><small>{liveContext}</small><i>{level.status}</i></button>; })}</nav>
      <div className="field-context"><span>분석 위치</span><b>{fieldMapQuery}</b><small>상단 지역·단지 선택과 자동 동기화됩니다.</small></div>
      <div className="field-shell">
        <nav className="field-groups" aria-label="온라인 임장 분류">{FIELD_GROUPS.map((group) => <button key={group} className={fieldGroup === group ? "active" : ""} onClick={() => chooseFieldFeature(FIELD_FEATURES.find((feature) => feature.group === group)?.id || "region")}><span>{group}</span><b>{FIELD_FEATURES.filter((feature) => feature.group === group).length}</b></button>)}</nav>
        <div className="field-feature-list">{fieldGroupFeatures.map((feature) => <button key={feature.id} className={fieldFeatureId === feature.id ? "active" : ""} onClick={() => chooseFieldFeature(feature.id)}><div><b>{feature.title}</b><span>{feature.information}</span></div><em className={feature.status}>{feature.status === "live" ? "사용 가능" : feature.status === "beta" ? "베타" : "연결 예정"}</em><i className="importance-meter" aria-label={`중요도 5점 중 ${feature.importance}점`}>{[1,2,3,4,5].map((point) => <span key={point} className={point <= feature.importance ? "on" : ""} />)}</i></button>)}</div>
        <article className="field-workspace">
          <header><span className={activeFieldFeature.status}>{activeFieldFeature.status === "live" ? "LIVE" : activeFieldFeature.status === "beta" ? "BETA" : "DATA CONNECT"}</span><small>{activeFieldFeature.source}</small><h3>{activeFieldFeature.title}</h3><p>{activeFieldFeature.value}</p></header>
          {activeFieldFeature.id === "region" && <div className="field-action-panel"><b>{fieldMapQuery}</b><p>단지를 선택하면 1km 안의 교통·교육·의료·장보기·여가 시설과 거리를 자동으로 계산합니다.</p><button onClick={() => changeView("chart")}>자동 생활권 지도 보기 →</button></div>}
          {activeFieldFeature.id === "walk" && <div className="field-action-panel"><b>{fieldMapQuery}</b><p>실제 보행 경로는 횡단보도와 출입구를 반영한 최신 길찾기 결과로 최종 확인합니다.</p><a href={fieldMapUrl} target="_blank" rel="noreferrer">실제 도보 경로 확인 ↗</a></div>}
          {activeFieldFeature.id === "time" && <div className={`field-time-panel tone-${activeTimeSlot.tone}`}>
            <header><div><span>선택 시간</span><b>{activeTimeSlot.label}</b></div><small>{fieldMapQuery}</small></header>
            <div className="field-time-slider"><input type="range" min="0" max={TIME_SLOTS.length - 1} step="1" value={timeSlotIndex} onChange={(event) => setTimeSlotIndex(Number(event.target.value))} aria-label={`동네 분위기 시간 선택, 현재 ${activeTimeSlot.label}`} /><div>{TIME_SLOTS.map((slot, index) => <button type="button" key={slot.hour} className={timeSlotIndex === index ? "active" : ""} aria-pressed={timeSlotIndex === index} onClick={() => setTimeSlotIndex(index)}>{slot.hour}시</button>)}</div></div>
            <div className="field-time-result" aria-live="polite"><div><span>{activeTimeSlot.phase}</span><h4>{activeTimeSlot.title}</h4><p>선택한 시간에 현장에서 우선 확인할 항목입니다.</p></div><ul>{activeTimeSlot.checks.map((check) => <li key={check.label}><b>{check.label}</b><span>{check.detail}</span></li>)}</ul></div>
            <footer><div><span>실측 데이터 연결 전</span><p>현재는 시간대별 현장 확인 기준을 제공합니다. 교통량·유동인구·소음 수치는 공식 원천이 연결된 뒤 표시합니다.</p></div><a href={fieldMapUrl} target="_blank" rel="noreferrer">현재 지도에서 현장 확인</a></footer>
          </div>}
          {activeFieldFeature.id === "noise" && <div className="field-noise-panel">
            <header><div><span>NOISE MAP</span><h4>소음원을 나눠 보고, 시간대별로 비교합니다.</h4><p>같은 단지도 도로·철도·상가·학교처럼 소음원이 다르면 체감이 달라집니다.</p></div><button type="button" onClick={() => setNoiseSources(NOISE_SOURCES.map((source) => source.id))}>전체 소음원 선택</button></header>
            <div className="noise-source-picker" aria-label="표시할 소음원">{NOISE_SOURCES.map((source) => { const active = noiseSources.includes(source.id); return <button type="button" key={source.id} className={active ? "active" : ""} aria-pressed={active} onClick={() => setNoiseSources((current) => active ? current.filter((id) => id !== source.id) : [...current, source.id])}><b>{source.label}</b><small>{source.detail}</small></button>; })}</div>
            <div className="noise-layer-status"><div><span>선택된 레이어</span><b>{noiseSources.length}개 소음원</b><p>{noiseSources.length ? "선택한 소음원을 기준으로 이 위치의 측정망·공간 데이터를 결합합니다." : "지도에 표시할 소음원을 하나 이상 선택하세요."}</p></div><a href={fieldMapUrl} target="_blank" rel="noreferrer">주변 위치 확인</a></div>
            <div className="noise-time-table"><div className="noise-time-head"><span>시간</span><span>예상 소음</span><span>표시 기준</span></div>{["07시", "12시", "18시", "23시"].map((hour) => <div key={hour}><b>{hour}</b><strong>연결 대기</strong><span>{noiseSources.length ? "측정망·도로·철도·시설 데이터 결합" : "소음원 선택 필요"}</span></div>)}</div>
            <footer><span>실제 dB는 아직 표시하지 않습니다.</span><p>환경소음 측정망, 도로·철도·항공 경로, 공사 정보가 연결되면 선택한 소음원과 시간대별 dB·주의 구간을 같은 표와 지도에 표시합니다.</p></footer>
          </div>}
          {activeFieldFeature.id === "commute" && <div className="field-action-panel"><label><span>회사·학교·자주 가는 곳</span><input value={commuteDestination} onChange={(event) => setCommuteDestination(event.target.value)} placeholder="예: 광화문역" /></label>{commuteUrl ? <a href={commuteUrl} target="_blank" rel="noreferrer">Door-to-Door 경로 확인 ↗</a> : <button disabled>목적지를 입력해주세요</button>}<small>출발지는 현재 선택한 단지 또는 지역입니다.</small></div>}
          {activeFieldFeature.id === "lifestyle" && <div className="field-action-panel"><div className="lifestyle-chips">{["마트","병원","학교","헬스장","카페","공원"].map((keyword) => <button key={keyword} className={lifestyleKeyword === keyword ? "active" : ""} onClick={() => setLifestyleKeyword(keyword)}>{keyword}</button>)}</div><b>{fieldMapQuery} 주변 {lifestyleKeyword}</b><button onClick={() => changeView("chart")}>자동 생활권 지도 보기 →</button></div>}
          {activeFieldFeature.id === "price" && <div className="field-facts"><div><span>최근 3개월 거래</span><strong>{latestQuarterTrades.length.toLocaleString()}건</strong></div><div><span>분기 중위가격</span><strong>{formatPrice(median(latestQuarterTrades.map((trade) => trade.amount)))}</strong></div><div><span>유사 면적 대비</span><strong>{selectedKey && peerPyeongPrice ? `${valuationGap >= 0 ? "+" : ""}${valuationGap.toFixed(1)}%` : "단지 선택 필요"}</strong></div><a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>상세 가격 차트 보기 →</a></div>}
          {activeFieldFeature.id === "report" && <div className="field-report"><h4>현재 실거래 자동 요약</h4><ul><li>{activeRegion.sigungu}에서 최근 3개월 신고 거래 {latestQuarterTrades.length.toLocaleString()}건을 확인했습니다.</li><li>{propertyRows.length ? `동·평형 조건 ${propertyRows.length.toLocaleString()}개를 같은 기준으로 비교할 수 있습니다.` : "현재 조건은 비교 가능한 동·평형 표본이 부족합니다."}</li><li>{selectedKey && peerPyeongPrice ? `선택 후보는 유사 면적 지역 중위보다 ${Math.abs(valuationGap).toFixed(1)}% ${valuationGap > 0 ? "높습니다." : "낮습니다."}` : "단지를 선택하면 유사 면적 실거래와 가격 차이를 계산합니다."}</li></ul><small>생성형 문장이 아니라 현재 화면의 실거래 계산값을 요약합니다.</small></div>}
          {activeFieldFeature.id === "compare" && <div className="field-compare">{savedHomes.length ? savedHomes.slice(0,3).map((home) => <div key={home.id}><b>{home.name}</b><span>{home.region} · {home.area}평</span><strong>{home.score}점</strong></div>) : <p>가격 차트에서 관심 후보를 담으면 최대 3개 단지를 한눈에 비교할 수 있습니다.</p>}<a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>비교 후보 고르기 →</a></div>}
          {!(["region","walk","time","noise","commute","lifestyle","price","report","compare"].includes(activeFieldFeature.id)) && <div className="field-connect"><span>{activeFieldFeature.information}</span><strong>{activeFieldFeature.source} 연결이 필요합니다.</strong><p>현장·센서·공식 원천이 확보되기 전에는 그럴듯한 추정 점수를 표시하지 않습니다. 데이터 출처와 갱신일을 확인한 뒤 같은 화면에 연결합니다.</p><div><i />원천 검증 <i />주소·동 매칭 <i />사용자 교차 확인</div></div>}
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
      <header className="map-section-title"><div><h2>전국 흐름에서 실제 생활권까지</h2><p>행정경계의 실거래 흐름을 비교하고, 동을 고른 뒤 실제 도로·건물 지도로 이어서 확인합니다.</p></div><span>{marketMonth ? `${marketMonth.slice(0, 4)}년 ${Number(marketMonth.slice(4))}월 기준 · 최근 3개월` : "전국 실거래 집계 중"}</span></header>
      <nav className="map-path" aria-label="현재 지도 탐색 경로">
        <button type="button" className={mapFocus === "national" ? "active" : ""} aria-current={mapFocus === "national" ? "step" : undefined} onClick={() => setMapFocus("national")}>전국</button>
        <button type="button" className={mapFocus === "sido" ? "active" : ""} aria-current={mapFocus === "sido" ? "step" : undefined} onClick={() => setMapFocus("sido")}>{selectedMapSido}</button>
        <button type="button" className={mapFocus === "district" ? "active" : ""} aria-current={mapFocus === "district" ? "step" : undefined} disabled={selectedMapSido !== activeRegion.sido} onClick={() => setMapFocus("district")}>{selectedMapSido === activeRegion.sido ? activeRegion.sigungu : "시·군·구 선택"}</button>
        <button type="button" className={mapFocus === "buildings" || mapFocus === "detail" ? "active" : ""} aria-current={mapFocus === "buildings" || mapFocus === "detail" ? "step" : undefined} disabled={!ROAD_MAP_AVAILABLE || selectedDong === "all" || selectedMapSido !== activeRegion.sido} onClick={openMapBuildings}>{selectedDong === "all" ? "동 선택" : ROAD_MAP_AVAILABLE ? selectedDong : `${selectedDong} · 지도 연결 전`}</button>
      </nav>
      <div className="map-direct-picker" aria-label="목록으로 지역 선택">
        <div aria-live="polite"><span>현재 범위</span><b>{mapLocationTitle}</b><small>{mapLocationDescription}</small></div>
        <label><span>시·도</span><select value={selectedMapSido} onChange={(event) => chooseMapSido(event.target.value)}>{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={selectedMapSido === activeRegion.sido ? regionCode : ""} onChange={(event) => { const next = REGIONS.find((region) => region.code === event.target.value); if (next) chooseMapRegion(next); }}><option value="" disabled>시·군·구 선택</option>{mapDistricts.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={mapDongChoices.includes(mapPickerDong) ? mapPickerDong : ""} disabled={!mapDongChoices.length} onChange={(event) => setMapPickerDong(event.target.value)}><option value="" disabled>{mapDongChoices.length ? "읍·면·동 선택" : "동 목록 불러오는 중"}</option>{mapDongChoices.map((dong) => <option key={dong} value={dong}>{dong} · {formatDongMetric(mapDongStats[legalDongName(dong)], dongMetric)}</option>)}</select></label>
        <button type="button" disabled={!mapPickerDong || !mapDongChoices.includes(mapPickerDong)} onClick={() => chooseMapDong(mapPickerDong)}>{mapPickerDong ? `${mapPickerDong} 선택` : "동을 선택하세요"}</button>
      </div>
      <div className="map-layout"><KakaoMarketMap markets={markets} focus={mapFocus} active={activeSection === "home" || activeSection === "map"} propertyType={type} selectedSido={selectedMapSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} nearbyBoundaryDongs={nearbyBoundaryDongs} nearbyLegalDongs={nearbyLegalDongs} dongStats={mapDongStats} dongMetric={dongMetric} onDongMetricChange={setDongMetric} buildingLocations={buildingLocations} buildingsLoading={buildingsLoading} buildingsError={buildingsError} propertyLocation={propertyLocation} propertyName={selectedProperty?.name || ""} onSelectSido={chooseMapSido} onSelectRegion={chooseMapRegion} onSelectDong={chooseMapDong} onOpenBuildings={openMapBuildings} onSelectProperty={chooseMapProperty} />
        <aside className="map-ranking" aria-label={mapFocus === "buildings" ? "선택 동과 주변 동의 최근 실거래 건물" : "선택 지역 요약과 전국 비교"}>
          {mapFocus === "buildings" ? <>
            <div className="map-inspector-scope"><span>선택 동과 주변 생활권</span><h3>{mapLocationTitle}</h3><p>{nearbyLegalDongs.length ? `${nearbyLegalDongs.slice(0, 4).join(" · ")}${nearbyLegalDongs.length > 4 ? ` 외 ${nearbyLegalDongs.length - 4}곳` : ""}의 거래 건물도 함께 봅니다.` : "선택 동의 최근 실거래 건물을 지도에 표시합니다."}</p></div>
            <div className="map-market-summary"><div><span>{selectedDong} 건물</span><strong>{selectedMapBuildingCount}곳</strong></div><div><span>주변 동 건물</span><strong>{nearbyMapBuildingCount}곳</strong></div><div><span>표시 건물 중위가</span><strong>{mapBuildingMedian ? formatPrice(mapBuildingMedian) : buildingsLoading ? "확인 중" : buildingsError ? "좌표 확인 불가" : "데이터 없음"}</strong></div></div>
            <div className="map-ranking-head"><div><b>지도에 표시된 거래 건물</b><span>선택 동을 먼저, 인접 동을 다음에 보여줍니다.</span></div></div>
            <div className="ranking-labels building-labels"><span>구분</span><span>건물</span><span>최근 거래가</span><span>거래</span></div>
            <div className="map-ranking-list building-list">{buildingsLoading ? <div className="ranking-loading">선택 동과 주변 동의 건물 좌표를 확인하고 있습니다.</div> : mapBuildingRows.length ? mapBuildingRows.map((building) => <button key={building.key} className={building.scope === "selected" ? "selected" : "nearby"} onClick={() => chooseMapProperty(building.key)}><em>{building.scope === "selected" ? "선택" : "주변"}</em><b>{building.name}<small>{building.dong} · {PROPERTY_MAP_META[building.propertyType].short}</small></b><span>{formatPrice(building.lastAmount)}</span><strong>{building.count}건</strong></button>) : <div className="ranking-loading">{buildingsError || "이 범위에서 지도 좌표가 확인된 거래 건물이 없습니다."}</div>}</div>
            <div className="map-example-links map-context-foot"><span>지도에서 주변 동 경계를 눌러 바로 이동할 수 있습니다.</span></div>
          </> : <>
            <div className="map-inspector-scope"><span>선택 지역</span><h3>{mapLocationTitle}</h3><p>{mapLocationDescription}</p></div>
            {selectedMapDongStat?.count ? <div className="map-market-summary"><div><span>동 중위가격</span><strong>{formatPrice(selectedMapDongStat.median)}</strong></div><div><span>동 평당가</span><strong>{compactPrice(selectedMapDongStat.perPy)}/평</strong></div><div><span>최근 거래</span><strong>{selectedMapDongStat.count.toLocaleString()}건</strong></div></div> : selectedMapMarket ? <div className="map-market-summary"><div><span>시·도 중위가격</span><strong>{formatPrice(selectedMapMarket.median)}</strong></div><div><span>직전 3개월 대비</span><strong className={selectedMapMarket.change >= 0 ? "up" : "down"}>{selectedMapMarket.change >= 0 ? "+" : ""}{selectedMapMarket.change.toFixed(2)}%</strong></div><div><span>최근 거래</span><strong>{selectedMapMarket.count.toLocaleString()}건</strong></div></div> : marketError ? <div className="map-summary-loading error"><b>전국 실거래를 불러오지 못했습니다.</b><span>{marketError}</span><button type="button" onClick={() => setMarketRetry((value) => value + 1)}>다시 불러오기</button></div> : <div className="map-summary-loading">선택 지역의 실거래를 집계하고 있습니다.</div>}
            <div className="map-ranking-head"><div><b>전국 3개월 흐름</b><span>시·도를 선택하면 지도가 함께 이동합니다.</span></div><select value={marketSort} onChange={(event) => setMarketSort(event.target.value as typeof marketSort)} aria-label="전국 시장 정렬"><option value="volume">거래량순</option><option value="price">중위가순</option><option value="rise">상승순</option><option value="fall">하락순</option></select></div>
            <div className="ranking-labels"><span>순위</span><span>지역</span><span>중위가격</span><span>3개월</span></div>
            <div className="map-ranking-list">{sortedMarkets.length ? sortedMarkets.map((market, index) => <button key={market.code} className={market.sido === selectedMapSido ? "selected" : ""} aria-pressed={market.sido === selectedMapSido} onClick={() => chooseMapSido(market.sido)}><em>{String(index + 1).padStart(2,"0")}</em><b>{market.sido}<small>{market.count}건</small></b><span>{formatPrice(market.median)}</span><strong className={market.change >= 0 ? "up" : "down"}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</strong></button>) : <div className="ranking-loading">{marketError ? "전국 실거래 연결을 다시 확인해주세요." : "16개 대표 권역의 공공데이터를 확인하고 있습니다."}</div>}</div>
            <div className="map-example-links"><span>빠른 예시</span><div><button type="button" onClick={openGangnamMap}>강남구</button><button type="button" onClick={openHaengdangMap}>행당동</button></div></div>
          </>}
        </aside>
      </div>
      <p className="map-note">전국·시도·구·동 탐색은 <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer">2026-07-01 SGIS 기반 행정구역 경계</a>(CC BY 4.0)를 사용합니다. 동을 선택한 뒤부터 카카오 실제 지도와 국토교통부 실거래 가격을 결합해 건물과 생활권을 평가합니다.</p>
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
