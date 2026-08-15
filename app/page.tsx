"use client";
/* eslint-disable @next/next/no-img-element -- local floor-plan previews use browser-only object URLs */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Baby, BedDouble, Building2, BusFront, CarFront, Drama, Dumbbell, Film, GraduationCap, HeartPulse, Hospital, ImagePlus, Landmark, Library, Mail, MapPin, Monitor, Moon, Move, Pill, Refrigerator, RotateCw, Ruler, School, Search, ShoppingBasket, ShoppingCart, Sofa, Stethoscope, Store, Sun, Table2, TrainFront, Trash2, Trees, Trophy, Upload, WashingMachine, Waves, type LucideIcon } from "lucide-react";
import regions from "./data/regions.json";
import { PropertyTypeIcon as AnalysisPropertyTypeIcon, ResearchAnalysisWorkspace, type PriceBucket, type ResearchCell, type ResearchPropertyRow, type ResearchView as AnalysisResearchView } from "./components/analysis";
import { geometryLabelPoint, type SupportedGeometry } from "./lib/map/geometry";
import { selectNearbyPropertyCandidates } from "./lib/map/nearby-properties";
import type { MapCamera, MapDataStatus } from "./lib/map/types";
import type { AreaPriceSummary, DataState, ResearchBundle, ResearchMetric, SampleStatus } from "./lib/market/types";
import { normalizeScreen, readViewState, writeViewState, type ScreenId } from "./lib/navigation/view-state";

type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";
type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
type Region = { code: string; sido: string; sigungu: string };
type Trade = { id: string; date: string; amount: number; area: number; floor: number | null; name: string; propertyKey: string; dong: string; buildingDong: string; jibun: string; buildYear: number | null; dealingType: string; cancelled: boolean };
type Property = { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; areas: number[] };
type ChartPoint = { month: string; price: number; average: number; volume: number };
type OverviewMarket = { short: string; sido: string; code: string; count: number; median: number; change: number; medianAmountManwon?: number | null; changePct?: number | null; sample?: SampleStatus; status?: DataState };
type DataFeedback = { status: DataState; warnings: string[] };
type OverviewFeedback = DataFeedback & { scopeLabel: string; nationwide: boolean };
type PolicyItem = { date: string; tone: string; label: string; scope: string; title: string; summary: string; url: string };
type SavedHome = { id: string; name: string; region: string; area: number; price: number; score: number; savedAt: string };
type ResearchMode = "live" | "connect";
type AnalysisMode = "price" | "field";
type MobileSheetState = "collapsed" | "peek" | "expanded";
type ResearchTool = { id: string; label: string; description: string; mode: ResearchMode; source: string };
type ResearchCategory = { id: string; number: string; label: string; short: string; description: string; tools: ResearchTool[] };
type CommunityCategory = { id: string; number: string; label: string; description: string; boards: string[] };
type CommunityGuide = { id: string; category: string; board: string; tag: string; title: string; summary: string; evidence: string };
type FieldFeature = { id: string; group: string; title: string; information: string; value: string; importance: 4 | 5; status: "live" | "beta" | "connect"; source: string };
type PropertyLocation = { lat: number; lng: number; roadAddress: string; jibunAddress: string; codes?: { adminDongCode?: string; adminDongName?: string; legalDongCode?: string; legalDongName?: string } };
type PropertyMapLocation = PropertyLocation & { key: string; name: string; dong: string; jibun: string; count: number; lastAmount: number; propertyType: PropertyType; scope: "selected" | "nearby"; validation?: "verified" };
type NearbyPlace = { id: string; name: string; category: string; subCategory: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };
type CommuteEstimate = { destination: string; address: string; distance: number; walkingMinutes: number; drivingMinutes: number; transitMinutes: number };
type FurnitureKind = "single-bed" | "queen-bed" | "sofa" | "dining" | "desk" | "wardrobe" | "fridge";
type FurnitureCatalogItem = { kind: FurnitureKind; label: string; width: number; depth: number; icon: LucideIcon; color: string };
type PlacedFurniture = { id: string; kind: FurnitureKind; x: number; y: number; rotated: boolean };
type BoundaryDong = { code: string; name: string };
type ReleaseInfo = { commit: string; shortCommit: string; source: string };
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
type MapFocus = "national" | "sido" | "district" | "buildings";
type DongMetric = "price" | "py" | "volume";
type DongMarketStat = { count: number; median: number; perPy: number };
type GeoJsonFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: Record<string, unknown> };
type GeoJsonFeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };
type KakaoLatLng = { getLat?: () => number; getLng?: () => number };
type KakaoBounds = { extend: (latLng: KakaoLatLng) => void; getSouthWest?: () => KakaoLatLng; getNorthEast?: () => KakaoLatLng };
type KakaoMapInstance = { setBounds: (bounds: KakaoBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void; getBounds?: () => KakaoBounds; setCenter?: (latLng: KakaoLatLng) => void; getCenter?: () => KakaoLatLng; getLevel: () => number; setLevel: (level: number) => void; addControl?: (control: unknown, position: unknown) => void; relayout?: () => void };
type KakaoOverlayInstance = { setMap: (map: KakaoMapInstance | null) => void; setZIndex?: (zIndex: number) => void };
type KakaoMarkerInstance = KakaoOverlayInstance;
type KakaoClustererInstance = { addMarkers: (markers: KakaoMarkerInstance[]) => void; clear: () => void };
type KakaoEventListener = { target: unknown; eventName: string; listener: (...args: unknown[]) => void };
type KakaoMapsApi = { maps: {
  load: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  CustomOverlay: new (options: Record<string, unknown>) => KakaoOverlayInstance;
  Marker: new (options: Record<string, unknown>) => KakaoMarkerInstance;
  MarkerImage: new (src: string, size: unknown, options?: Record<string, unknown>) => unknown;
  MarkerClusterer: new (options: Record<string, unknown>) => KakaoClustererInstance;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
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
const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  { kind: "single-bed", label: "싱글 침대", width: 110, depth: 200, icon: BedDouble, color: "#5178a8" },
  { kind: "queen-bed", label: "퀸 침대", width: 150, depth: 200, icon: BedDouble, color: "#345f91" },
  { kind: "sofa", label: "3인 소파", width: 210, depth: 90, icon: Sofa, color: "#8a634d" },
  { kind: "dining", label: "4인 식탁", width: 120, depth: 75, icon: Table2, color: "#a57432" },
  { kind: "desk", label: "책상", width: 120, depth: 60, icon: Monitor, color: "#4d6b78" },
  { kind: "wardrobe", label: "옷장", width: 120, depth: 60, icon: Archive, color: "#75634f" },
  { kind: "fridge", label: "냉장고", width: 91, depth: 75, icon: Refrigerator, color: "#5f7487" },
];
const PROPERTY_ICON_PATHS: Record<PropertyType, string> = {
  apt: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  rowhouse: '<path d="m3 11 5-4 4 3 4-3 5 4v10H3Z"/><path d="M7 21v-6h3v6M15 21v-6h3v6"/>',
  house: '<path d="m3 11 9-7 9 7v10H3Z"/><path d="M9 21v-7h6v7M7 12h2M15 12h2"/>',
  officetel: '<path d="M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/><path d="M3 21h18"/>',
  commercial: '<path d="M4 10v11h16V10M3 10l2-6h14l2 6"/><path d="M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0M8 21v-6h8v6"/>',
  factory: '<path d="M3 21V9l6 4V9l6 4V5h4v16Z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
};
function propertyMapIconMarkup(type: PropertyType) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PROPERTY_ICON_PATHS[type]}</svg>`;
}
function PropertyTypeIcon({ type }: { type: PropertyType }) {
  return <span className={`property-type-icon type-${type}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: propertyMapIconMarkup(type) }} />;
}
const PERIODS = [{ label: "3개월", value: 3 }, { label: "6개월", value: 6 }, { label: "1년", value: 12 }, { label: "3년", value: 36 }, { label: "5년", value: 60 }];
const NAV_ITEMS = [{ id: "home", label: "집값의 정석", mobileLabel: "홈" }, { id: "chart", label: "상세 분석", mobileLabel: "분석" }, { id: "research", label: "리서치·지도", mobileLabel: "리서치" }, { id: "community", label: "커뮤니티", mobileLabel: "커뮤니티" }, { id: "policy", label: "정책", mobileLabel: "정책" }];
const THEME_OPTIONS: { key: ThemePreference; label: string; icon: LucideIcon }[] = [
  { key: "light", label: "밝게", icon: Sun },
  { key: "dark", label: "어둡게", icon: Moon },
  { key: "system", label: "기기 설정", icon: Monitor },
];
const SIDO_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  서울특별시: { lat: 37.5665, lng: 126.978, zoom: 10 }, 부산광역시: { lat: 35.1796, lng: 129.0756, zoom: 10 }, 대구광역시: { lat: 35.8714, lng: 128.6014, zoom: 10 }, 인천광역시: { lat: 37.4563, lng: 126.7052, zoom: 9 },
  전남광주통합특별시: { lat: 35.15, lng: 126.95, zoom: 8 }, 대전광역시: { lat: 36.3504, lng: 127.3845, zoom: 10 }, 울산광역시: { lat: 35.5384, lng: 129.3114, zoom: 9 }, 세종특별자치시: { lat: 36.48, lng: 127.289, zoom: 10 },
  경기도: { lat: 37.4138, lng: 127.5183, zoom: 8 }, 강원특별자치도: { lat: 37.8228, lng: 128.1555, zoom: 8 }, 충청북도: { lat: 36.6357, lng: 127.4917, zoom: 9 }, 충청남도: { lat: 36.5184, lng: 126.8, zoom: 9 },
  전북특별자치도: { lat: 35.7175, lng: 127.153, zoom: 9 }, 경상북도: { lat: 36.4919, lng: 128.8889, zoom: 8 }, 경상남도: { lat: 35.4606, lng: 128.2132, zoom: 9 }, 제주특별자치도: { lat: 33.489, lng: 126.4983, zoom: 9 },
};
const FIELD_GROUPS = ["입지·동선", "주거환경", "동·세대", "비용·가격", "검증·비교"];
const FIELD_LEVELS = [
  { id: "region", step: "지역 단계", label: "지역 임장", summary: "지역의 생활권을 분석", example: "강남구·성동구·분당구·동탄", group: "입지·동선", featureId: "region", status: "사용 가능" },
  { id: "complex", step: "단지 단계", label: "단지 임장", summary: "개별 단지의 가격을 분석", example: "래미안·자이 등 개별 단지", group: "비용·가격", featureId: "price", status: "사용 가능" },
  { id: "unit", step: "세대 단계", label: "동·호수·공간 임장", summary: "동·층·방향과 내부 공간을 분석", example: "101동·15층·전용 84㎡", group: "동·세대", featureId: "space", status: "시험 기능" },
  { id: "life", step: "생활 단계", label: "생활 기준 설정", summary: "개인 생활 패턴을 지역 분석에 반영", example: "출근·귀가·장보기·산책·학교·병원", group: "입지·동선", featureId: "region", status: "지역 기능에 포함" },
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
const FIELD_SCORE_GROUPS = [
  { label: "이동과 생활", items: ["교통", "생활편의", "학군"] },
  { label: "주거환경", items: ["일조", "조망", "보행환경", "소음"] },
  { label: "비용과 관리", items: ["관리비", "주차"] },
];
function FieldScorePreview() {
  return <section className="field-score-radar" aria-labelledby="field-score-radar-title">
    <div className="field-score-radar-copy">
      <div><h3 id="field-score-radar-title">임장에서 확인할 9가지</h3><span>평가 기준 미리보기</span></div>
      <p>지역과 단지를 고른 뒤 가격뿐 아니라 이동, 주거환경, 관리 여건을 같은 기준으로 확인합니다.</p>
      <div className="field-score-radar-total"><strong>9</strong><span>확인 항목<small>점수는 데이터 연결 후 제공</small></span></div>
    </div>
    <div className="field-score-radar-criteria">{FIELD_SCORE_GROUPS.map((group) => <section key={group.label}><b>{group.label}</b><div>{group.items.map((item) => <span key={item}>{item}</span>)}</div></section>)}</div>
    <p className="field-score-radar-note"><b>현재는 평가 기준만 안내합니다.</b> 확인 가능한 공식·현장 데이터가 연결된 항목만 점수로 계산합니다.</p>
  </section>;
}
const FIELD_FEATURES: FieldFeature[] = [
  { id: "region", group: "입지·동선", title: "지역 생활권 살펴보기", information: "교통·학교·병원·장보기·여가 생활권", value: "주변 생활시설을 항목별로 먼저 확인", importance: 5, status: "live", source: "카카오 로컬 장소 검색" },
  { id: "walk", group: "입지·동선", title: "생활 동선 임장", information: "가까운 역·학교·병원까지 걷기·차량 예상시간", value: "매일 오가는 핵심 목적지의 체감 이동을 비교", importance: 5, status: "beta", source: "장소 직선거리 기반 예상" },
  { id: "time", group: "입지·동선", title: "시간대 분석", information: "출근·퇴근·야간 교통과 유동인구", value: "낮과 밤의 지역 분위기 차이를 확인", importance: 5, status: "connect", source: "시간대별 교통·유동인구 원천 필요" },
  { id: "night", group: "입지·동선", title: "야간 임장", information: "막차 확인 상태·편의점·응급의료·밤길 점검", value: "늦은 귀가에 필요한 교통과 생활환경을 함께 확인", importance: 4, status: "beta", source: "카카오 장소 검색 · 막차 원천 연결 필요" },
  { id: "commute", group: "입지·동선", title: "출퇴근 시간 비교", information: "목적지까지 도보·차량·대중교통 예상시간", value: "한 화면에서 세 이동수단을 비교합니다.", importance: 5, status: "beta", source: "주소 좌표·거리 기반 예상" },
  { id: "noise", group: "주거환경", title: "소음 지도", information: "도로·철도·상가·학교 소음", value: "조용한 지역과 동을 선택", importance: 5, status: "connect", source: "환경소음·현장 측정 데이터 필요" },
  { id: "parking", group: "주거환경", title: "시간대별 주차난", information: "혼잡·이중주차·동별 접근성", value: "실거주 주차 불편을 계약 전에 확인", importance: 5, status: "connect", source: "관리사무소·거주자 제보 필요" },
  { id: "environment", group: "주거환경", title: "냄새·환경 지도", information: "하수구·음식점·쓰레기·공장 악취", value: "온라인에서 놓치기 쉬운 환경을 확인", importance: 5, status: "connect", source: "환경 민원·인증 현장 제보 필요" },
  { id: "space", group: "동·세대", title: "공간·가구 임장", information: "평면도·전용면적·방 치수·가구 배치", value: "선택한 집의 구조와 가구 배치를 함께 확인합니다.", importance: 5, status: "beta", source: "사용자 평면도·직접 입력 치수" },
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
  { date: "2026.07.20", tone: "positive", label: "선택지 확대", scope: "비아파트·임대", title: "비아파트 공급 보완조치 전면 시행", summary: "토지 확보 지원금 상향과 PF 보증 강화로 오피스텔·도시형생활주택 공급 사업의 초기 자금 부담이 완화됩니다.", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148968416" },
  { date: "2026.07.15", tone: "negative", label: "부담 가능", scope: "분양·신축", title: "기본형건축비 0.77% 인상", summary: "공사비 상승분이 분양가에 반영될 가능성이 있어 신규 주택 구매자의 가격 부담이 커질 수 있습니다.", url: "https://www.molit.go.kr/portal.do" },
  { date: "2026.05.12", tone: "neutral", label: "영향 혼재", scope: "토지거래허가", title: "세입자 있는 주택 실거주 유예 확대", summary: "임대 중 주택의 매도 편의는 개선되지만 갭투자 제한 원칙은 유지돼 수요와 공급에 미치는 영향이 엇갈릴 수 있습니다.", url: "https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95091995" },
  { date: "2026 업무계획", tone: "positive", label: "선택지 확대", scope: "주거복지·공급", title: "공적 임대주택 최소 15.2만호 공급", summary: "공공임대 14만호와 공공지원 민간임대 1.2만호 공급 계획으로 무주택 실수요자의 선택지가 확대됩니다.", url: "https://www.molit.go.kr/2026plan/251212%28%EC%9E%90%EB%A3%8C%29_%EA%B5%AD%ED%86%A0%EA%B5%90%ED%86%B5%EB%B6%80_%EC%97%85%EB%AC%B4%EB%B3%B4%EA%B3%A0_%EC%84%9C%EB%A9%B4%EC%9E%90%EB%A3%8C.pdf" },
];

const RESEARCH_CATEGORIES: ResearchCategory[] = [
  {
    id: "price", number: "01", label: "가격·실거래", short: "가격 분석", description: "실제 체결가를 같은 동·평형끼리 비교해 가격의 방향과 상대 가치를 봅니다.",
    tools: [
      { id: "recent-fall", label: "최근 하락", description: "직전 분기와 비교 가능한 동·평형 중 하락폭이 큰 순서로 봅니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "record-high", label: "최고가", description: "선택 지역의 최근 3개월 중위가격이 높은 동·평형을 찾습니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "top-rise", label: "상승률 상위", description: "직전 분기 대비 중위가격 상승률이 높은 순서로 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "price-change", label: "가격 변동", description: "상승·하락 방향과 무관하게 변동폭이 큰 동·평형을 먼저 보여줍니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "price-compare", label: "가격 비교", description: "같은 지역의 유사 평형 평당가와 비교해 상대 가격 차이를 계산합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "multi-compare", label: "여러 단지 비교", description: "가격 매력·거래량·가격 흐름을 합산해 여러 후보를 한 번에 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
    ],
  },
  {
    id: "demand", number: "02", label: "수급·시장심리", short: "수급 분석", description: "거래 가격과 함께 시장 참여자가 실제로 움직이는지 확인합니다.",
    tools: [
      { id: "listing-change", label: "매물 증감", description: "지역·단지별 매물 재고가 늘거나 줄어드는 속도를 추적합니다.", mode: "connect", source: "일별 매물 스냅샷 데이터" },
      { id: "most-bought", label: "거래 많은 단지", description: "최근 3개월 실제 계약이 많이 체결된 동·평형을 보여줍니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "volume", label: "거래량", description: "선택 지역 안에서 분기 거래가 집중된 단지를 비교합니다.", mode: "live", source: "국토교통부 실거래가" },
      { id: "gap", label: "갭투자", description: "매매가와 동일 평형 전세가의 차이와 갭 비율을 계산합니다.", mode: "connect", source: "매매·전월세 실거래 결합" },
      { id: "sentiment", label: "매수 심리", description: "상승·하락 동·평형 비중과 거래 회복 정도로 체결 심리를 읽습니다.", mode: "live", source: "실거래 기반 자체 체결심리" },
    ],
  },
  {
    id: "supply", number: "03", label: "공급·분양", short: "공급 분석", description: "앞으로 들어올 주택과 분양 가격을 함께 보며 지역의 공급 부담을 판단합니다.",
    tools: [
      { id: "supply-volume", label: "공급 물량", description: "인허가·착공·준공·입주 예정 물량을 시계열로 비교합니다.", mode: "connect", source: "국토교통부 주택건설실적·입주예정" },
      { id: "unsold", label: "미분양", description: "시·군·구별 미분양과 준공 후 미분양의 변화 속도를 봅니다.", mode: "connect", source: "국토교통부 미분양주택현황" },
      { id: "presale-price", label: "분양가 비교", description: "신규 분양가를 인근 구축·신축 실거래 평당가와 비교합니다.", mode: "connect", source: "청약홈 분양정보·실거래가" },
    ],
  },
  {
    id: "location", number: "04", label: "입지·생활가치", short: "입지 분석", description: "인구·학교·단지 규모·관심도를 가격과 함께 보며 오래 살기 좋은지 확인합니다.",
    tools: [
      { id: "population", label: "인구 변화", description: "전입·전출과 연령별 인구 변화로 실수요 기반을 확인합니다.", mode: "connect", source: "행정안전부 주민등록 인구통계" },
      { id: "school", label: "학군 비교", description: "학교 접근성·학업 지표와 같은 평형 가격 프리미엄을 함께 비교합니다.", mode: "connect", source: "학교알리미·교육통계" },
      { id: "mega-complex", label: "대단지", description: "세대수 기준으로 대단지를 찾고 거래 유동성과 관리비를 비교합니다.", mode: "connect", source: "K-apt 공동주택 기본정보" },
      { id: "views", label: "조회수", description: "집값의 정석 안에서 관심이 빠르게 늘어난 지역과 단지를 추적합니다.", mode: "connect", source: "서비스 익명 관심도 집계" },
    ],
  },
  {
    id: "income", number: "05", label: "수익·비주거", short: "수익 분석", description: "보유 비용과 임대 현금흐름, 상가·토지 시장을 투자 관점에서 나눠 봅니다.",
    tools: [
      { id: "rent-yield", label: "월세 수익", description: "보증금을 환산한 월세 수익률과 매매가 대비 현금흐름을 계산합니다.", mode: "connect", source: "전월세·매매 실거래 결합" },
      { id: "retail", label: "상가 통계", description: "상권 매출·공실·상가 실거래를 지역별로 비교합니다.", mode: "connect", source: "소상공인 상권정보·상업업무용 실거래" },
      { id: "land", label: "토지 통계", description: "지목·용도지역별 토지 거래량과 면적당 가격 흐름을 봅니다.", mode: "connect", source: "국토교통부 토지 실거래" },
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=clusterer`;
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

function publicDataErrorMessage(message: string) {
  if (/API|KEY|키가 설정|환경 ?변수/i.test(message)) return "실거래 데이터 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
  return message || "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function policyImpactLabel(tone: string) {
  if (tone === "positive") return "선택지 확대";
  if (tone === "negative") return "부담 가능";
  return "영향 혼재";
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

function KakaoPlaceMap({ location, title, places, active, radius = 1000 }: { location: PropertyLocation; title: string; places: NearbyPlace[]; active: boolean; radius?: number }) {
  const hostRef = useRef<HTMLDivElement>(null); const [mapError, setMapError] = useState("");
  useEffect(() => {
    const host = hostRef.current; const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY; let disposed = false; const overlays: KakaoOverlayInstance[] = [];
    if (!host || !active) return;
    if (!appKey) { const timer = window.setTimeout(() => setMapError("카카오 지도 JavaScript 키가 연결되지 않았습니다."), 0); return () => window.clearTimeout(timer); }
    loadKakaoMap(appKey).then(() => {
      if (disposed || !window.kakao?.maps) return;
      const maps = window.kakao.maps; const center = new maps.LatLng(location.lat, location.lng);
      const map = new maps.Map(host, { center, level: radius <= 200 ? 3 : radius <= 500 ? 4 : 5 });
      map.addControl?.(new maps.ZoomControl(), maps.ControlPosition.TOPRIGHT);
      overlays.push(new maps.Circle({ map, center, radius, strokeColor: "#0071e3", strokeOpacity: .78, strokeWeight: 2, fillColor: "#0071e3", fillOpacity: .075 }));
      overlays.push(new maps.CustomOverlay({ position: center, map, content: `<div class="nearby-home-pin"><b>${escapeMapHtml(title)}</b><span>선택 단지</span></div>`, xAnchor: .5, yAnchor: 1, zIndex: 100 }));
      const colors = Object.fromEntries(NEARBY_CATEGORIES.map((category) => [category.label, category.color]));
      places.slice(0, 28).forEach((place) => { const position = new maps.LatLng(place.lat, place.lng); overlays.push(new maps.CustomOverlay({ position, map, content: `<div class="nearby-place-pin" title="${escapeMapHtml(`${place.subCategory} · ${place.name} · ${place.distance}m`)}" style="--pin:${colors[place.category] || "#526173"}"><i></i><b>${escapeMapHtml(place.subCategory || place.category)} · ${escapeMapHtml(place.name)}</b><span>${place.distance}m</span></div>`, xAnchor: .16, yAnchor: .5, zIndex: Math.max(10, 70 - Math.round(place.distance / 30)) })); });
      setMapError("");
    }).catch((error) => { if (!disposed) setMapError(safeMapMessage(error)); });
    return () => { disposed = true; overlays.forEach(safelyRemoveKakaoOverlay); host.replaceChildren(); };
  }, [active, location.lat, location.lng, places, radius, title]);
  return <div className="naver-map-frame">{mapError ? <MapFallback lat={location.lat} lng={location.lng} title={title} message={mapError} /> : <div ref={hostRef} className="naver-map-canvas" role="img" aria-label={`${title}와 주변 생활시설 카카오 지도`} />}</div>;
}

function escapeMapHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

type MapPriceBand = { id: string; className: string; label: string; min: number | null; max: number | null };

function buildMapPriceBands(prices: number[]): MapPriceBand[] {
  const sorted = prices.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const percentileEdges = [.2, .4, .6, .8].map((percentile) => sorted[Math.floor((sorted.length - 1) * percentile)]);
  const edges = new Set(percentileEdges).size === percentileEdges.length || max <= min
    ? percentileEdges
    : [1, 2, 3, 4].map((step) => Math.round(min + ((max - min) * step) / 5));
  return [
    { id: "level-1", className: "price-level-1", label: "1단계", min: null, max: edges[0] },
    { id: "level-2", className: "price-level-2", label: "2단계", min: edges[0], max: edges[1] },
    { id: "level-3", className: "price-level-3", label: "3단계", min: edges[1], max: edges[2] },
    { id: "level-4", className: "price-level-4", label: "4단계", min: edges[2], max: edges[3] },
    { id: "level-5", className: "price-level-5", label: "5단계", min: edges[3], max: null },
  ];
}

function classifyMapPrice(price: number, bands: MapPriceBand[]) {
  return bands.find((band) => (band.min === null || price > band.min) && (band.max === null || price <= band.max))?.className || "price-level-3";
}

function formatMapPriceBand(band: MapPriceBand) {
  if (band.min === null && band.max !== null) return `≤ ${formatPrice(band.max)}`;
  if (band.min !== null && band.max === null) return `> ${formatPrice(band.min)}`;
  if (band.min !== null && band.max !== null) return `${formatPrice(band.min)}–${formatPrice(band.max)}`;
  return "범위 확인 중";
}

function straightLineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const radians = Math.PI / 180;
  const dLat = (lat2 - lat1) * radians;
  const dLng = (lng2 - lng1) * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function estimatedTravelMinutes(distance: number) {
  const routeDistance = distance * 1.25;
  return {
    walkingMinutes: Math.max(1, Math.round(routeDistance / 75)),
    drivingMinutes: Math.max(4, Math.round(routeDistance / 300) + 3),
    transitMinutes: Math.max(8, Math.round(routeDistance / 230) + 8),
  };
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
const ROAD_MAP_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY);
// Keep the shortlist logic ready while its home-page surface is temporarily paused.
const SHOW_OPPORTUNITY_SECTION = false;

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

function visibleAdministrativeLabels(boundaries: ProjectedBoundary[]) {
  // Every rendered official boundary remains named. The SVG title and keyboard
  // target preserve the full name even when a compact visual label is used.
  return new Set(boundaries.map((boundary) => boundary.code));
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

function geoExtentsIntersect(first: NonNullable<ReturnType<typeof geoJsonExtent>>, second: NonNullable<ReturnType<typeof geoJsonExtent>>) {
  return first.maxLng >= second.minLng && first.minLng <= second.maxLng && first.maxLat >= second.minLat && first.minLat <= second.maxLat;
}

function geoFeatureBoundaryDistance(first: GeoJsonFeature, second: GeoJsonFeature) {
  const sample = (feature: GeoJsonFeature) => {
    const points = coordinateRings(feature.geometry.coordinates).flat();
    const step = Math.max(1, Math.floor(points.length / 240));
    return points.filter((_, index) => index % step === 0);
  };
  const firstPoints = sample(first); const secondPoints = sample(second); let minimum = Infinity;
  firstPoints.forEach(([firstLng, firstLat]) => secondPoints.forEach(([secondLng, secondLat]) => { const lng = firstLng - secondLng; const lat = firstLat - secondLat; minimum = Math.min(minimum, lng * lng + lat * lat); }));
  return Math.sqrt(minimum);
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
    const labelPoint = geometryLabelPoint(feature.geometry as SupportedGeometry);
    const centerX = labelPoint ? offsetX + (labelPoint[0] - extent.minLng) * scale : (minX + maxX) / 2;
    const centerY = labelPoint ? offsetY + (extent.maxLat - labelPoint[1]) * scale : (minY + maxY) / 2;
    return { code: String(feature.properties.code || ""), name: String(feature.properties.name || ""), path, centerX, centerY, width: maxX - minX, height: maxY - minY };
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
  const [capitalDistrictContext, setCapitalDistrictContext] = useState<GeoJsonFeatureCollection | null>(null);
  const [districtContext, setDistrictContext] = useState<GeoJsonFeatureCollection | null>(null);
  const [neighborDongContext, setNeighborDongContext] = useState<GeoJsonFeatureCollection | null>(null);
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
    if (!active || focus !== "sido" || selectedSido !== "서울특별시") {
      Promise.resolve().then(() => { setCapitalContext(null); setCapitalDistrictContext(null); });
      return;
    }
    const controller = new AbortController();
    Promise.all([
      fetch("/data/boundaries/sido.json", { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<GeoJsonFeatureCollection> : Promise.reject(new Error("수도권 경계를 불러오지 못했습니다."))),
      Promise.all(["41", "28"].map((code) => fetch(`/data/boundaries/sgg/${code}.json`, { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<GeoJsonFeatureCollection> : Promise.reject(new Error("수도권 시·군·구 경계를 불러오지 못했습니다."))))),
    ])
      .then(([sido, collections]) => {
        setCapitalContext(sido);
        setCapitalDistrictContext({ type: "FeatureCollection", features: collections.flatMap((collection) => collection.features) });
      })
      .catch(() => { setCapitalContext(null); setCapitalDistrictContext(null); });
    return () => controller.abort();
  }, [active, focus, selectedSido]);
  useEffect(() => {
    if (!active || focus !== "district") { Promise.resolve().then(() => setDistrictContext(null)); return; }
    const controller = new AbortController();
    fetch(`/data/boundaries/sgg/${SIDO_CODES[activeRegion.sido]}.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("상위 지역 경계를 불러오지 못했습니다.")))
      .then(setDistrictContext)
      .catch(() => setDistrictContext(null));
    return () => controller.abort();
  }, [active, activeRegion.sido, focus]);
  const neighboringRegions = useMemo(() => {
    if (!districtContext || focus !== "district") return [] as Region[];
    const activeFeature = districtContext.features.find((feature) => String(feature.properties.code || "") === activeRegion.code);
    if (!activeFeature) return [] as Region[];
    return districtContext.features.flatMap((feature) => {
      const code = String(feature.properties.code || "");
      if (!code || code === activeRegion.code) return [];
      const region = REGIONS.find((item) => item.code === code);
      return region && geoFeatureBoundaryDistance(activeFeature, feature) <= .0005 ? [region] : [];
    });
  }, [activeRegion.code, districtContext, focus]);
  useEffect(() => {
    if (!active || focus !== "district" || !neighboringRegions.length) { Promise.resolve().then(() => setNeighborDongContext(null)); return; }
    const controller = new AbortController();
    Promise.all(neighboringRegions.map((region) => fetch(`/data/boundaries/emd/${region.code}.json`, { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<GeoJsonFeatureCollection> : Promise.reject(new Error("인접 동 경계를 불러오지 못했습니다.")))))
      .then((collections) => setNeighborDongContext({ type: "FeatureCollection", features: collections.flatMap((collection) => collection.features) }))
      .catch(() => setNeighborDongContext(null));
    return () => controller.abort();
  }, [active, focus, neighboringRegions]);
  const mapExtent = useMemo(() => {
    if (!data) return undefined;
    const extent = geoJsonExtent(data);
    if (!extent) return undefined;
    if (focus === "sido" && selectedSido === "서울특별시") return expandGeoExtent(extent, .3, .24);
    if (focus === "district") return expandGeoExtent(extent, .08, .08);
    return undefined;
  }, [data, focus, selectedSido]);
  const boundaries = useMemo(() => data ? projectAdministrativeBoundaries(data, 760, 560, mapExtent) : [], [data, mapExtent]);
  const capitalBoundaries = useMemo(() => {
    if (!capitalContext || !mapExtent) return [];
    const nearby = { ...capitalContext, features: capitalContext.features.filter((feature) => ["서울특별시", "경기도", "인천광역시"].includes(String(feature.properties.name || ""))) };
    return projectAdministrativeBoundaries(nearby, 760, 560, mapExtent);
  }, [capitalContext, mapExtent]);
  const capitalDistrictBoundaries = useMemo(() => {
    if (!capitalDistrictContext || !mapExtent || focus !== "sido" || selectedSido !== "서울특별시") return [];
    const features = capitalDistrictContext.features.filter((feature) => {
      const extent = geoJsonExtent({ type: "FeatureCollection", features: [feature] });
      return extent ? geoExtentsIntersect(extent, mapExtent) : false;
    });
    return projectAdministrativeBoundaries({ type: "FeatureCollection", features }, 760, 560, mapExtent)
      .filter((boundary) => boundary.centerX > -60 && boundary.centerX < 820 && boundary.centerY > -60 && boundary.centerY < 620);
  }, [capitalDistrictContext, focus, mapExtent, selectedSido]);
  const capitalDistrictLabels = useMemo(() => visibleAdministrativeLabels(capitalDistrictBoundaries), [capitalDistrictBoundaries]);
  const neighborDongBoundaries = useMemo(() => {
    if (!neighborDongContext || !mapExtent || !data) return [];
    const activeExtent = geoJsonExtent(data); if (!activeExtent) return [];
    const contextExtent = expandGeoExtent(activeExtent, .04, .04);
    const nearbyFeatures = neighborDongContext.features.filter((feature) => { const extent = geoJsonExtent({ type: "FeatureCollection", features: [feature] }); return extent ? geoExtentsIntersect(extent, contextExtent) : false; });
    return projectAdministrativeBoundaries({ type: "FeatureCollection", features: nearbyFeatures }, 760, 560, mapExtent).filter((boundary) => boundary.centerX > -40 && boundary.centerX < 800 && boundary.centerY > -40 && boundary.centerY < 600);
  }, [data, mapExtent, neighborDongContext]);
  const neighborVisibleLabels = useMemo(() => visibleAdministrativeLabels(neighborDongBoundaries), [neighborDongBoundaries]);
  const neighborDongMeta = useMemo(() => new Map((neighborDongContext?.features || []).map((feature) => [String(feature.properties.code || ""), { name: String(feature.properties.name || ""), sigungu: String(feature.properties.sigunguName || ""), sigunguCode: String(feature.properties.sigunguCode || "") }])), [neighborDongContext]);
  const districtContextBoundaries = useMemo(() => {
    if (!districtContext || !mapExtent || focus !== "district") return [];
    const visibleCodes = new Set([activeRegion.code, ...neighboringRegions.map((region) => region.code)]);
    return projectAdministrativeBoundaries({ type: "FeatureCollection", features: districtContext.features.filter((feature) => visibleCodes.has(String(feature.properties.code || ""))) }, 760, 560, mapExtent);
  }, [activeRegion.code, districtContext, focus, mapExtent, neighboringRegions]);
  const parentLocatorBoundaries = useMemo(() => districtContext && focus === "district" ? projectAdministrativeBoundaries(districtContext, 160, 112) : [], [districtContext, focus]);
  const stageTitle = focus === "national" ? "대한민국 전체" : focus === "sido" ? selectedSido : `${activeRegion.sido} · ${activeRegion.sigungu}`;
  const stageHint = focus === "national" ? "대표 지역명만 크게 표시했습니다. 모든 경계는 바로 선택할 수 있습니다." : focus === "sido" ? `${selectedSido} 안의 시·군·구를 누르면 다음 지도로 이동합니다.` : `선택 구는 선명하게, 맞닿은 구와 동은 옅게 이어서 보여줍니다. 주변 동도 눌러 이동할 수 있습니다.`;
  const districtValues = Object.values(dongStats).map((stat) => dongMetric === "price" ? stat.median : dongMetric === "py" ? stat.perPy : stat.count).filter((value) => value > 0);
  const districtMid = districtValues.length ? median(districtValues) : 0;
  const isSelected = (boundary: ProjectedBoundary) => focus === "national" ? boundary.name === selectedSido : focus === "sido" ? boundary.code === activeRegion.code : selectedBoundaryDong ? boundary.name === selectedBoundaryDong : selectedDong !== "all" && boundary.name === selectedDong;
  const visibleLabels = useMemo(() => visibleAdministrativeLabels(boundaries), [boundaries]);
  const selectBoundary = (boundary: ProjectedBoundary) => {
    if (focus === "national") onSelectSido(boundary.name);
    else if (focus === "sido") { const region = REGIONS.find((item) => item.code === boundary.code); if (region) onSelectRegion(region); }
    else onSelectDong(boundary.name);
  };
  const selectNeighborDong = (boundary: ProjectedBoundary) => {
    const meta = neighborDongMeta.get(boundary.code);
    const region = meta ? REGIONS.find((item) => item.code === meta.sigunguCode) : null;
    if (!meta || !region) return;
    onSelectRegion(region);
    onSelectDong(meta.name);
  };
  const boundaryMetric = (boundary: ProjectedBoundary) => {
    if (focus === "national") { const market = markets.find((item) => item.sido === boundary.name); return market?.changePct !== null && market?.changePct !== undefined ? `${market.changePct >= 0 ? "+" : ""}${market.changePct.toFixed(1)}%` : market ? "표본 부족" : "집계 중"; }
    if (focus === "district") return formatDongMetric(dongStats[boundary.name], dongMetric);
    return boundary.code === activeRegion.code ? "선택됨" : "보기";
  };
  const boundaryTone = (boundary: ProjectedBoundary) => {
    if (focus === "district") {
      const stat = dongStats[boundary.name];
      if (!stat?.count || !districtMid) return "no-data";
      const value = dongMetric === "price" ? stat.median : dongMetric === "py" ? stat.perPy : stat.count;
      return value >= districtMid * 1.15 ? "price-high" : value <= districtMid * .85 ? "price-low" : "price-mid";
    }
    if (focus !== "national") return "neutral";
    const change = markets.find((item) => item.sido === boundary.name)?.changePct;
    if (change === null || change === undefined) return "neutral";
    return change > 1 ? "hot" : change < -1 ? "cold" : "flat";
  };
  return <div className={`administrative-market-map level-${focus}`}>
    <div className="administrative-map-head"><div>{focus === "district" && <span className="administrative-selected-region">현재 보고 있는 지역 · {activeRegion.sigungu}</span>}<b>{stageTitle}</b><small>{stageHint}</small></div><div className="administrative-map-actions">{focus === "district" && <div className="dong-metric-tabs" aria-label="동네 가격 지도 지표">{([['price', '중위가격'], ['py', '평당가'], ['volume', '거래량']] as const).map(([metric, label]) => <button type="button" key={metric} className={dongMetric === metric ? "active" : ""} aria-pressed={dongMetric === metric} onClick={() => onDongMetricChange(metric)}>{label}</button>)}</div>}<div className={`administrative-map-key key-${focus}`} aria-label="지도 색상 범례">{focus === "national" ? <><span><i className="cold" />하락</span><span><i className="flat" />보합</span><span><i className="hot" />상승</span></> : focus === "district" ? <><span><i className="price-low" />낮음</span><span><i className="price-mid" />중간</span><span><i className="price-high" />높음</span></> : <span><i className="selected" />선택 경계</span>}</div><div className="administrative-map-mode"><i />행정경계 데이터</div></div></div>
    {data ? <svg className="administrative-map-svg" viewBox={focus === "national" ? "100 0 560 560" : "0 0 760 560"} role="img" aria-label={`${stageTitle} 행정구역 선택 지도`}>
      {capitalBoundaries.length > 0 && <g className="capital-context" aria-hidden="true">
        {capitalBoundaries.map((boundary) => <path key={boundary.code} className={`capital-context-region context-${boundary.code}`} d={boundary.path} fillRule="evenodd" />)}
      </g>}
      {capitalDistrictBoundaries.length > 0 && <g className="capital-district-context">
        {capitalDistrictBoundaries.map((boundary) => {
          const region = REGIONS.find((item) => item.code === boundary.code);
          if (!region) return null;
          return <g key={boundary.code} className="capital-district-region" role="button" tabIndex={0} aria-label={`${region.sido} ${region.sigungu}으로 이동`} onClick={() => onSelectRegion(region)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectRegion(region); } }}>
            <title>{region.sido} · {region.sigungu}</title>
            <path d={boundary.path} fillRule="evenodd" />
          </g>;
        })}
        <g className="capital-district-labels" aria-hidden="true">{capitalDistrictBoundaries.map((boundary) => capitalDistrictLabels.has(boundary.code) ? <text key={boundary.code} x={boundary.centerX} y={boundary.centerY} textAnchor="middle" dominantBaseline="middle">{compactAdministrativeLabel(boundary.name, "sido")}</text> : null)}</g>
      </g>}
      {districtContextBoundaries.length > 0 && <g className="district-context" aria-hidden="true">
        {districtContextBoundaries.map((boundary) => <g key={boundary.code} className={boundary.code === activeRegion.code ? "active" : "neighbor"}><path d={boundary.path} fillRule="evenodd" />{boundary.code !== activeRegion.code && <text x={boundary.centerX} y={boundary.centerY} textAnchor="middle">{boundary.name}</text>}</g>)}
      </g>}
      {neighborDongBoundaries.length > 0 && <g className="neighbor-dong-context">
        {neighborDongBoundaries.map((boundary) => { const meta = neighborDongMeta.get(boundary.code); if (!meta) return null; return <g key={boundary.code} className="neighbor-dong-region" role="button" tabIndex={0} aria-label={`${meta.sigungu} ${meta.name}으로 이동`} onClick={() => selectNeighborDong(boundary)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNeighborDong(boundary); } }}><title>{meta.sigungu} · {meta.name}</title><path d={boundary.path} fillRule="evenodd" /></g>; })}
        <g className="neighbor-dong-labels" aria-hidden="true">{neighborDongBoundaries.map((boundary) => { const meta = neighborDongMeta.get(boundary.code); if (!meta || !neighborVisibleLabels.has(boundary.code)) return null; return <text key={boundary.code} x={boundary.centerX} y={boundary.centerY} textAnchor="middle" dominantBaseline="middle">{meta.name}</text>; })}</g>
      </g>}
      {boundaries.map((boundary) => {
        const selected = isSelected(boundary);
        return <g key={boundary.code} className={`administrative-region tone-${boundaryTone(boundary)}${selected ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`${boundary.name} ${boundaryMetric(boundary)}`} onClick={() => selectBoundary(boundary)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectBoundary(boundary); } }}>
          <title>{boundary.name} · {boundaryMetric(boundary)}</title>
          <path className="administrative-region-hit" d={boundary.path} fillRule="evenodd" />
          <path className="administrative-region-surface" d={boundary.path} fillRule="evenodd" />
        </g>;
      })}
      {focus === "district" && <g className="district-active-outline" aria-hidden="true">{districtContextBoundaries.filter((boundary) => boundary.code === activeRegion.code).map((boundary) => <path key={boundary.code} d={boundary.path} fillRule="evenodd" />)}</g>}
      <g className="administrative-label-layer" aria-hidden="true">{boundaries.map((boundary) => {
        if (!visibleLabels.has(boundary.code)) return null;
        const selected = isSelected(boundary); const offset = focus === "national" ? NATIONAL_LABEL_OFFSETS[boundary.name] || [0, 0] : [0, 0]; const labelX = boundary.centerX + offset[0]; const labelY = boundary.centerY + offset[1];
        return <g key={boundary.code} className={`administrative-label${selected ? " selected" : ""}`} transform={`translate(${labelX} ${labelY})`}>
          {(offset[0] !== 0 || offset[1] !== 0) && <line className="administrative-label-line" x1={-offset[0]} y1={-offset[1]} x2="0" y2="0" />}
          <text className="administrative-label-name" textAnchor="middle" dominantBaseline="middle">{compactAdministrativeLabel(boundary.name, focus)}</text>
        </g>;
      })}</g>
    </svg> : <div className="administrative-map-loading"><i />행정경계를 조립하고 있습니다.</div>}
    {focus === "district" && parentLocatorBoundaries.length > 0 && <aside className="parent-region-locator" aria-label={`${activeRegion.sido} 안에서 ${activeRegion.sigungu}의 위치`}><span>{activeRegion.sido} 안의 위치</span><b>{activeRegion.sigungu}</b><svg viewBox="0 0 160 112" role="img" aria-label={`${activeRegion.sigungu}가 강조된 ${activeRegion.sido} 지도`}>{parentLocatorBoundaries.map((boundary) => <path key={boundary.code} className={boundary.code === activeRegion.code ? "selected" : ""} d={boundary.path} fillRule="evenodd" />)}</svg></aside>}
    <div className="administrative-map-foot"><span><i />선택 지역</span><b>{focus === "national" ? selectedSido : focus === "sido" ? activeRegion.sigungu : selectedBoundaryDong || "동을 선택하세요"}</b><small>{focus === "district" ? selectedBoundaryDong ? selectedDong !== "all" && selectedDong !== selectedBoundaryDong ? `${selectedDong} 법정동 실거래와 공식 코드로 연결했습니다.` : dongStats[selectedBoundaryDong] ? `${formatDongMetric(dongStats[selectedBoundaryDong], dongMetric)} · 공식 동 이름이 일치하는 거래만 연결합니다.` : "행정동의 공식 법정동 코드를 확인하고 있습니다." : "경계를 누르면 지역명과 실거래 요약을 먼저 확인합니다." : "경계를 누르면 한 단계씩 확대됩니다."}</small>{focus === "district" && selectedBoundaryDong && selectedDong !== "all" && <button type="button" className="administrative-map-open" disabled={!ROAD_MAP_AVAILABLE} onClick={onOpenBuildings}>{ROAD_MAP_AVAILABLE ? "건물 지도 보기" : "카카오 지도 키 연결 전"}</button>}</div>
    {boundaryError && <div className="administrative-map-error" role="status"><b>행정경계를 불러오지 못했습니다.</b><span>{boundaryError}</span><button type="button" onClick={() => setBoundaryRetry((value) => value + 1)}>다시 불러오기</button></div>}
  </div>;
}

function KakaoMarketMap({ markets, focus, active, propertyType, selectedSido, activeRegion, selectedDong, selectedBoundaryDong, dongStats, dongMetric, onDongMetricChange, buildingLocations, buildingsLoading, buildingsError, selectedPropertyKey, camera, onCameraChange, onSelectSido, onSelectRegion, onSelectDong, onOpenBuildings, onSelectProperty }: {
  markets: OverviewMarket[];
  focus: MapFocus;
  active: boolean;
  propertyType: PropertyType;
  selectedSido: string;
  activeRegion: Region;
  selectedDong: string;
  selectedBoundaryDong: string;
  dongStats: Record<string, DongMarketStat>;
  dongMetric: DongMetric;
  onDongMetricChange: (metric: DongMetric) => void;
  buildingLocations: PropertyMapLocation[];
  buildingsLoading: boolean;
  buildingsError: string;
  selectedPropertyKey: string;
  camera: MapCamera | null;
  onCameraChange: (camera: MapCamera) => void;
  onSelectSido: (sido: string) => void;
  onSelectRegion: (region: Region) => void;
  onSelectDong: (dong: string) => void;
  onOpenBuildings: () => void;
  onSelectProperty: (key: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<{ context: string; lat: number; lng: number; level: number } | null>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const initialCameraRef = useRef<MapCamera | null>(camera);
  const selectedPropertyKeyRef = useRef(selectedPropertyKey);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSelectPropertyRef = useRef(onSelectProperty);
  const shouldFitMarkersRef = useRef(true);
  const applyMarkerSelectionRef = useRef<(key: string) => void>(() => undefined);
  const [mapError, setMapError] = useState("");
  const [mapGeneration, setMapGeneration] = useState(0);
  const stageTitle = focus === "national" ? "대한민국 16개 시·도" : focus === "sido" ? selectedSido : focus === "buildings" ? `${activeRegion.sido} ${activeRegion.sigungu} · ${selectedDong === "all" ? selectedBoundaryDong : selectedDong}` : `${activeRegion.sido} ${activeRegion.sigungu}${selectedBoundaryDong ? ` · ${selectedBoundaryDong}` : ""}`;
  const stageHint = focus === "national" ? "시·도 경계를 눌러 다음 단계로 들어가세요." : focus === "sido" ? "시·군·구 경계를 눌러 읍·면·동 지도로 확대하세요." : focus === "buildings" ? buildingsLoading ? "선택 지역과 주변 법정동의 최근 실거래 건물을 확인하고 있습니다." : buildingsError ? buildingsError : "선택 지역을 중심으로 주변 동의 건물과 가격을 함께 표시합니다. 지도를 움직여 다른 지역도 계속 살펴보세요." : selectedBoundaryDong ? `${selectedBoundaryDong} 행정경계를 선택했습니다.` : "읍·면·동 경계를 누르면 실거래 건물 지도로 확대됩니다.";
  const fallbackLocation = buildingLocations[0] || SIDO_CENTERS[selectedSido] || { lat: 36.35, lng: 127.85, zoom: 8 };
  const visibleMapPrices = useMemo(() => buildingLocations.map((building) => building.lastAmount).filter((price) => price > 0), [buildingLocations]);
  const visibleMapPriceBands = useMemo(() => buildMapPriceBands(visibleMapPrices), [visibleMapPrices]);
  // A dong/property/filter change must not recreate the user's spatial frame.
  // Only moving to another sigungu creates a new camera scope.
  const cameraContext = activeRegion.code;
  const cameraContextRef = useRef(cameraContext);
  const selectedSidoRef = useRef(selectedSido);

  useEffect(() => {
    initialCameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    selectedPropertyKeyRef.current = selectedPropertyKey;
    applyMarkerSelectionRef.current(selectedPropertyKey);
  }, [selectedPropertyKey]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
    onSelectPropertyRef.current = onSelectProperty;
  }, [onCameraChange, onSelectProperty]);

  useEffect(() => {
    cameraContextRef.current = cameraContext;
    selectedSidoRef.current = selectedSido;
  }, [cameraContext, selectedSido]);

  useEffect(() => {
    const host = hostRef.current;
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;
    let lastHostWidth = 0;
    let lastHostHeight = 0;
    let mapInstance: KakaoMapInstance | null = null;
    let userCameraChange = false;
    const listeners: KakaoEventListener[] = [];
    if (!host || !active || focus !== "buildings") return;
    if (!appKey) {
      const timer = window.setTimeout(() => setMapError("카카오 지도 JavaScript 키가 연결되지 않았습니다."), 0);
      return () => window.clearTimeout(timer);
    }

    loadKakaoMap(appKey).then(async () => {
      if (disposed || !window.kakao?.maps) return;
      const maps = window.kakao.maps;
      const currentContext = cameraContextRef.current;
      const province = SIDO_CENTERS[selectedSidoRef.current] || { lat: 36.35, lng: 127.85, zoom: 8 };
      const initialCamera = initialCameraRef.current;
      const sharedCamera = initialCamera && (initialCamera.contextKey === currentContext || initialCamera.changedBy === "restore") ? { context: currentContext, lat: initialCamera.center.lat, lng: initialCamera.center.lng, level: initialCamera.level } : null;
      const preservedCamera = sharedCamera || (cameraRef.current?.context === currentContext ? cameraRef.current : null);
      const initial = preservedCamera || province;
      const map = new maps.Map(host, { center: new maps.LatLng(initial.lat, initial.lng), level: preservedCamera?.level ?? kakaoLevelForZoom(province.zoom) });
      mapInstance = map;
      mapInstanceRef.current = map;
      shouldFitMarkersRef.current = !preservedCamera;
      setMapGeneration((generation) => generation + 1);
      map.addControl?.(new maps.ZoomControl(), maps.ControlPosition.TOPRIGHT);
      resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect || (Math.abs(rect.width - lastHostWidth) < 1 && Math.abs(rect.height - lastHostHeight) < 1)) return;
        lastHostWidth = rect.width;
        lastHostHeight = rect.height;
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          if (!disposed && mapInstanceRef.current === map) map.relayout?.();
        });
      });
      resizeObserver.observe(host);

      const addListener = (target: unknown, eventName: string, listener: (...args: unknown[]) => void) => {
        maps.event.addListener(target, eventName, listener); listeners.push({ target, eventName, listener });
      };
      if (focus === "buildings") {
        if (preservedCamera) {
          map.setCenter?.(new maps.LatLng(preservedCamera.lat, preservedCamera.lng));
          map.setLevel(preservedCamera.level);
        }
        addListener(map, "dragstart", () => { userCameraChange = true; });
        addListener(map, "zoom_start", () => { userCameraChange = true; });
        addListener(map, "idle", () => {
          if (!userCameraChange || disposed || mapInstanceRef.current !== map) return;
          userCameraChange = false;
          const center = map.getCenter?.();
          const lat = center?.getLat?.();
          const lng = center?.getLng?.();
          if (typeof lat === "number" && typeof lng === "number") {
            const context = cameraContextRef.current;
            cameraRef.current = { context, lat, lng, level: map.getLevel() };
            onCameraChangeRef.current({ contextKey: context, center: { lat, lng }, level: map.getLevel(), changedBy: "user" });
          }
        });
        setMapError("");
        return;
      }

      setMapError("");
    }).catch((error) => { if (!disposed && (!(error instanceof Error) || error.name !== "AbortError")) setMapError(safeMapMessage(error)); });

    return () => {
      disposed = true; resizeObserver?.disconnect(); window.cancelAnimationFrame(resizeFrame); listeners.forEach(safelyRemoveKakaoListener); if (mapInstanceRef.current === mapInstance) mapInstanceRef.current = null; host.replaceChildren();
    };
  }, [active, focus]);

  useEffect(() => {
    const host = hostRef.current;
    const map = mapInstanceRef.current;
    const maps = window.kakao?.maps;
    if (!host || !map || !maps || !active || focus !== "buildings") return;
    let selectedDetailOverlay: KakaoOverlayInstance | null = null;
    const nativeMarkers: KakaoMarkerInstance[] = [];
    const markerListeners: KakaoEventListener[] = [];
    const markerEntries: Array<{ building: PropertyMapLocation; marker: KakaoMarkerInstance; position: KakaoLatLng }> = [];
    const markerImageCache = new Map<string, unknown>();
    const markerImageFor = (building: PropertyMapLocation) => {
      const heat = classifyMapPrice(building.lastAmount, visibleMapPriceBands);
      const cacheKey = `${building.propertyType}-${heat}-${building.scope}`;
      const cached = markerImageCache.get(cacheKey);
      if (cached) return cached;
      const colors: Record<string, string> = { "price-level-1": "#236b9b", "price-level-2": "#287f91", "price-level-3": "#5f6f7f", "price-level-4": "#b46a3c", "price-level-5": "#b93f36" };
      const fill = colors[heat] || colors["price-level-3"];
      const opacity = building.scope === "selected" ? 1 : .82;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46"><path d="M19 44C14 36 3 29 3 18A16 16 0 0 1 35 18c0 11-11 18-16 26Z" fill="${fill}" fill-opacity="${opacity}" stroke="#fff" stroke-width="3"/><g transform="translate(7 6)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PROPERTY_ICON_PATHS[building.propertyType]}</g></svg>`;
      const image = new maps.MarkerImage(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, new maps.Size(38, 46), { offset: new maps.Point(19, 44) });
      markerImageCache.set(cacheKey, image);
      return image;
    };
    const renderMarkerSelection = (selectedKey: string) => {
      selectedDetailOverlay?.setMap(null);
      selectedDetailOverlay = null;
      const selectedEntry = markerEntries.find(({ building }) => building.key === selectedKey);
      if (!selectedEntry) return;
      const { building, position } = selectedEntry;
      const detail = document.createElement("button");
      const heat = classifyMapPrice(building.lastAmount, visibleMapPriceBands);
      detail.type = "button";
      detail.className = `naver-building-pin detail-pin is-active ${heat} kind-${building.propertyType} scope-${building.scope}`;
      detail.setAttribute("aria-label", `${building.dong} ${building.name}, 선택됨, 최근 실거래 ${formatPrice(building.lastAmount)}, ${building.count}건`);
      detail.innerHTML = `<i class="property-marker-icon">${propertyMapIconMarkup(building.propertyType)}</i><span class="property-marker-copy"><small>${escapeMapHtml(PROPERTY_MAP_META[building.propertyType].short)} · 최근 실거래</small><strong>${escapeMapHtml(formatPrice(building.lastAmount))}</strong><em>${escapeMapHtml(building.name)} · ${building.count}건</em></span>`;
      selectedDetailOverlay = new maps.CustomOverlay({ position, map, content: detail, xAnchor: .5, yAnchor: 1.18, zIndex: 140 });
    };
    applyMarkerSelectionRef.current = renderMarkerSelection;
    buildingLocations.forEach((building) => {
      const position = new maps.LatLng(building.lat, building.lng);
      const marker = new maps.Marker({ position, image: markerImageFor(building), title: `${building.dong} ${building.name} · ${formatPrice(building.lastAmount)}`, clickable: true });
      markerEntries.push({ building, marker, position });
      nativeMarkers.push(marker);
      const listener = () => { applyMarkerSelectionRef.current(building.key); onSelectPropertyRef.current(building.key); };
      maps.event.addListener(marker, "click", listener);
      markerListeners.push({ target: marker, eventName: "click", listener });
    });
    const markerClusterer = new maps.MarkerClusterer({ map, averageCenter: true, minLevel: 7, minClusterSize: 2, gridSize: 58, disableClickZoom: false, styles: [{ width: "42px", height: "42px", background: "#0d2038e8", border: "2px solid #fff", borderRadius: "50%", color: "#fff", textAlign: "center", fontWeight: "800", lineHeight: "38px", boxShadow: "0 6px 18px #0d203844" }] });
    markerClusterer.addMarkers(nativeMarkers);
    host.dataset.markerRenderer = "native-clusterer";
    host.dataset.visibleMarkers = String(nativeMarkers.length);
    if (shouldFitMarkersRef.current && buildingLocations.length) {
      const bounds = new maps.LatLngBounds();
      buildingLocations.forEach((location) => bounds.extend(new maps.LatLng(location.lat, location.lng)));
      map.setBounds(bounds, 76, 34, 34, 34);
      map.setLevel(Math.min(7, Math.max(4, map.getLevel() + 1)));
      shouldFitMarkersRef.current = false;
    }
    renderMarkerSelection(selectedPropertyKeyRef.current);
    return () => {
      applyMarkerSelectionRef.current = () => undefined;
      markerListeners.forEach(safelyRemoveKakaoListener);
      selectedDetailOverlay?.setMap(null);
      markerClusterer.clear();
      nativeMarkers.forEach((marker) => marker.setMap(null));
      delete host.dataset.markerRenderer;
      delete host.dataset.visibleMarkers;
    };
  }, [active, buildingLocations, focus, mapGeneration, visibleMapPriceBands]);

  useEffect(() => {
    if (!camera || camera.changedBy !== "restore" || focus !== "buildings") return;
    const map = mapInstanceRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    map.setCenter?.(new maps.LatLng(camera.center.lat, camera.center.lng));
    map.setLevel(camera.level);
    cameraRef.current = { context: cameraContext, lat: camera.center.lat, lng: camera.center.lng, level: camera.level };
  }, [camera, cameraContext, focus]);

  if (focus === "national" || focus === "sido" || focus === "district") return <AdministrativeMarketMap key={`${focus}-${selectedSido}-${activeRegion.code}`} focus={focus} active={active} markets={markets} selectedSido={selectedSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} dongStats={dongStats} dongMetric={dongMetric} onDongMetricChange={onDongMetricChange} onSelectSido={onSelectSido} onSelectRegion={onSelectRegion} onSelectDong={onSelectDong} onOpenBuildings={onOpenBuildings} />;

  return <div className="naver-market-map">
    {mapError ? <MapFallback lat={fallbackLocation.lat} lng={fallbackLocation.lng} title={stageTitle} message={mapError} /> : <div ref={hostRef} className="naver-market-canvas" aria-label={`${stageTitle} 카카오 지도`} />}
    <KoreaFocusLocator active={active} selectedSido={selectedSido} />
    <div className="map-stage-card"><span>{focus === "buildings" ? "건물 지도" : "지역 지도"}</span><b>{stageTitle}</b><small>{stageHint}</small></div>
    {focus === "buildings" && <details className="building-map-legend"><summary><span className="legend-scale" aria-hidden="true"><i /><i /><i /><i /><i /></span><b>가격대</b><small>펼쳐보기</small></summary><div className="building-legend-type"><PropertyTypeIcon type={propertyType} /><span><small>주택 유형</small><b>{PROPERTY_MAP_META[propertyType].label}</b></span></div>{visibleMapPriceBands.length ? <div className="building-legend-heat" aria-label="현재 화면 건물 가격 5단계"><header><b>현재 화면 가격대</b><small>표시된 실거래를 5구간으로 분류</small></header>{visibleMapPriceBands.map((band) => { const range = formatMapPriceBand(band); return <span key={band.id} aria-label={`${band.label} ${range}`}><i className={band.className} /><b>{band.label}</b><small title={range}>{range}</small></span>; })}</div> : <p className="building-legend-empty">가격 구간을 계산할 거래 건물이 없습니다.</p>}<small>현재 화면의 최근 실거래 분포 기준입니다.</small></details>}
  </div>;
}

export default function Home() {
  const navRef = useRef<HTMLElement>(null);
  const fieldSelectorRef = useRef<HTMLDivElement>(null);
  const fieldWorkspaceRef = useRef<HTMLElement>(null);
  const fieldInlineMapRef = useRef<HTMLDivElement>(null);
  const facilityPanelRef = useRef<HTMLElement>(null);
  const themeInteractedRef = useRef(false);
  const spacePlanInputRef = useRef<HTMLInputElement>(null);
  const spaceFurnitureSequenceRef = useRef(0);
  const historyModeRef = useRef<"replace" | "push">("replace");
  const restoringUrlRef = useRef(false);
  const viewportContextRef = useRef("");
  const pendingPropertyRef = useRef("");
  const pendingBoundaryRef = useRef("");
  const boundaryDongsRef = useRef<BoundaryDong[]>([]);
  const [type, setType] = useState<PropertyType>("apt"); const [period, setPeriod] = useState(12); const [regionCode, setRegionCode] = useState("11680");
  const [regionInput, setRegionInput] = useState("서울특별시 강남구"); const [query, setQuery] = useState(""); const [submittedQuery, setSubmittedQuery] = useState(""); const [analysisAddressInput, setAnalysisAddressInput] = useState("서울특별시 강남구");
  const [trades, setTrades] = useState<Trade[]>([]); const [properties, setProperties] = useState<Property[]>([]); const [propertiesRegionCode, setPropertiesRegionCode] = useState(""); const [selectedKey, setSelectedKey] = useState("");
  const [researchBundle, setResearchBundle] = useState<ResearchBundle | null>(null);
  const [selectedDong, setSelectedDong] = useState("all"); const [selectedBuildingDong, setSelectedBuildingDong] = useState(""); const [selectedAreaBucket, setSelectedAreaBucket] = useState<number | null>(null); const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [area, setArea] = useState("all"); const [tradeAreaFilter, setTradeAreaFilter] = useState("all"); const [unit, setUnit] = useState<"price" | "py">("price"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [dataRetry, setDataRetry] = useState(0);
  const [dataFeedback, setDataFeedback] = useState<DataFeedback>({ status: "empty", warnings: [] });
  const [markets, setMarkets] = useState<OverviewMarket[]>([]); const [marketMonth, setMarketMonth] = useState(""); const [marketError, setMarketError] = useState(""); const [marketRetry, setMarketRetry] = useState(0);
  const [overviewFeedback, setOverviewFeedback] = useState<OverviewFeedback>({ status: "empty", warnings: [], scopeLabel: "16개 대표 시군구 표본", nationwide: false });
  const [buildingSort, setBuildingSort] = useState<"volume" | "price" | "rise" | "fall">("volume"); const [minVolume, setMinVolume] = useState(0); const [propertyLimit, setPropertyLimit] = useState(30);
  const [policyItems, setPolicyItems] = useState<readonly PolicyItem[]>(POLICIES); const [policyUpdated, setPolicyUpdated] = useState("");
  const [activeSection, setActiveSection] = useState<ScreenId>("home"); const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("price"); const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0 });
  const [themePreference, setThemePreference] = useState<ThemePreference>("system"); const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [selectedMapSido, setSelectedMapSido] = useState("서울특별시"); const [mapFocus, setMapFocus] = useState<MapFocus>("district"); const [selectedBoundaryDong, setSelectedBoundaryDong] = useState(""); const [boundaryDongOptions, setBoundaryDongOptions] = useState<string[]>([]); const [boundaryDongs, setBoundaryDongs] = useState<BoundaryDong[]>([]); const [mapPickerDong, setMapPickerDong] = useState(""); const [dongMetric, setDongMetric] = useState<DongMetric>("price"); const [mapCamera, setMapCamera] = useState<MapCamera | null>(null);
  const [savedHomes, setSavedHomes] = useState<SavedHome[]>([]);
  const [fieldGroup, setFieldGroup] = useState(FIELD_GROUPS[0]); const [fieldFeatureId, setFieldFeatureId] = useState("region"); const [timeSlotIndex, setTimeSlotIndex] = useState(3); const [noiseSources, setNoiseSources] = useState(() => NOISE_SOURCES.map((source) => source.id));
  const [commuteDestination, setCommuteDestination] = useState(""); const [commuteEstimate, setCommuteEstimate] = useState<CommuteEstimate | null>(null); const [commuteLoading, setCommuteLoading] = useState(false); const [commuteError, setCommuteError] = useState("");
  const [lifestyleKeyword, setLifestyleKeyword] = useState("마트"); const [showFieldMap, setShowFieldMap] = useState(false); const [showPriceLocationMap, setShowPriceLocationMap] = useState(false);
  const [spaceArea, setSpaceArea] = useState(""); const [spaceRoomName, setSpaceRoomName] = useState("안방"); const [spaceRoomWidth, setSpaceRoomWidth] = useState("360"); const [spaceRoomDepth, setSpaceRoomDepth] = useState("420");
  const [spacePlanUrl, setSpacePlanUrl] = useState(""); const [spacePlanName, setSpacePlanName] = useState(""); const [spacePlanError, setSpacePlanError] = useState("");
  const [spaceFurniture, setSpaceFurniture] = useState<PlacedFurniture[]>([]); const [selectedSpaceFurnitureId, setSelectedSpaceFurnitureId] = useState("");
  const [researchCategory, setResearchCategory] = useState("price"); const [researchTool, setResearchTool] = useState("recent-fall");
  const [researchLimit, setResearchLimit] = useState(30);
  const [communityCategory, setCommunityCategory] = useState("living"); const [communityBoard, setCommunityBoard] = useState("전체");
  const [showStudyWriter, setShowStudyWriter] = useState(false); const [studyTitle, setStudyTitle] = useState(""); const [studyBody, setStudyBody] = useState(""); const [draftSaved, setDraftSaved] = useState(false);
  const [propertyLocation, setPropertyLocation] = useState<PropertyLocation | null>(null); const [locationLoading, setLocationLoading] = useState(false); const [locationError, setLocationError] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]); const [nearbyLoading, setNearbyLoading] = useState(false); const [nearbyError, setNearbyError] = useState(""); const [nearbyCategory, setNearbyCategory] = useState("전체"); const [nearbySubtype, setNearbySubtype] = useState("전체"); const [nearbyRadius, setNearbyRadius] = useState(500);
  const [buildingLocations, setBuildingLocations] = useState<PropertyMapLocation[]>([]); const [buildingsLoading, setBuildingsLoading] = useState(false); const [buildingsError, setBuildingsError] = useState("");
  const [buildingStatus, setBuildingStatus] = useState<MapDataStatus>("empty"); const [nearbyStatus, setNearbyStatus] = useState<MapDataStatus>("empty");
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("peek"); const [expandedTradeIds, setExpandedTradeIds] = useState<Set<string>>(() => new Set()); const [online, setOnline] = useState(true);
  const [urlHydrated, setUrlHydrated] = useState(false); const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [selectedHCode, setSelectedHCode] = useState(""); const [selectedBCode, setSelectedBCode] = useState("");
  const activeRegion = REGIONS.find((item) => item.code === regionCode) || REGIONS[0];
  const selectedBoundaryCode = boundaryDongs.find((dong) => dong.name === selectedBoundaryDong)?.code;
  const chooseThemePreference = (next: ThemePreference) => { themeInteractedRef.current = true; try { window.localStorage.setItem("jipgaps:theme", next); } catch { /* device storage is optional */ } setThemePreference(next); };

  useEffect(() => { const timer = window.setTimeout(() => { try { const stored = window.localStorage.getItem("jipgaps:saved-homes"); if (stored) setSavedHomes(JSON.parse(stored)); const draft = window.localStorage.getItem("jipgaps:study-draft"); if (draft) { const parsed = JSON.parse(draft); setStudyTitle(parsed.title || ""); setStudyBody(parsed.body || ""); } } catch { /* device storage is optional */ } }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const update = () => setOnline(window.navigator.onLine); update(); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
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
  useEffect(() => () => { if (spacePlanUrl) URL.revokeObjectURL(spacePlanUrl); }, [spacePlanUrl]);

  useEffect(() => {
    const syncLocation = () => {
      restoringUrlRef.current = true;
      const url = new URL(window.location.href);
      const next = normalizeScreen(url.hash);
      const params = new URLSearchParams(window.location.search);
      const legacyHash = url.hash.replace(/^#/, "");
      const legacyFieldLink = legacyHash === "field";
      const legacyMapLink = legacyHash === "map";
      const viewState = readViewState(url);
      const requestedMode: AnalysisMode = legacyFieldLink || params.get("analysis") === "field" ? "field" : "price";
      const defaultRegion = REGIONS.find((region) => region.code === "11680") || REGIONS[0];
      const requestedRegion = viewState.sigungu ? REGIONS.find((region) => region.code === viewState.sigungu) : undefined;
      const requestedSido = viewState.sido && SIDO_ORDER.includes(viewState.sido) ? viewState.sido : undefined;
      const restoredRegion = requestedRegion || (requestedSido ? REGIONS.find((region) => region.sido === requestedSido) : undefined) || defaultRegion;
      setRegionCode(restoredRegion.code);
      setRegionInput(`${restoredRegion.sido} ${restoredRegion.sigungu}`);
      setSelectedMapSido(requestedSido || restoredRegion.sido);
      setSelectedDong("all");
      setSelectedBoundaryDong("");
      setMapPickerDong("");
      setMapFocus(requestedRegion ? "district" : requestedSido ? "sido" : "district");
      setSelectedHCode(viewState.hcode || "");
      setSelectedBCode(viewState.bcode || "");
      pendingBoundaryRef.current = viewState.boundary || "";
      const restoredBoundary = boundaryDongsRef.current.find((dong) => dong.code === pendingBoundaryRef.current);
      if (restoredBoundary) {
        setSelectedBoundaryDong(restoredBoundary.name);
        setMapPickerDong(restoredBoundary.name);
        pendingBoundaryRef.current = "";
      }
      pendingPropertyRef.current = viewState.property || "";
      setSelectedKey(viewState.property || "");
      setQuery(viewState.property || "");
      setArea(viewState.area || "all");
      setTradeAreaFilter(viewState.tradePy || "all");
      if (viewState.lat !== undefined && viewState.lng !== undefined && viewState.level !== undefined) setMapCamera({ contextKey: "url", center: { lat: viewState.lat, lng: viewState.lng }, level: viewState.level, changedBy: "restore" });
      else setMapCamera(null);
      setActiveSection(legacyFieldLink ? "chart" : legacyMapLink ? "research" : next);
      if (legacyFieldLink || next === "chart") {
        setAnalysisMode(requestedMode);
        const requestedFeature = FIELD_FEATURES.find((feature) => feature.id === params.get("feature"));
        if (requestedMode === "field" && requestedFeature) { setFieldGroup(requestedFeature.group); setFieldFeatureId(requestedFeature.id); }
      }
      if (legacyFieldLink) {
        url.searchParams.set("analysis", "field");
        url.hash = "chart";
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      if (legacyMapLink) {
        url.hash = "research";
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      setUrlHydrated(true);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })));
    };
    syncLocation();
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => { window.removeEventListener("hashchange", syncLocation); window.removeEventListener("popstate", syncLocation); };
  }, []);

  useEffect(() => {
    fetch("/api/release").then((response) => response.ok ? response.json() : Promise.reject(new Error("release unavailable"))).then((data: ReleaseInfo) => setReleaseInfo(data)).catch(() => setReleaseInfo({ commit: "local", shortCommit: "local", source: "local" }));
  }, []);

  useEffect(() => {
    if (!urlHydrated) return;
    if (restoringUrlRef.current) { restoringUrlRef.current = false; return; }
    const nextUrl = writeViewState(new URL(window.location.href), {
      screen: activeSection,
      sido: selectedMapSido,
      sigungu: regionCode,
      boundary: selectedBoundaryCode || undefined,
      hcode: selectedHCode || undefined,
      bcode: selectedBCode || undefined,
      property: selectedKey || undefined,
      area: area === "all" ? undefined : area,
      tradePy: tradeAreaFilter === "all" ? undefined : tradeAreaFilter,
      lat: mapCamera?.center.lat,
      lng: mapCamera?.center.lng,
      level: mapCamera?.level,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    const mode = historyModeRef.current;
    historyModeRef.current = "replace";
    if (mode === "push") window.history.pushState(null, "", nextUrl);
    else window.history.replaceState(null, "", nextUrl);
  }, [activeSection, area, mapCamera, regionCode, selectedBCode, selectedBoundaryCode, selectedHCode, selectedKey, selectedMapSido, tradeAreaFilter, urlHydrated]);

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
      fetch(`/api/trades?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "실거래가를 불러오지 못했습니다."); return data; }).then((data) => { const nextProperties = data.properties || []; setTrades(data.trades || []); setProperties(nextProperties); setPropertiesRegionCode(regionCode); setResearchBundle(data.research || null); setDataFeedback({ status: data.status || ((data.trades || []).length ? "ok" : "empty"), warnings: data.meta?.warnings || [] }); const requested = pendingPropertyRef.current; const restored = requested ? nextProperties.find((property: Property) => property.key === requested || property.name === requested || property.name.includes(requested)) : undefined; if (restored) { setSelectedKey(restored.key); setQuery(restored.name); setSubmittedQuery(restored.name); pendingPropertyRef.current = ""; } else if (nextProperties.length === 1) setSelectedKey(nextProperties[0].key); }).catch((reason) => { if (reason.name !== "AbortError") { setResearchBundle(null); setError(publicDataErrorMessage(reason.message)); setDataFeedback({ status: "partial", warnings: [reason.message] }); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [type, regionCode, period, submittedQuery, dataRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { setMarketError(""); fetch(`/api/overview?type=${type}&basis=quarter-v2`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error || !data.markets) throw new Error(data.error || "대표 지역 실거래 집계를 불러오지 못했습니다."); return data; }).then((data) => { setMarkets(data.markets); setMarketMonth(data.month); setOverviewFeedback({ status: data.status || "empty", warnings: data.meta?.warnings || [], scopeLabel: data.meta?.scope?.label || "대표 지역 표본", nationwide: data.meta?.scope?.nationwide === true }); }).catch((reason) => { if (reason.name !== "AbortError") setMarketError(publicDataErrorMessage(reason.message)); }); }, marketRetry ? 0 : 3000);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [type, marketRetry]);

  useEffect(() => {
    const controller = new AbortController(); fetch("/api/policies", { signal: controller.signal }).then((response) => response.json()).then((data) => { if (data.policies?.length) { setPolicyItems(data.policies); setPolicyUpdated(data.updatedAt); } }).catch(() => undefined); return () => controller.abort();
  }, []);

  const scopedTrades = useMemo(() => selectedDong === "all" ? trades : trades.filter((trade) => trade.dong === selectedDong), [trades, selectedDong]);
  const propertyTrades = useMemo(() => selectedKey ? scopedTrades.filter((trade) => trade.propertyKey === selectedKey && (!selectedBuildingDong || trade.buildingDong === selectedBuildingDong) && (selectedAreaBucket === null || areaBucket(trade.area) === selectedAreaBucket)) : scopedTrades, [scopedTrades, selectedKey, selectedBuildingDong, selectedAreaBucket]);
  const areas = useMemo(() => selectedKey ? [...new Set(propertyTrades.map((trade) => Math.round(trade.area * 10) / 10).filter(Boolean))].sort((a, b) => a - b) : [], [propertyTrades, selectedKey]);
  const filteredTrades = useMemo(() => propertyTrades.filter((trade) => area === "all" || Math.abs(trade.area - Number(area)) < .15), [propertyTrades, area]);
  const tradeAreaGroups = useMemo(() => {
    const grouped = new Map<number, Trade[]>();
    propertyTrades.forEach((trade) => {
      if (!trade.area) return;
      const pyeong = Math.round(trade.area / 3.3058);
      grouped.set(pyeong, [...(grouped.get(pyeong) || []), trade]);
    });
    return [...grouped.entries()].sort(([a], [b]) => a - b).map(([pyeong, rows]) => ({ pyeong, rows, median: median(rows.map((trade) => trade.amount)), areaMedian: median(rows.map((trade) => trade.area)) }));
  }, [propertyTrades]);
  const activeTradeAreaFilter = tradeAreaFilter === "all" || tradeAreaGroups.some((group) => String(group.pyeong) === tradeAreaFilter) ? tradeAreaFilter : "all";
  const recentTradeRows = useMemo(() => propertyTrades.filter((trade) => activeTradeAreaFilter === "all" || Math.round(trade.area / 3.3058) === Number(activeTradeAreaFilter)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30), [propertyTrades, activeTradeAreaFilter]);
  const maxAreaMedian = Math.max(1, ...tradeAreaGroups.map((group) => group.median));
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
  const analysisResearchView: AnalysisResearchView = researchTool === "record-high" ? "record-high" : researchTool === "top-rise" ? "growth-leaders" : researchTool === "price-compare" ? "price-per-pyeong" : researchTool === "price-change" ? "price-trend" : researchTool === "multi-compare" ? "complex-compare" : "recent-decline";
  const researchMetricKey: ResearchMetric = analysisResearchView === "record-high" ? "highest_price" : analysisResearchView === "growth-leaders" ? "top_growth" : analysisResearchView === "price-per-pyeong" ? "price_per_pyeong" : analysisResearchView === "price-trend" ? "price_change" : analysisResearchView === "complex-compare" ? "complex_compare" : "recent_decline";
  const activeResearchDataView = researchBundle?.views[researchMetricKey];
  const researchRowIndex = useMemo(() => new Map((researchBundle?.rows || []).map((row) => [row.id, row])), [researchBundle]);
  const researchPriceBuckets = useMemo(() => {
    const values = (researchBundle?.rows || []).map((row) => row.currentQuarter.medianAmountManwon ?? row.latestTrade?.amountManwon ?? 0).filter((value) => value > 0).sort((a, b) => a - b);
    return (value: number | null): PriceBucket => {
      if (!value || !values.length) return null;
      const rank = values.findIndex((candidate) => candidate >= value);
      return Math.min(5, Math.max(1, Math.floor((Math.max(rank, 0) / values.length) * 5) + 1)) as PriceBucket;
    };
  }, [researchBundle]);
  const formatResearchCell = useCallback((row: AreaPriceSummary, key: string): string => {
    const price = (value: number | null | undefined) => value === null || value === undefined ? "표본 부족" : formatPrice(value);
    const percent = (value: number | null | undefined) => value === null || value === undefined ? "표본 부족" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
    if (key === "area") return `${row.representativeAreaM2.toFixed(1)}㎡ · ${row.pyeongEquivalent.toFixed(1)}평`;
    if (key === "areaM2") return `${row.representativeAreaM2.toFixed(1)}㎡`;
    if (key === "areaPyeong") return `${row.pyeongEquivalent.toFixed(1)}평`;
    if (key === "buildingDong") return row.buildingDongs.join("·") || "동 정보 없음";
    if (key === "currentMedian") return price(row.currentQuarter.medianAmountManwon);
    if (key === "previousMedian") return price(row.previousQuarter.medianAmountManwon);
    if (key === "changeAmount") return price(row.changeAmountManwon);
    if (key === "changePct") return percent(row.changePct);
    if (key === "volume") return `${row.currentQuarter.volume}건`;
    if (key === "sample") return `${row.currentQuarter.volume}건 / ${row.previousQuarter.volume}건`;
    if (key === "highestAmount") return price(row.highestTrade?.amountManwon);
    if (key === "highestDate") return row.highestTrade?.date || "확인 필요";
    if (key === "floor") return row.highestTrade?.floor === null || row.highestTrade?.floor === undefined ? "-" : `${row.highestTrade.floor}층`;
    if (key === "highestPerPyeong") return row.highestTrade?.pricePerPyeongManwon ? `${Math.round(row.highestTrade.pricePerPyeongManwon).toLocaleString()}만원/평` : "확인 필요";
    if (key === "latestAmount") return price(row.latestTrade?.amountManwon);
    if (key === "medianPerPyeong") return row.period.medianPerPyeongManwon ? `${Math.round(row.period.medianPerPyeongManwon).toLocaleString()}만원/평` : "표본 부족";
    if (key === "regionDelta") return percent(row.regionDeltaPct);
    if (key === "latestDate") return row.latestTrade?.date || "확인 필요";
    if (key === "movingMedian") return price(row.trend.slice(-3).map((point) => point.medianAmountManwon).filter((value): value is number => value !== null).length ? median(row.trend.slice(-3).flatMap((point) => point.medianAmountManwon === null ? [] : [point.medianAmountManwon])) : null);
    if (key === "lowestAmount") return price(row.lowestTrade?.amountManwon);
    return "-";
  }, []);
  const analysisResearchRows = useMemo<ResearchPropertyRow[]>(() => {
    if (!activeResearchDataView) return [];
    return activeResearchDataView.rowIds.slice(0, researchLimit).flatMap((id, index) => {
      const row = researchRowIndex.get(id);
      if (!row) return [];
      const currentPrice = row.currentQuarter.medianAmountManwon ?? row.latestTrade?.amountManwon ?? null;
      const cells: ResearchCell[] = activeResearchDataView.columns.filter((column) => !["rank", "propertyName"].includes(column.key)).map((column, columnIndex) => ({
        key: column.key,
        label: column.label,
        value: formatResearchCell(row, column.key),
        numeric: column.kind !== "text" && column.kind !== "date",
        mobilePriority: columnIndex < 2 ? columnIndex === 0 ? "primary" : "secondary" : "detail",
        tone: column.key === "changePct" || column.key === "changeAmount" || column.key === "regionDelta" ? row.changePct === null ? "muted" : row.changePct >= 0 ? "up" : "down" : "neutral",
      }));
      return [{ key: row.id, rank: index + 1, name: row.propertyName, dong: `${row.dong} · ${row.pyeongEquivalent.toFixed(1)}평`, propertyType: row.propertyType, priceBucket: researchPriceBuckets(currentPrice), selected: selectedKey === row.propertyKey, sample: row.sample, cells }];
    });
  }, [activeResearchDataView, formatResearchCell, researchLimit, researchPriceBuckets, researchRowIndex, selectedKey]);
  const analysisResearchColumns = useMemo(() => activeResearchDataView?.columns.filter((column) => !["rank", "propertyName"].includes(column.key)).map((column) => column.key) || [], [activeResearchDataView]);
  const changeAnalysisResearchView = useCallback((view: AnalysisResearchView) => {
    const next = view === "record-high" ? "record-high" : view === "growth-leaders" ? "top-rise" : view === "price-per-pyeong" ? "price-compare" : view === "price-trend" ? "price-change" : view === "complex-compare" ? "multi-compare" : "recent-fall";
    setResearchTool(next); setResearchLimit(30);
  }, []);
  const selectAnalysisResearchProperty = useCallback((rowId: string) => {
    const row = researchRowIndex.get(rowId); if (!row) return;
    setSelectedKey(row.propertyKey); setSelectedBuildingDong(row.buildingDongs[0] || ""); setSelectedAreaBucket(Math.round(row.pyeongEquivalent)); setSelectedVariantKey(propertyRows.find((candidate) => candidate.propertyKey === row.propertyKey && Math.abs(candidate.areaMedian - row.representativeAreaM2) < 0.6)?.key || ""); setArea("all");
  }, [propertyRows, researchRowIndex]);
  const activeCommunityCategory = COMMUNITY_CATEGORIES.find((category) => category.id === communityCategory) || COMMUNITY_CATEGORIES[0];
  const visibleCommunityGuides = COMMUNITY_GUIDES.filter((guide) => guide.category === communityCategory && (communityBoard === "전체" || guide.board === communityBoard));
  const selectedProperty = properties.find((property) => property.key === selectedKey); const selectedVariant = propertyRows.find((property) => property.key === selectedVariantKey); const variantSuffix = selectedVariant ? `${dongLabel(selectedVariant.buildingDong)}${selectedVariant.buildingDong ? " · " : ""}전용 ${selectedVariant.areaBucket}평` : ""; const displayName = selectedProperty ? `${selectedProperty.name}${variantSuffix ? ` · ${variantSuffix}` : ""}` : (submittedQuery ? `${submittedQuery} 검색 결과` : `${activeRegion.sigungu} 전체`);
  const placePropertyKey = selectedProperty?.key || ""; const placePropertyName = selectedProperty?.name || ""; const placePropertyDong = selectedProperty?.dong || ""; const placeRegion = `${activeRegion.sido} ${activeRegion.sigungu}`; const placeAddressQuery = `${placeRegion} ${placePropertyDong} ${selectedProperty?.jibun || placePropertyName}`.replace(/\s+/g, " ").trim();
  useEffect(() => {
    const selectionAddress = selectedProperty ? `${activeRegion.sido} ${activeRegion.sigungu} ${selectedProperty.dong} ${selectedProperty.jibun || ""} ${selectedProperty.name}` : `${activeRegion.sido} ${activeRegion.sigungu}${selectedDong !== "all" ? ` ${selectedDong}` : ""}`;
    const timer = window.setTimeout(() => setAnalysisAddressInput(selectionAddress.replace(/\s+/g, " ").trim()), 0);
    return () => window.clearTimeout(timer);
  }, [activeRegion.sigungu, activeRegion.sido, selectedDong, selectedProperty]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!placePropertyKey) { setPropertyLocation(null); setLocationError(""); setLocationLoading(false); return; }
      setLocationLoading(true); setLocationError("");
      const params = new URLSearchParams({ query: placeAddressQuery, sido: activeRegion.sido, sigungu: activeRegion.sigungu, dong: placePropertyDong });
      params.set("sidoCode", activeRegion.code.slice(0, 2)); params.set("sigunguCode", activeRegion.code); params.set("legalDong", placePropertyDong); if (selectedBoundaryCode) params.set("boundaryCode", selectedBoundaryCode); if (selectedHCode) params.set("hCode", selectedHCode); if (selectedBCode) params.set("bCode", selectedBCode);
      fetch(`/api/geocode?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error || data.mapFallback?.markerAllowed === false || data.validation !== "verified") throw new Error(data.error || "선택 범위에서 검증된 단지 좌표를 찾지 못했습니다."); return data; }).then((data) => { setPropertyLocation({ lat: data.lat, lng: data.lng, roadAddress: data.roadAddress || "", jibunAddress: data.jibunAddress || "", codes: data.codes }); setSelectedHCode(data.codes?.adminDongCode || ""); setSelectedBCode(data.codes?.legalDongCode || ""); }).catch((reason) => { if (reason.name !== "AbortError") { setLocationError(reason.message); setPropertyLocation(null); } }).finally(() => { if (!controller.signal.aborted) setLocationLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeRegion.code, activeRegion.sigungu, activeRegion.sido, placeAddressQuery, placePropertyDong, placePropertyKey, selectedBCode, selectedBoundaryCode, selectedHCode]);
  useEffect(() => {
    const controller = new AbortController(); const timer = window.setTimeout(() => {
      if (!propertyLocation) { setNearbyPlaces([]); setNearbyError(""); return; }
      setNearbyLoading(true); setNearbyError(""); setNearbyCategory("전체"); setNearbySubtype("전체");
      const nearbyArea = `${placeRegion} ${placePropertyDong}`.trim();
      const params = new URLSearchParams({ taxonomy: "2", lat: String(propertyLocation.lat), lng: String(propertyLocation.lng), area: nearbyArea, sidoCode: activeRegion.code.slice(0, 2), sigunguCode: activeRegion.code, sido: activeRegion.sido, sigungu: activeRegion.sigungu, legalDong: placePropertyDong }); if (selectedBoundaryCode) params.set("boundaryCode", selectedBoundaryCode); if (selectedHCode) params.set("hCode", selectedHCode); if (selectedBCode) params.set("bCode", selectedBCode);
      fetch(`/api/nearby?${params}`, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error || data.mapFallback?.markerAllowed === false) throw new Error(data.error || "주변 시설을 불러오지 못했습니다."); return data; }).then((data) => { setNearbyPlaces(data.places || []); setNearbyStatus(data.status || ((data.places || []).length ? "success" : "empty")); if (data.status === "partial") setNearbyError("일부 시설 제공처 응답이 지연되어 확인된 결과만 표시합니다."); }).catch((reason) => { if (reason.name !== "AbortError") { setNearbyError(reason.message); setNearbyStatus("error"); } }).finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeRegion.code, activeRegion.sigungu, activeRegion.sido, propertyLocation, placeRegion, placePropertyDong, selectedBCode, selectedBoundaryCode, selectedHCode]);
  const latestQuarterTrades = scopedTrades.filter((trade) => latestQuarterMonths.includes(trade.date.slice(0, 7)));
  const activeFacilityCategory = NEARBY_CATEGORIES.find((category) => category.label === nearbyCategory); const nearbySubtypeOptions = activeFacilityCategory ? ["전체", ...activeFacilityCategory.subtypes] : [];
  const nearbyRadiusPlaces = nearbyPlaces.filter((place) => place.distance <= nearbyRadius);
  const visibleNearbyPlaces = nearbyRadiusPlaces.filter((place) => (nearbyCategory === "전체" || place.category === nearbyCategory) && (nearbySubtype === "전체" || place.subCategory === nearbySubtype));
  const fieldAreaTitle = selectedProperty?.name || (selectedDong !== "all" ? selectedDong : activeRegion.sigungu);
  const fieldCategorySummaries = NEARBY_CATEGORIES.map((category) => {
    const places = nearbyPlaces.filter((place) => place.category === category.label);
    return { ...category, count: places.length, within500m: places.filter((place) => place.distance <= 500).length, nearest: places[0] || null };
  });
  const maxFieldCategoryCount = Math.max(1, ...fieldCategorySummaries.map((category) => category.count));
  const lifestyleSubtypes: Record<string, string[]> = { "마트": ["대형마트", "슈퍼마켓", "전통시장"], "병원": ["종합병원", "병·의원", "약국", "치과"], "학교": ["유치원", "초등학교", "중학교", "고등학교"], "헬스장": ["헬스장", "체육관"], "공원": ["공원"] };
  const lifestylePlaces = nearbyPlaces.filter((place) => lifestyleSubtypes[lifestyleKeyword]?.includes(place.subCategory));
  const nearestWalkTargets = [
    { id: "station", label: "가까운 역", category: "교통", place: nearbyPlaces.find((place) => place.subCategory === "지하철역") || nearbyPlaces.find((place) => place.category === "교통") || null },
    { id: "school", label: "가까운 학교", category: "교육", place: nearbyPlaces.find((place) => ["초등학교", "중학교", "고등학교"].includes(place.subCategory)) || null },
    { id: "hospital", label: "가까운 병원", category: "의료", place: nearbyPlaces.find((place) => ["종합병원", "병·의원"].includes(place.subCategory)) || nearbyPlaces.find((place) => place.category === "의료") || null },
    { id: "grocery", label: "가까운 장보기", category: "장보기", place: nearbyPlaces.find((place) => place.category === "장보기") || null },
  ];
  const nightStation = nearbyPlaces.find((place) => place.subCategory === "지하철역") || nearbyPlaces.find((place) => place.category === "교통") || null;
  const nightConveniences = nearbyPlaces.filter((place) => place.subCategory === "편의점");
  const nightMedical = nearbyPlaces.filter((place) => ["종합병원", "병·의원", "약국"].includes(place.subCategory));
  const risingCount = propertyRows.filter((property) => property.change !== null && property.change > 0).length; const fallingCount = propertyRows.filter((property) => property.change !== null && property.change < 0).length;
  const visibleProperties = useMemo(() => propertyRows.filter((property) => property.quarterCount >= minVolume).sort((a, b) => buildingSort === "price" ? b.current - a.current : buildingSort === "rise" ? (b.change ?? -Infinity) - (a.change ?? -Infinity) : buildingSort === "fall" ? (a.change ?? Infinity) - (b.change ?? Infinity) : b.quarterCount - a.quarterCount), [propertyRows, buildingSort, minVolume]);
  const renderedProperties = visibleProperties.slice(0, propertyLimit);
  const nationalDeals = markets.reduce((sum, market) => sum + market.count, 0); const activeMarkets = markets.filter((market) => (market.medianAmountManwon ?? market.median) > 0); const nationalMedian = activeMarkets.length ? median(activeMarkets.map((market) => market.medianAmountManwon ?? market.median)) : 0; const comparableMarkets = markets.filter((market) => market.changePct !== null && market.changePct !== undefined && market.count > 0); const comparableDeals = comparableMarkets.reduce((sum, market) => sum + market.count, 0); const nationalChange = comparableDeals ? comparableMarkets.reduce((sum, market) => sum + (market.changePct ?? 0) * market.count, 0) / comparableDeals : null;
  const sidoOptions = useMemo(() => SIDO_ORDER.filter((sido) => REGIONS.some((region) => region.sido === sido)), []);
  const sigunguOptions = REGIONS.filter((region) => region.sido === activeRegion.sido).sort(sortRegions);
  const mapDistricts = useMemo(() => REGIONS.filter((region) => region.sido === selectedMapSido).sort(sortRegions), [selectedMapSido]);
  const dongOptions = useMemo(() => [...new Set(trades.map((trade) => trade.dong).filter(Boolean))].sort(), [trades]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/data/boundaries/emd/${activeRegion.code}.json`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error("동 경계를 불러오지 못했습니다."))).then((data: GeoJsonFeatureCollection) => {
      const nextDongs = data.features.map((feature) => ({ code: String(feature.properties.code || ""), name: String(feature.properties.name || "") })).filter((dong) => dong.code && dong.name);
      boundaryDongsRef.current = nextDongs;
      setBoundaryDongs(nextDongs);
      setBoundaryDongOptions(nextDongs.map((dong) => dong.name));
      const requestedBoundary = pendingBoundaryRef.current;
      const restoredBoundary = requestedBoundary ? nextDongs.find((dong) => dong.code === requestedBoundary) : undefined;
      if (restoredBoundary) {
        setSelectedBoundaryDong(restoredBoundary.name);
        setMapPickerDong(restoredBoundary.name);
        pendingBoundaryRef.current = "";
      }
    }).catch((error) => { if (error instanceof Error && error.name !== "AbortError") { boundaryDongsRef.current = []; setBoundaryDongs([]); setBoundaryDongOptions([]); } });
    return () => controller.abort();
  }, [activeRegion.code]);
  useEffect(() => {
    if (!selectedBoundaryDong || selectedDong !== "all" || !selectedBoundaryCode) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      query: `${activeRegion.sido} ${activeRegion.sigungu} ${selectedBoundaryDong} 주민센터`,
      sido: activeRegion.sido,
      sigungu: activeRegion.sigungu,
      adminDong: selectedBoundaryDong,
      sidoCode: activeRegion.code.slice(0, 2),
      sigunguCode: activeRegion.code,
      boundaryCode: selectedBoundaryCode,
    });
    fetch(`/api/geocode?${params}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok || data.error || data.validation !== "verified") throw new Error(data.error || "행정동과 법정동을 연결하지 못했습니다."); return data; })
      .then((data) => {
        const legalDongName = String(data.codes?.legalDongName || "").trim();
        if (!legalDongName) throw new Error("선택한 행정동에 대응하는 실거래 법정동을 찾지 못했습니다.");
        setSelectedHCode(data.codes?.adminDongCode || "");
        setSelectedBCode(data.codes?.legalDongCode || "");
        setSelectedDong(legalDongName);
        setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district");
      })
      .catch((reason) => { if (reason.name !== "AbortError") setBuildingsError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setBuildingsLoading(false); });
    return () => controller.abort();
  }, [activeRegion.code, activeRegion.sigungu, activeRegion.sido, selectedBoundaryCode, selectedBoundaryDong, selectedDong]);
  const mapDongChoices = boundaryDongOptions.length ? boundaryDongOptions : dongOptions;
  const finderDongOptions = useMemo(() => [...new Set([...dongOptions, ...(selectedDong === "all" ? [] : [selectedDong])].filter(Boolean))].sort(), [dongOptions, selectedDong]);
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
  const buildingCandidates = useMemo(() => propertiesRegionCode === regionCode ? selectNearbyPropertyCandidates(properties, selectedDong, 90, 24) : [], [properties, propertiesRegionCode, regionCode, selectedDong]);
  useEffect(() => {
    if (mapFocus === "buildings" && propertiesRegionCode !== regionCode) {
      const waitingTimer = window.setTimeout(() => setBuildingsLoading(true), 0);
      return () => window.clearTimeout(waitingTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (mapFocus !== "buildings" || selectedDong === "all" || !buildingCandidates.length) {
        setBuildingLocations([]); setBuildingsError(""); setBuildingStatus("empty"); setBuildingsLoading(false); return;
      }
      setBuildingsLoading(true); setBuildingsError("");
      fetch("/api/property-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sido: activeRegion.sido,
          sigungu: activeRegion.sigungu,
          dong: selectedDong,
          scope: { sidoCode: activeRegion.code.slice(0, 2), sidoName: activeRegion.sido, sigunguCode: activeRegion.code, sigunguName: activeRegion.sigungu, adminDongCode: selectedHCode || undefined, legalDongCode: selectedBCode || undefined, legalDongName: selectedDong, boundaryAdminCode: selectedBoundaryCode },
          properties: buildingCandidates.map((property) => ({ key: property.key, name: property.name, dong: property.dong, jibun: property.jibun, count: property.count, lastAmount: property.lastAmount, propertyType: type, scope: property.dong === selectedDong ? undefined : { adminDongCode: "", adminDongName: "", legalDongCode: "", legalDongName: property.dong, boundaryAdminCode: "" } })),
        }),
        signal: controller.signal,
      }).then(async (response) => { const data = await response.json(); if (!response.ok || data.error || data.mapFallback?.markerAllowed === false) throw new Error(data.error || "건물 위치를 불러오지 못했습니다."); return data; })
        .then((data) => {
          const locations = (data.locations || []).filter((location: PropertyMapLocation) => location.validation === "verified").map((location: Omit<PropertyMapLocation, "scope">) => ({ ...location, scope: location.dong === selectedDong ? "selected" as const : "nearby" as const }));
          setBuildingLocations(locations);
          setBuildingStatus(data.status || (locations.length ? "success" : "empty"));
          if (data.status === "partial") setBuildingsError(`일부 주소를 검증하지 못해 확인된 ${locations.length}개 건물만 표시합니다.`);
          if (!locations.length) setBuildingsError("선택한 동과 주변 동의 거래 건물 주소를 지도 좌표와 연결하지 못했습니다.");
        })
        .catch((reason) => { if (reason.name !== "AbortError") { setBuildingLocations([]); setBuildingsError(reason.message); setBuildingStatus("error"); } })
        .finally(() => { if (!controller.signal.aborted) setBuildingsLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeRegion.code, activeRegion.sigungu, activeRegion.sido, buildingCandidates, mapFocus, propertiesRegionCode, regionCode, selectedBCode, selectedBoundaryCode, selectedDong, selectedHCode, type]);
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
  const spaceAreaNumber = Number(spaceArea); const spaceRoomWidthNumber = Number(spaceRoomWidth); const spaceRoomDepthNumber = Number(spaceRoomDepth);
  const spaceRoomArea = spaceRoomWidthNumber > 0 && spaceRoomDepthNumber > 0 ? spaceRoomWidthNumber * spaceRoomDepthNumber / 10000 : 0;
  const spaceFurnitureLayouts = useMemo(() => spaceFurniture.flatMap((placed) => {
    const catalog = FURNITURE_CATALOG.find((item) => item.kind === placed.kind);
    if (!catalog || spaceRoomWidthNumber <= 0 || spaceRoomDepthNumber <= 0) return [];
    const width = placed.rotated ? catalog.depth : catalog.width; const depth = placed.rotated ? catalog.width : catalog.depth;
    const rawWidthPercent = width / spaceRoomWidthNumber * 100; const rawDepthPercent = depth / spaceRoomDepthNumber * 100;
    const widthPercent = Math.min(100, rawWidthPercent); const depthPercent = Math.min(100, rawDepthPercent);
    return [{ ...placed, catalog, width, depth, widthPercent, depthPercent, left: placed.x * Math.max(0, 100 - widthPercent), top: placed.y * Math.max(0, 100 - depthPercent), overflow: rawWidthPercent > 100 || rawDepthPercent > 100 }];
  }), [spaceFurniture, spaceRoomDepthNumber, spaceRoomWidthNumber]);
  const collidingSpaceFurniture = useMemo(() => {
    const ids = new Set<string>();
    spaceFurnitureLayouts.forEach((first, index) => spaceFurnitureLayouts.slice(index + 1).forEach((second) => {
      const overlaps = first.left < second.left + second.widthPercent && first.left + first.widthPercent > second.left && first.top < second.top + second.depthPercent && first.top + first.depthPercent > second.top;
      if (overlaps) { ids.add(first.id); ids.add(second.id); }
    }));
    return ids;
  }, [spaceFurnitureLayouts]);
  const selectedSpaceFurniture = spaceFurnitureLayouts.find((item) => item.id === selectedSpaceFurnitureId) || null;
  const occupiedSpaceArea = spaceFurnitureLayouts.reduce((sum, item) => sum + item.width * item.depth / 10000, 0);
  const resetPropertySelection = useCallback(() => { setSelectedKey(""); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); setPropertyLocation(null); setPropertyLimit(30); }, []);
  const chooseRegion = useCallback((region: Region, scrollToTop = true) => { historyModeRef.current = "push"; setRegionCode(region.code); setRegionInput(`${region.sido} ${region.sigungu}`); setSelectedMapSido(region.sido); setMapFocus("district"); if (region.code !== regionCode) setMapCamera(null); setSelectedHCode(""); setSelectedBCode(""); setSelectedBoundaryDong(""); setMapPickerDong(""); setSelectedDong("all"); resetPropertySelection(); setSubmittedQuery(""); setQuery(""); if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" }); }, [regionCode, resetPropertySelection]);
  const chooseMapSido = useCallback((sido: string) => {
    historyModeRef.current = "push";
    const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0];
    setSelectedMapSido(sido); setMapFocus("sido"); if (sido !== selectedMapSido) setMapCamera(null); setSelectedHCode(""); setSelectedBCode(""); setSelectedBoundaryDong(""); setMapPickerDong(""); setSelectedDong("all"); resetPropertySelection(); setSubmittedQuery(""); setQuery("");
    if (next) { setRegionCode(next.code); setRegionInput(`${next.sido} ${next.sigungu}`); }
  }, [resetPropertySelection, selectedMapSido]);
  const chooseMapRegion = useCallback((region: Region) => chooseRegion(region, false), [chooseRegion]);
  const chooseMapDong = useCallback((dong: string) => {
    historyModeRef.current = "push";
    const exactLegalDong = dongOptions.includes(dong) ? dong : "all";
    setSelectedHCode("");
    setSelectedBCode("");
    setSelectedBoundaryDong(dong);
    setMapPickerDong(dong);
    setBuildingsError("");
    setMapFocus(ROAD_MAP_AVAILABLE && exactLegalDong !== "all" ? "buildings" : "district");
    resetPropertySelection();
    setSelectedDong(exactLegalDong);
  }, [dongOptions, resetPropertySelection]);
  const openMapBuildings = useCallback(() => { if (ROAD_MAP_AVAILABLE && selectedDong !== "all") setMapFocus("buildings"); }, [selectedDong]);
  const chooseMapProperty = useCallback((key: string) => {
    historyModeRef.current = "push";
    const property = properties.find((item) => item.key === key);
    setSelectedKey(key); setSelectedBuildingDong(""); setSelectedAreaBucket(null); setSelectedVariantKey(""); setArea("all"); setMapFocus("buildings");
    if (property) {
      setQuery(property.name);
      if (property.dong !== selectedDong) {
        setSelectedDong(property.dong); setMapPickerDong(property.dong); setSelectedBoundaryDong(""); setSelectedHCode(""); setSelectedBCode("");
      }
    }
  }, [properties, selectedDong]);
  useEffect(() => {
    if (mapFocus !== "buildings" || !mapCamera || mapCamera.changedBy !== "user") return;
    const rounded = `${mapCamera.center.lat.toFixed(4)}|${mapCamera.center.lng.toFixed(4)}|${mapCamera.level}`;
    if (viewportContextRef.current === rounded) return;
    viewportContextRef.current = rounded;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ lat: String(mapCamera.center.lat), lng: String(mapCamera.center.lng) });
      fetch(`/api/map-context?${params}`, { signal: controller.signal }).then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.error || !data.sigungu?.code) throw new Error(data.error || "현재 지도 영역을 확인하지 못했습니다.");
        return data;
      }).then((data) => {
        const nextRegion = REGIONS.find((region) => region.code === data.sigungu.code);
        const nextDong = String(data.legalDong?.name || "").trim();
        if (!nextRegion || !nextDong) return;
        const regionChanged = nextRegion.code !== regionCode;
        const dongChanged = nextDong !== selectedDong;
        if (!regionChanged && !dongChanged) return;
        historyModeRef.current = "replace";
        setMapCamera((current) => current ? { ...current, contextKey: nextRegion.code, changedBy: "restore" } : current);
        setRegionCode(nextRegion.code); setSelectedMapSido(nextRegion.sido); setRegionInput(`${nextRegion.sido} ${nextRegion.sigungu}`); setSelectedDong(nextDong); setMapPickerDong(String(data.administrativeDong?.name || nextDong)); setSelectedBoundaryDong(""); setSelectedHCode(String(data.administrativeDong?.code || "")); setSelectedBCode(String(data.legalDong?.code || "")); setMapFocus("buildings"); setSubmittedQuery(""); setQuery(""); resetPropertySelection();
      }).catch((reason) => { if (reason.name !== "AbortError") viewportContextRef.current = ""; });
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mapCamera, mapFocus, regionCode, resetPropertySelection, selectedDong]);
  const openSelectedPropertyMap = useCallback(() => {
    if (!selectedProperty) return;
    historyModeRef.current = "push"; setSelectedMapSido(activeRegion.sido); setSelectedDong(selectedProperty.dong); setSelectedBoundaryDong(""); setMapPickerDong(selectedProperty.dong); setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); setActiveSection("research");
    const url = new URL(window.location.href); url.searchParams.delete("analysis"); url.searchParams.delete("feature"); window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeRegion.sido, selectedProperty]);
  const openGangnamMap = useCallback(() => { const gangnam = REGIONS.find((region) => region.code === "11680"); if (gangnam) chooseRegion(gangnam, false); }, [chooseRegion]);
  const openHaengdangMap = useCallback(() => { const seongdong = REGIONS.find((region) => region.code === "11200"); if (seongdong) { chooseRegion(seongdong, false); setSelectedBoundaryDong("행당1동"); setMapPickerDong("행당1동"); setSelectedDong("행당동"); setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); } }, [chooseRegion]);
  const selectSido = (sido: string) => { const next = REGIONS.filter((region) => region.sido === sido).sort(sortRegions)[0]; if (next) chooseRegion(next); };
  const selectSigungu = (code: string) => { const next = REGIONS.find((region) => region.code === code); if (next) chooseRegion(next); };
  const changeAnalysisMode = (mode: AnalysisMode, featureId = fieldFeatureId, scrollToTop = true) => {
    historyModeRef.current = "replace"; setActiveSection("chart"); setAnalysisMode(mode);
    const url = new URL(window.location.href);
    if (mode === "field") { url.searchParams.set("analysis", "field"); url.searchParams.set("feature", featureId); }
    else { url.searchParams.delete("analysis"); url.searchParams.delete("feature"); }
    url.hash = "chart";
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scrollToFieldContent = (target: HTMLElement | null, block: ScrollLogicalPosition = "start") => {
    if (!target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block });
  };
  const chooseFieldFeature = (featureId: string) => {
    const feature = FIELD_FEATURES.find((item) => item.id === featureId);
    if (!feature) return;
    setFieldGroup(feature.group);
    setFieldFeatureId(feature.id);
    changeAnalysisMode("field", feature.id, false);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToFieldContent(fieldWorkspaceRef.current)));
  };
  const toggleFieldMap = () => {
    const nextOpen = !showFieldMap;
    setShowFieldMap(nextOpen);
    if (nextOpen) window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToFieldContent(fieldInlineMapRef.current, "nearest")));
  };
  const changeView = (view: string) => {
    if (view === "field") { changeAnalysisMode("field"); return; }
    if (view === "chart") { changeAnalysisMode("price"); return; }
    const nextView = normalizeScreen(view);
    historyModeRef.current = "replace"; setActiveSection(nextView); const url = new URL(window.location.href); url.searchParams.delete("analysis"); url.searchParams.delete("feature"); url.hash = nextView; window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const calculateCommute = async (event: React.FormEvent) => {
    event.preventDefault();
    const destination = commuteDestination.trim();
    if (!destination || !propertyLocation) return;
    setCommuteLoading(true); setCommuteError(""); setCommuteEstimate(null);
    try {
      const response = await fetch(`/api/geocode?query=${encodeURIComponent(destination)}`);
      const data = await response.json();
      if (!response.ok || data.error || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) throw new Error(data.error || "목적지 좌표를 찾지 못했습니다.");
      const distance = straightLineDistance(propertyLocation.lat, propertyLocation.lng, data.lat, data.lng);
      const estimates = estimatedTravelMinutes(distance);
      setCommuteEstimate({ destination, address: data.roadAddress || data.jibunAddress || destination, distance, ...estimates });
    } catch (reason) {
      setCommuteError(reason instanceof Error ? reason.message : "목적지 예상시간을 계산하지 못했습니다.");
    } finally {
      setCommuteLoading(false);
    }
  };
  const handleSpacePlanUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSpacePlanError("");
    if (!file.type.startsWith("image/")) { setSpacePlanError("JPG·PNG·WEBP 평면도 이미지만 불러올 수 있습니다."); event.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { setSpacePlanError("평면도 이미지는 10MB 이하로 선택해주세요."); event.target.value = ""; return; }
    setSpacePlanUrl(URL.createObjectURL(file)); setSpacePlanName(file.name);
  };
  const removeSpacePlan = () => { setSpacePlanUrl(""); setSpacePlanName(""); setSpacePlanError(""); if (spacePlanInputRef.current) spacePlanInputRef.current.value = ""; };
  const addSpaceFurniture = (kind: FurnitureKind) => {
    if (spaceFurniture.length >= 8) return;
    const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: .5, y: .5 }];
    const position = positions[spaceFurniture.length % positions.length]; spaceFurnitureSequenceRef.current += 1; const id = `space-${spaceFurnitureSequenceRef.current}`;
    setSpaceFurniture((current) => [...current, { id, kind, x: position.x, y: position.y, rotated: false }]); setSelectedSpaceFurnitureId(id);
  };
  const moveSpaceFurniture = (x: number, y: number) => { if (selectedSpaceFurnitureId) setSpaceFurniture((current) => current.map((item) => item.id === selectedSpaceFurnitureId ? { ...item, x, y } : item)); };
  const rotateSpaceFurniture = () => { if (selectedSpaceFurnitureId) setSpaceFurniture((current) => current.map((item) => item.id === selectedSpaceFurnitureId ? { ...item, rotated: !item.rotated } : item)); };
  const removeSpaceFurniture = () => { if (selectedSpaceFurnitureId) { setSpaceFurniture((current) => current.filter((item) => item.id !== selectedSpaceFurnitureId)); setSelectedSpaceFurnitureId(""); } };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const exactRegion = REGIONS.find((item) => `${item.sido} ${item.sigungu}` === regionInput); if (exactRegion) setRegionCode(exactRegion.code); const nextQuery = query.trim(); setSubmittedQuery(nextQuery); changeView("chart"); };
  const submitAnalysisSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const rawInput = analysisAddressInput.trim();
    const selectedLocation = `${activeRegion.sido} ${activeRegion.sigungu}${selectedDong !== "all" ? ` ${selectedDong}` : ""}`;
    const nextQuery = selectedProperty && rawInput.includes(selectedProperty.name) ? selectedProperty.name : rawInput === selectedLocation ? "" : rawInput;
    setQuery(nextQuery); setSubmittedQuery(nextQuery); setPropertyLimit(30); setAnalysisMode("price");
  };
  const selectCandidate = (candidate: { propertyKey: string; buildingDong: string; areaBucket: number; key: string }) => { setSelectedKey(candidate.propertyKey); setSelectedBuildingDong(candidate.buildingDong); setSelectedAreaBucket(candidate.areaBucket); setSelectedVariantKey(candidate.key); setArea("all"); changeView("chart"); };
  const toggleSavedHome = () => { if (!selectedOpportunity) return; const id = `${regionCode}|${selectedOpportunity.key}`; const next = isSaved ? savedHomes.filter((home) => home.id !== id) : [...savedHomes, { id, name: selectedOpportunity.name, region: `${activeRegion.sido} ${activeRegion.sigungu}`, area: selectedOpportunity.areaBucket, price: selectedOpportunity.current, score: selectedOpportunity.score, savedAt: new Date().toISOString() }].slice(-6); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } };
  const researchMetric = (row: typeof researchRows[number]) => researchTool === "record-high" ? formatPrice(row.current) : researchTool === "price-compare" ? `${row.gap >= 0 ? "+" : ""}${row.gap.toFixed(1)}%` : researchTool === "multi-compare" ? `${row.score}점` : researchTool === "most-bought" || researchTool === "volume" ? `${row.quarterCount}건` : `${(row.change ?? 0) >= 0 ? "+" : ""}${(row.change ?? 0).toFixed(1)}%`;
  const saveStudyDraft = (event: React.FormEvent) => { event.preventDefault(); if (!studyTitle.trim() || !studyBody.trim()) return; try { window.localStorage.setItem("jipgaps:study-draft", JSON.stringify({ category: activeCommunityCategory.label, board: communityBoard === "전체" ? activeCommunityCategory.boards[1] : communityBoard, title: studyTitle.trim(), body: studyBody.trim(), savedAt: new Date().toISOString() })); setDraftSaved(true); } catch { setDraftSaved(false); } };
  const mapLocationTitle = mapFocus === "national" ? "대한민국 전체" : mapFocus === "sido" ? selectedMapSido : `${activeRegion.sido} › ${activeRegion.sigungu}${selectedDong !== "all" ? ` › ${selectedDong}` : ""}`;
  const mapLocationDescription = mapFocus === "national" ? "전국 16개 시·도의 최근 3개월 시장 흐름" : mapFocus === "sido" ? `${selectedMapSido} 시·군·구 선택 단계` : `${PROPERTY_TYPES.find((item) => item.key === type)?.label} · 최근 3개월 실거래 기준`;
  const visibleBuildingDongs = [...new Set(buildingLocations.map((building) => building.dong))];
  const selectedMapMarket = markets.find((market) => market.sido === selectedMapSido);
  const selectedMapDongStat = selectedDong !== "all" ? mapDongStats[selectedDong] : undefined;
  const mapBuildingRows = useMemo(() => [...buildingLocations].sort((a, b) => Number(b.scope === "selected") - Number(a.scope === "selected") || b.count - a.count || b.lastAmount - a.lastAmount), [buildingLocations]);
  const selectedMapProperty = mapBuildingRows.find((building) => building.key === selectedKey) || null;
  const selectedMapBuildingCount = mapBuildingRows.filter((building) => building.scope === "selected").length;
  const nearbyMapBuildingCount = mapBuildingRows.length - selectedMapBuildingCount;
  const mapBuildingMedian = mapBuildingRows.length ? median(mapBuildingRows.map((building) => building.lastAmount).filter(Boolean)) : 0;

  return <main className="terminal-shell" data-view={activeSection} data-analysis-mode={analysisMode}>
    {/* impeccable-direction
      SEED: b0733d84
      THESIS: 지역 탐색을 지도 위의 선택과 우측 의사결정 기록이 맞물리는 하나의 작업대로 만든다. 카드 모음형 부동산 포털 구성을 거부한다.
      OWN-WORLD: 따뜻한 회백색 캔버스, 종이처럼 선명한 흰 작업면, 잉크 남청색 인스펙터, 행동 블루와 검증 민트.
      STORY: 위치를 고르고, 주변 맥락을 읽고, 같은 조건의 가격과 생활 근거를 검토한다.
      FIRST VIEWPORT: 얇은 상단 내비게이션, 한 줄 지역 명령 바, 넓은 지도와 짙은 선택 인스펙터. 첫 행동은 지역 선택이다.
      FORM: metropolitan transfer map + property dossier, grounded direction 5.
      FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
    */}
    <header className="topbar">
      <a href="#home" className="brand" onClick={(event) => { event.preventDefault(); changeView("home"); }}><span>집값</span>의 정석</a>
      <nav ref={navRef}>{NAV_ITEMS.map((item) => <a key={item.id} data-view={item.id} aria-label={item.label} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>{item.label}</a>)}<i className="nav-indicator" style={{ left: navIndicator.left, width: navIndicator.width }} /></nav>
      <div className="theme-switcher" role="group" aria-label="화면 테마">
        {THEME_OPTIONS.map((option) => { const Icon = option.icon; return <button type="button" key={option.key} className={themePreference === option.key ? "active" : ""} aria-pressed={themePreference === option.key} title={option.label} onClick={() => chooseThemePreference(option.key)}><Icon size={14} strokeWidth={1.9} aria-hidden="true" /><span>{option.label}</span></button>; })}
      </div>
      <button className="saved-badge" onClick={() => changeView("chart")}>관심 후보 <b>{savedHomes.length}</b></button><div className="live"><i /> 실거래 연동</div>
    </header>
    {!online && <div className="offline-state" role="status"><b>오프라인 상태입니다.</b><span>기존 화면은 볼 수 있지만 실거래와 지도 데이터는 연결 후 갱신됩니다.</span></div>}
    <nav className="mobile-primary-nav" aria-label="주요 화면">{NAV_ITEMS.map((item) => <a key={item.id} aria-label={item.label} aria-current={activeSection === item.id ? "page" : undefined} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); changeView(item.id); }}>{item.mobileLabel}</a>)}</nav>
    {activeSection !== "home" && activeSection !== "chart" && <div className="screen-context"><div><span>{NAV_ITEMS.find((item) => item.id === activeSection)?.label}</span><b>{activeRegion.sido} · {activeRegion.sigungu}{selectedDong !== "all" ? ` · ${selectedDong}` : ""}{selectedProperty ? ` · ${selectedProperty.name}` : ""}</b></div><div className="screen-context-actions" aria-label="지역과 건물 선택"><button type="button" className={activeSection === "research" ? "active" : ""} aria-pressed={activeSection === "research"} onClick={() => changeView("research")}><MapPin size={15} strokeWidth={1.9} aria-hidden="true" />지도·리서치</button><button type="button" aria-pressed="false" onClick={() => changeView("chart")}><Building2 size={15} strokeWidth={1.9} aria-hidden="true" />상세 분석</button></div></div>}
    <section className="command app-view view-home" id="top">
      <div className="hero-copy"><div><h1>사는 집도, 투자하는 집도<br/><span>숫자로 먼저 고르세요.</span></h1><b>전국 실거래를 최근 3개월 단위로 비교하고, 면적별 가격과 거래 흐름까지 한 번에 확인합니다.</b></div><div className="hero-proof"><span><i>01</i>실거래 원문 기반</span><span><i>02</i>동·면적 단위 비교</span><span><i>03</i>판단 근거 공개</span></div></div>
      <div className="finder-panel"><div className="finder-title"><div><span>어느 지역을 살펴볼까요?</span><b>지역과 주택 유형을 고르면 최근 실거래와 생활 정보를 확인할 수 있습니다.</b></div><small>최근 3개월 기준</small></div><div className="type-tabs">{PROPERTY_TYPES.map((item) => <button key={item.key} className={type === item.key ? "active" : ""} onClick={() => { setType(item.key); setSelectedKey(""); setSelectedVariantKey(""); }}>{item.label}</button>)}</div>
      <form className="search-console" onSubmit={submitSearch}>
        <label><span>시·도</span><select value={activeRegion.sido} onChange={(event) => selectSido(event.target.value)} aria-label="시도 선택">{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={regionCode} onChange={(event) => selectSigungu(event.target.value)} aria-label="시군구 선택">{sigunguOptions.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={selectedDong} onChange={(event) => { const dong = event.target.value; setSelectedHCode(""); setSelectedBCode(""); setSelectedDong(dong); setSelectedBoundaryDong(""); resetPropertySelection(); if (dong !== "all") setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); }} aria-label="읍면동 선택"><option value="all">전체 읍·면·동</option>{finderDongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}</select></label>
        <label className="property-search"><span>단지·건물명 · 비워두면 전체</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 행당대림, 서울숲리버뷰" aria-label="단지 또는 건물명" /></label>
        <button type="submit">실거래 확인 <b aria-hidden="true">→</b></button>
      </form>
      </div>
    </section>

    <section className="national-overview" id="national"><div><h1>{overviewFeedback.scopeLabel} 최근 3개월 요약</h1><span>대표 권역 표본의 최근 3개월과 직전 3개월 가격 방향을 비교합니다.</span>{overviewFeedback.status === "partial" && <small role="status">일부 지역 수집이 지연되어 확인된 표본만 표시합니다.</small>}</div><article><span>최근 3개월 표본 거래</span><strong>{markets.length ? nationalDeals.toLocaleString() : marketError ? "확인 필요" : "집계 중"}{markets.length > 0 && <em>건</em>}</strong><small>{markets.length ? `${marketMonth} 기준 · ${overviewFeedback.scopeLabel}` : marketError ? "대표 지역 실거래 연결 상태를 확인해주세요." : "공공데이터 확인 중"}</small></article><article><span>표본 중위가격</span><strong>{activeMarkets.length ? formatPrice(nationalMedian) : "표본 부족"}</strong><small>{overviewFeedback.scopeLabel} 중 거래 표본이 있는 권역</small></article><article><span>직전 3개월 대비</span><strong className={nationalChange === null ? "" : nationalChange >= 0 ? "up" : "down"}>{nationalChange === null ? "표본 부족" : `${nationalChange >= 0 ? "+" : ""}${nationalChange.toFixed(2)}%`}</strong><small>비교 가능한 권역의 거래량 가중 변화율</small></article><a href="#research" onClick={(event) => { event.preventDefault(); changeView("research"); }}>지도·리서치 보기 →</a></section>

    <section className="monthly-board" id="market">
      <div className="month-intro"><h1>{activeRegion.sigungu} 최근 3개월</h1><span>{latestMonth ? `${PROPERTY_TYPES.find((item) => item.key === type)?.label} 실거래 신고 기준 · ${latestQuarterMonths[2]} ~ ${latestQuarterMonths[0]}` : `${PROPERTY_TYPES.find((item) => item.key === type)?.label} 실거래 연결 후 조회 기간을 표시합니다.`}</span></div>
      <article><span>최근 3개월 거래</span><strong>{error ? "-" : latestQuarterTrades.length.toLocaleString()}{!error && <em>건</em>}</strong><small>{error ? "실거래 연결 확인 필요" : dataFeedback.status === "partial" ? `일부 수집 · 확인된 전체 ${trades.length.toLocaleString()}건` : `전체 ${trades.length.toLocaleString()}건 조회`}</small></article>
      <article><span>거래 건물</span><strong>{error ? "-" : new Set(latestQuarterTrades.map((trade) => trade.propertyKey)).size.toLocaleString()}{!error && <em>곳</em>}</strong><small>{error ? "실거래 연결 확인 필요" : "최근 3개월 거래 건물"}</small></article>
      <article><span>상승 / 하락</span><strong className="split">{error ? "-" : <><b>{risingCount}</b><i>/</i><em>{fallingCount}</em></>}</strong><small>{error ? "실거래 연결 확인 필요" : "최근 3개월과 직전 3개월 비교"}</small></article>
      <article><span>최근 3개월 중위가격</span><strong>{error ? "-" : latestQuarterTrades.length ? formatPrice(median(latestQuarterTrades.map((trade) => trade.amount))) : "거래 없음"}</strong><small>{error ? "실거래 연결 확인 필요" : latestQuarterTrades.length ? "극단값 영향을 줄인 대표값" : "과거 거래를 최근 가격으로 대체하지 않습니다"}</small></article>
    </section>

    {SHOW_OPPORTUNITY_SECTION && <section className="opportunity-section" aria-label="매수 검토 후보"><div className="opportunity-head"><div><p>검토 후보</p><h2>{activeRegion.sigungu}에서 먼저 볼 후보</h2><span>면적별 가격 45% · 거래량 35% · 가격 흐름 20%를 합산한 탐색 점수입니다.</span></div><b>추천이 아닌 검토 우선순위</b></div><div className="opportunity-grid">{loading ? <div className="opportunity-empty">후보를 계산하고 있습니다…</div> : scoredCandidates.length ? scoredCandidates.slice(0, 3).map((candidate, index) => <button key={candidate.key} onClick={() => selectCandidate(candidate)}><span className="candidate-rank">0{index + 1}</span><div><em>{candidate.tag}</em><h3>{candidate.name}</h3><p>{candidate.dong} · {dongLabel(candidate.buildingDong) || "동 정보 없음"} · 전용 {candidate.areaBucket}평</p></div><strong>{candidate.score}<small>/100</small><i>{formatPrice(candidate.current)}</i></strong></button>) : <div className="opportunity-empty"><b>이 지역은 아직 표본이 부족합니다.</b><span>아파트 또는 거래가 활발한 지역을 선택하면 검토할 후보를 확인할 수 있습니다.</span></div>}</div>{savedHomes.length > 0 && <div className="saved-shelf"><span>내 관심 후보</span>{savedHomes.map((home) => <article key={home.id}><div><b>{home.name}</b><small>{home.region} · {home.area}평</small></div><strong>{home.score}점 · {formatPrice(home.price)}</strong><button aria-label={`${home.name} 관심 후보에서 삭제`} onClick={() => { const next = savedHomes.filter((item) => item.id !== home.id); setSavedHomes(next); try { window.localStorage.setItem("jipgaps:saved-homes", JSON.stringify(next)); } catch { /* device storage is optional */ } }}>×</button></article>)}</div>}</section>}

    <section className="analysis-command" id="chart" aria-labelledby="analysis-command-title">
      <div className="analysis-command-head"><div><h1 id="analysis-command-title">주소로 검색</h1><p>지역이나 단지·건물명을 검색하세요.</p></div><button type="button" className="map-jump" onClick={() => { if (analysisMode === "field") { setAnalysisMode("price"); window.requestAnimationFrame(() => facilityPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); return; } setAnalysisMode("field"); window.requestAnimationFrame(() => fieldSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>{analysisMode === "field" ? <Building2 size={17} strokeWidth={1.9} aria-hidden="true" /> : <MapPin size={17} strokeWidth={1.9} aria-hidden="true" />}{analysisMode === "field" ? "가격·생활 보기" : "지도에서 선택"}</button></div>
      <form className="analysis-search-console" onSubmit={submitAnalysisSearch}>
        <label><span>시·도</span><select value={activeRegion.sido} onChange={(event) => selectSido(event.target.value)} aria-label="상세 분석 시도 선택">{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={regionCode} onChange={(event) => selectSigungu(event.target.value)} aria-label="상세 분석 시군구 선택">{sigunguOptions.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={selectedDong} onChange={(event) => { const dong = event.target.value; setSelectedHCode(""); setSelectedBCode(""); setSelectedDong(dong); setSelectedBoundaryDong(""); resetPropertySelection(); if (dong !== "all") setMapFocus(ROAD_MAP_AVAILABLE ? "buildings" : "district"); }} aria-label="상세 분석 읍면동 선택"><option value="all">전체 읍·면·동</option>{finderDongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}</select></label>
        <label className="analysis-address-search"><span>주소·단지·건물명</span><input value={analysisAddressInput} onChange={(event) => setAnalysisAddressInput(event.target.value)} placeholder="예: 서울특별시 강남구 청담동, 은마아파트" aria-label="주소 또는 단지 건물명 검색" /></label>
        <button type="submit"><Search size={17} strokeWidth={2} aria-hidden="true" />검색</button>
      </form>
    </section>

    <section className="market-browser" id="price-analysis">
      <aside className="watchlist">
        <div className="watch-head"><div><h2>{activeRegion.sigungu} 동·평형별 최근 3개월 순위</h2></div><span>{Math.min(propertyLimit, visibleProperties.length)}/{visibleProperties.length}</span></div>
        <div className="watch-filters"><select value={buildingSort} onChange={(event) => { setBuildingSort(event.target.value as typeof buildingSort); setPropertyLimit(30); }} aria-label="건물 목록 정렬"><option value="volume">3개월 거래량순</option><option value="price">3개월 중위가순</option><option value="rise">직전 분기 대비 상승순</option><option value="fall">직전 분기 대비 하락순</option></select><select value={minVolume} onChange={(event) => { setMinVolume(Number(event.target.value)); setPropertyLimit(30); }} aria-label="최소 거래량"><option value="0">거래량 전체</option><option value="1">3개월 1건 이상</option><option value="3">3개월 3건 이상</option><option value="5">3개월 5건 이상</option></select></div>
        <div className="watch-columns"><span>건물 / 단지</span><span>최근가</span></div>
        {loading ? <div className="watch-state">전체 실거래 목록을 불러오는 중…</div> : error ? <div className="watch-state error"><b>실거래 목록을 불러오지 못했습니다.</b><span>{error}</span><button type="button" onClick={() => setDataRetry((value) => value + 1)}>다시 불러오기</button></div> : visibleProperties.length ? <div className="watch-scroll">{renderedProperties.map((property) => <button key={property.key} className={selectedVariantKey === property.key ? "selected" : ""} onClick={() => { setSelectedKey(property.propertyKey); setSelectedBuildingDong(property.buildingDong); setSelectedAreaBucket(property.areaBucket); setSelectedVariantKey(property.key); setArea("all"); }}>
          <AnalysisPropertyTypeIcon type={type} priceBucket={researchPriceBuckets(property.current)} selected={selectedVariantKey === property.key} size="sm" /><div><b>{property.name}</b><small>{property.dong} · {dongLabel(property.buildingDong) || "동 정보 없음"} · 전용 {property.areaBucket}평 ({property.areaMedian.toFixed(1)}㎡)</small></div><strong>{formatPrice(property.current)}{property.change === null ? <em className="sample-low">표본 부족 · 3개월 {property.quarterCount}건</em> : <em className={property.change >= 0 ? "up" : "down"}>{property.change >= 0 ? "+" : ""}{property.change.toFixed(1)}% · 3개월 {property.quarterCount}건</em>}</strong>
        </button>)}{renderedProperties.length < visibleProperties.length && <button type="button" className="watch-more" onClick={() => setPropertyLimit((value) => value + 30)}><b>30개 더 보기</b><span>{renderedProperties.length.toLocaleString()}개 표시 중 · 전체 {visibleProperties.length.toLocaleString()}개</span></button>}</div> : <div className="watch-state">이 조건의 신고 거래가 없습니다.<button onClick={() => { setQuery(""); setSubmittedQuery(""); setPropertyLimit(30); }}>전체 목록 보기</button></div>}
      </aside>

      <div className="detail-terminal">
        <div className="ticker-head"><div><p>{PROPERTY_TYPES.find((item) => item.key === type)?.label} / {activeRegion.sido} {activeRegion.sigungu}</p><h1>{displayName}</h1><span>{selectedProperty ? `${selectedProperty.dong} ${selectedProperty.jibun || "주소 일부 비공개"} · 같은 동·전용평형만 비교` : `목록에서 동·평형을 선택하거나 ${activeRegion.sigungu} 전체 흐름을 확인하세요`}</span></div><div className="ticker-price"><strong>{formatPrice(latest)}</strong>{chartChangeComparable ? <em className={change >= 0 ? "up" : "down"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</em> : <em className="sample-low">표본 부족</em>}<small>{unit === "py" ? "만원/평" : "월 중위가격"}</small>{selectedOpportunity && <button className={isSaved ? "saved" : ""} onClick={toggleSavedHome}>{isSaved ? "★ 관심 후보 저장됨" : "☆ 관심 후보에 담기"}</button>}</div></div>
        {selectedProperty && <section className={`price-location-panel${showPriceLocationMap ? " open" : ""}`} aria-label={`${selectedProperty.name} 위치`}>
          <header><div><MapPin size={19} strokeWidth={1.9} aria-hidden="true" /><span><small>건물 위치</small><b>{placeRegion} {selectedProperty.dong} {selectedProperty.jibun || "지번 확인 중"}</b><em>{propertyLocation ? propertyLocation.roadAddress || propertyLocation.jibunAddress || "좌표 확인 완료" : locationLoading ? "정확한 좌표를 확인하고 있습니다." : locationError || "지도 위치를 확인해보세요."}</em></span></div><div><button type="button" aria-expanded={showPriceLocationMap} onClick={() => setShowPriceLocationMap((value) => !value)}>{showPriceLocationMap ? "지도 접기" : "위치 지도 보기"}</button><button type="button" className="primary" onClick={openSelectedPropertyMap}>주변 건물 지도</button></div></header>
          {showPriceLocationMap && <div className="price-location-map">{locationLoading ? <div className="price-location-state"><i />건물 좌표를 확인하고 있습니다.</div> : propertyLocation ? <KakaoPlaceMap location={propertyLocation} title={selectedProperty.name} places={[]} radius={300} active={activeSection === "chart"} /> : <div className="price-location-state error" role="status"><b>건물 위치를 표시하지 못했습니다.</b><span>{locationError || `${placeAddressQuery} 주소의 좌표를 찾지 못했습니다.`}</span><button type="button" onClick={openSelectedPropertyMap}>동 단위 지도에서 찾기</button></div>}</div>}
        </section>}
        <div className="stat-strip"><article><span>최근 월 중위가</span><strong>{formatPrice(latest)}</strong></article><article><span>기간 최고 / 최저</span><strong>{compactPrice(high)} <em>/</em> {compactPrice(low)}</strong></article><article><span>실거래 건수</span><strong>{filteredTrades.length.toLocaleString()}<em>건</em></strong></article><article><span>시장 신호</span><strong className={!chartChangeComparable ? "" : change >= 0 ? "up" : "down"}>{!chartChangeComparable ? "표본 부족" : change > 2 ? "매수 우위" : change < -2 ? "조정 구간" : "보합 구간"}</strong></article></div>
        <section className="watch-chart" aria-label={`${displayName} 가격 차트`}>
          <div className="chart-toolbar"><div className="period-switch">{PERIODS.map((item) => <button key={item.value} className={period === item.value ? "active" : ""} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div><div className="view-switch"><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="전용면적 선택"><option value="all">전체 면적</option>{areas.map((value) => <option key={value} value={value}>전용 {value}㎡ ({(value / 3.305785).toFixed(1)}평)</option>)}</select><button className={unit === "price" ? "active" : ""} onClick={() => setUnit("price")}>실거래가</button><button className={unit === "py" ? "active" : ""} onClick={() => setUnit("py")}>평당가</button></div></div>
          <article className="chart-card"><div className="chart-legend"><span><i className="price-dot" />월 중위가격</span><span><i className="ma-dot" />3개월 이동중위</span><span><i className="volume-dot" />거래량</span></div><div className={`canvas-wrap${error ? " has-error" : ""}`}>{loading ? <div className="state"><i /> 실거래 데이터를 불러오는 중입니다</div> : error ? <div className="state error"><b>실거래 데이터를 불러오지 못했습니다.</b><span>{error}</span><button type="button" onClick={() => setDataRetry((value) => value + 1)}>다시 불러오기</button></div> : chartPoints.length ? <PriceChart points={chartPoints} unit={unit} theme={resolvedTheme} /> : <div className="state"><b>선택 조건의 거래가 없습니다</b><span>위 목록에서 다른 건물을 선택하거나 전체 면적을 선택하세요.</span></div>}</div></article>
        </section>
        <section className="valuation-panel">
          {selectedKey && targetTrade && peerPyeongPrice ? <>
            <div className="valuation-score"><p>면적 보정 가격</p><strong>{valuationScore}<em>/100</em></strong><span className={valuationGap <= -5 ? "value-low" : valuationGap >= 5 ? "value-high" : "value-fair"}>{valuationLabel}</span></div>
            <div className="valuation-body">
              <div className="valuation-metrics"><article><span>선택 단지 평당가</span><strong>{formatPrice(subjectPyeongPrice)}<em>/평</em></strong></article><article><span>유사 면적 지역 중위</span><strong>{formatPrice(peerPyeongPrice)}<em>/평</em></strong></article><article><span>추정 적정가격</span><strong>{formatPrice(fairPrice)}</strong><small>{targetArea.toFixed(1)}㎡ · 적정 범위 {formatPrice(fairPrice * .95)}~{formatPrice(fairPrice * 1.05)}</small></article><article><span>지역 대비 가격차</span><strong className={valuationGap <= -5 ? "down" : valuationGap >= 5 ? "up" : ""}>{valuationGap >= 0 ? "+" : ""}{valuationGap.toFixed(1)}%</strong><small>비교 거래 {peerRows.length}건</small></article></div>
              <div className="valuation-gauge"><div><span>저평가</span><span>적정</span><span>고평가</span></div><i style={{ left: `${Math.max(2, Math.min(98, 50 + valuationGap))}%` }} /></div>
              <p>같은 선택 지역에서 전용면적 ±15%인 실거래의 평당가 중위와 비교한 참고 지표입니다. 감정평가나 매수 권유가 아니며 층·향·수리 상태는 반영되지 않습니다.</p>
            </div>
          </> : <div className="valuation-empty"><p>면적 보정 가격</p><strong>선택한 집의 가격은 어느 구간일까요?</strong><span>왼쪽에서 집 후보를 선택하면 같은 지역의 유사 면적 거래와 비교해 상대적인 가격 구간을 보여드립니다.</span></div>}
        </section>
        <section ref={facilityPanelRef} className="facility-panel">
          <header><div><h2>{selectedProperty ? `${selectedProperty.name}에서 어떤 생활을 누릴 수 있을까?` : "집 하나를 고르면 주변 생활권이 자동으로 열립니다"}</h2><span>{selectedProperty ? `${placeRegion} ${placePropertyDong} · 7개 생활 영역과 영화관·공연장·학교·병원 등 28개 세부 유형` : "왼쪽 목록에서 집을 선택하면 별도 검색 없이 주변 시설과 거리를 계산합니다."}</span></div></header>
          <nav className="field-result-tabs facility-result-tabs" aria-label="선택 건물 생활 정보">{[
            { id: "all", label: "생활권 전체", feature: "region", category: "전체", icon: Landmark },
            { id: "walk", label: "생활 동선", feature: "walk", category: "전체", icon: MapPin },
            { id: "transport", label: "교통", feature: "region", category: "교통", icon: TrainFront },
            { id: "education", label: "교육", feature: "region", category: "교육", icon: GraduationCap },
            { id: "medical", label: "의료", feature: "region", category: "의료", icon: HeartPulse },
            { id: "shopping", label: "장보기", feature: "region", category: "장보기", icon: ShoppingBasket },
            { id: "leisure", label: "문화·여가", feature: "region", category: "문화·여가", icon: Film },
            { id: "exercise", label: "운동", feature: "region", category: "운동", icon: Dumbbell },
            { id: "daily", label: "생활", feature: "region", category: "생활", icon: Store },
          ].map((tab) => { const TabIcon = tab.icon; const activeTab = tab.feature === "walk" ? fieldFeatureId === "walk" && analysisMode === "field" : analysisMode === "price" && nearbyCategory === tab.category; const count = tab.category === "전체" ? nearbyRadiusPlaces.length : nearbyRadiusPlaces.filter((place) => place.category === tab.category).length; return <button type="button" key={tab.id} className={activeTab ? "active" : ""} aria-pressed={activeTab} disabled={!selectedProperty} onClick={() => { if (tab.feature === "walk") { chooseFieldFeature("walk"); return; } setAnalysisMode("price"); setFieldGroup("입지·동선"); setFieldFeatureId("region"); setNearbyCategory(tab.category); setNearbySubtype("전체"); }}><TabIcon size={18} strokeWidth={1.8} aria-hidden="true" /><span><b>{tab.label}</b><small>{selectedProperty ? `${count}곳 확인` : "건물 선택 후 사용"}</small></span></button>; })}</nav>
          {selectedProperty ? <>
            <div className="facility-radius-control">
              <div className="facility-radius-value"><span>탐색 반경</span><b>{nearbyRadius.toLocaleString()}m</b><small>선택 단지 중심 직선거리</small></div>
              <label>
                <span className="sr-only">생활시설 탐색 반경</span>
                <input type="range" min="100" max="1000" step="100" value={nearbyRadius} style={{ "--radius-progress": `${((nearbyRadius - 100) / 900) * 100}%` } as React.CSSProperties} onChange={(event) => setNearbyRadius(Number(event.target.value))} aria-valuetext={`${nearbyRadius.toLocaleString()}미터`} />
                <span className="facility-radius-scale"><i>100m</i><i>500m</i><i>1,000m</i></span>
              </label>
              <div className="facility-radius-result"><b>{nearbyRadiusPlaces.length}<small>곳</small></b><span>선택 반경 내 시설</span></div>
            </div>
            <div className="facility-layout">
            <div className="facility-map">{locationLoading ? <div className="facility-state"><i />단지 좌표를 확인하고 있습니다.</div> : propertyLocation ? <><KakaoPlaceMap location={propertyLocation} title={selectedProperty.name} places={visibleNearbyPlaces} radius={nearbyRadius} active={activeSection === "chart"} /><span className="facility-address">{propertyLocation.roadAddress || propertyLocation.jibunAddress || placeAddressQuery}</span><div className="radius-key"><span><i />{nearbyRadius.toLocaleString()}m 생활권</span></div></> : <div className="facility-state error"><b>지도 위치를 표시하지 못했습니다.</b><span>{locationError || "선택 지역과 일치하는 주소 좌표가 없습니다."}</span></div>}</div>
            <div className="nearby-browser">
              {nearbyStatus === "partial" && <div className="nearby-state" role="status"><b>일부 시설만 확인됐습니다.</b><span>외부 지도 응답이 지연되어 검증된 결과만 표시합니다.</span></div>}
              {activeFacilityCategory && <div className="nearby-subtype-tabs" aria-label={`${activeFacilityCategory.label} 세부 유형`}>{nearbySubtypeOptions.map((subtype) => <button key={subtype} className={nearbySubtype === subtype ? "active" : ""} aria-pressed={nearbySubtype === subtype} onClick={() => setNearbySubtype(subtype)}><FacilityIcon name={subtype === "전체" ? activeFacilityCategory.label : subtype} size={14} /><span>{subtype === "전체" ? `${activeFacilityCategory.label} 전체` : subtype}</span><small>{subtype === "전체" ? nearbyRadiusPlaces.filter((place) => place.category === nearbyCategory).length : nearbyRadiusPlaces.filter((place) => place.category === nearbyCategory && place.subCategory === subtype).length}</small></button>)}</div>}
              {nearbyLoading ? <div className="nearby-state"><i />1km 안 생활시설을 세부 유형별로 찾고 있습니다.</div> : nearbyError ? <div className="nearby-state error"><b>주변 시설을 불러오지 못했습니다.</b><span>{nearbyError}</span></div> : visibleNearbyPlaces.length ? <div className="nearby-list">{visibleNearbyPlaces.map((place) => { const meta = NEARBY_CATEGORIES.find((item) => item.label === place.category); return <article key={place.id} style={{ "--facility-color": meta?.color || "#526173" } as React.CSSProperties}><i className="nearby-place-icon"><FacilityIcon name={place.subCategory || place.category} size={17} /></i><div><em>{place.subCategory || place.category}</em><b>{place.name}</b><span>{place.category} · 선택 반경 안</span></div><strong>{place.distance.toLocaleString()}m<small>직선거리</small></strong><p>도보 약 {place.walkingMinutes}분<small>경로 보정 추정</small></p></article>; })}</div> : <div className="nearby-state"><b>{nearbySubtype === "전체" ? `${nearbyRadius.toLocaleString()}m 안에 등록된 시설이 없습니다.` : `${nearbyRadius.toLocaleString()}m 안에 확인된 ${nearbySubtype}이 없습니다.`}</b><span>반경을 넓히거나 다른 세부 유형을 함께 비교해보세요.</span></div>}
            </div>
          </div></> : <div className="facility-empty"><span>01</span><b>단지 선택</b><i>→</i><span>02</span><b>정확한 주소 좌표 확인</b><i>→</i><span>03</span><b>주변 생활시설 비교</b></div>}
          <p className="facility-note">7개 생활 영역을 영화관·공연장·공원·학교·병원·마트 등 28개 유형으로 나눈 결과입니다. 거리는 직선거리이며, 도보 시간은 경로 굴곡을 20% 반영한 참고값으로 실제 길찾기와 다를 수 있습니다.</p>
        </section>
      </div>
    </section>

    <section className="field-intelligence" id="field">
      <div ref={fieldSelectorRef} className="field-property-selector unified-map-picker" aria-label="상세 분석 지도 선택">
        <div className="field-selector-layout">
          <KakaoMarketMap markets={markets} focus={mapFocus} active={activeSection === "chart"} propertyType={type} selectedSido={selectedMapSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} dongStats={mapDongStats} dongMetric={dongMetric} onDongMetricChange={setDongMetric} buildingLocations={buildingLocations} buildingsLoading={buildingsLoading} buildingsError={buildingsError} selectedPropertyKey={selectedKey} camera={mapCamera} onCameraChange={setMapCamera} onSelectSido={chooseMapSido} onSelectRegion={chooseMapRegion} onSelectDong={chooseMapDong} onOpenBuildings={openMapBuildings} onSelectProperty={(key) => { chooseMapProperty(key); setFieldGroup("입지·동선"); setFieldFeatureId("region"); setNearbyCategory("전체"); setNearbySubtype("전체"); }} />
          <aside className="field-building-picker" aria-label="임장할 건물 선택"><header><span>{mapFocus === "buildings" ? "지도에 표시된 건물" : "선택 안내"}</span><b>{selectedDong === "all" ? `${activeRegion.sigungu}에서 동을 선택하세요` : `${selectedDong}과 주변 동`}</b><small>{mapFocus === "buildings" ? "건물을 바꿔 눌러도 다른 아이콘과 목록은 유지됩니다." : "지도 경계를 누르면 실제 건물 단계로 이동합니다."}</small></header>{mapFocus === "buildings" ? <div>{buildingsLoading ? <p className="field-building-state">건물 좌표를 확인하고 있습니다.</p> : mapBuildingRows.length ? mapBuildingRows.slice(0, 10).map((building) => { const activeBuilding = building.key === selectedKey; return <button type="button" key={building.key} className={activeBuilding ? "active" : ""} aria-pressed={activeBuilding} onClick={() => { chooseMapProperty(building.key); setFieldGroup("입지·동선"); setFieldFeatureId("region"); setNearbyCategory("전체"); setNearbySubtype("전체"); }}><PropertyTypeIcon type={building.propertyType} /><span><b>{building.name}</b><small>{building.dong} · {PROPERTY_MAP_META[building.propertyType].short}</small></span><strong>{activeBuilding ? formatPrice(building.lastAmount) : "선택"}</strong></button>; }) : <p className="field-building-state">{buildingsError || "좌표가 확인된 거래 건물이 없습니다."}</p>}</div> : <ol><li><span>1</span><p><b>동 경계 선택</b><small>강남구 지도에서 삼성동·대치동처럼 원하는 동을 누릅니다.</small></p></li><li><span>2</span><p><b>건물 아이콘 선택</b><small>아파트·오피스텔 등 유형 아이콘에서 임장할 건물을 고릅니다.</small></p></li><li><span>3</span><p><b>생활 정보 확인</b><small>동선·교육·의료·장보기 탭으로 바로 비교합니다.</small></p></li></ol>}</aside>
        </div>
      </div>
      <FieldScorePreview />
      <div className="field-quick-tools" aria-label="온라인 임장 바로가기"><span>바로가기</span><button type="button" className={fieldFeatureId === "space" ? "active" : ""} onClick={() => chooseFieldFeature("space")}><b>공간·가구 임장</b><small>평면도·면적·가구 배치</small></button><button type="button" className={fieldFeatureId === "time" ? "active" : ""} onClick={() => chooseFieldFeature("time")}><b>시간대 분석</b><small>06·09·12·18·22·01시</small></button><button type="button" className={fieldFeatureId === "noise" ? "active" : ""} onClick={() => chooseFieldFeature("noise")}><b>소음 지도</b><small>소음원·시간대별 확인</small></button></div>
      <nav className="field-level-path" aria-label="지역과 집을 살펴보는 4단계">{FIELD_LEVELS.map((level) => { const activeLevel = fieldFeatureId === level.featureId && level.id !== "life"; const liveContext = level.id === "region" ? `${activeRegion.sigungu} 지역` : level.id === "complex" ? selectedProperty?.name || level.example : level.id === "unit" ? selectedVariant ? `${dongLabel(selectedVariant.buildingDong) || "동 정보 없음"} · 전용 ${selectedVariant.areaBucket}평` : level.example : "지역 분석에 반영할 개인 기준 선택"; return <button type="button" key={level.id} className={activeLevel ? "active" : ""} aria-pressed={activeLevel} onClick={() => chooseFieldFeature(level.featureId)}><em>{level.step}</em><b>{level.label}</b><span>{level.summary}</span><small>{liveContext}</small><i>{level.status}</i></button>; })}</nav>
      <div className="field-context"><span>분석 위치</span><b>{fieldMapQuery}</b><small>상단 지역·단지 선택과 자동 동기화됩니다.</small></div>
      <div className="field-shell">
        <nav className="field-groups" aria-label="온라인 임장 분류">{FIELD_GROUPS.map((group) => <button key={group} className={fieldGroup === group ? "active" : ""} onClick={() => chooseFieldFeature(FIELD_FEATURES.find((feature) => feature.group === group)?.id || "region")}><span>{group}</span><b>{FIELD_FEATURES.filter((feature) => feature.group === group).length}</b></button>)}</nav>
        <div className="field-feature-list">{fieldGroupFeatures.map((feature) => <button key={feature.id} className={fieldFeatureId === feature.id ? "active" : ""} aria-pressed={fieldFeatureId === feature.id} aria-controls="field-analysis-panel" onClick={() => chooseFieldFeature(feature.id)}><div><b>{feature.title}</b><span>{feature.information}</span></div><em className={feature.status}>{feature.status === "live" ? "사용 가능" : feature.status === "beta" ? "시험 기능" : "데이터 준비 중"}</em><i className="importance-meter" aria-label={`중요도 5점 중 ${feature.importance}점`}>{[1,2,3,4,5].map((point) => <span key={point} className={point <= feature.importance ? "on" : ""} />)}</i></button>)}</div>
        <article key={fieldFeatureId} id="field-analysis-panel" ref={fieldWorkspaceRef} className="field-workspace field-workspace-slide" aria-live="polite">
          <header><span className={activeFieldFeature.status}>{activeFieldFeature.status === "live" ? "사용 가능" : activeFieldFeature.status === "beta" ? "시험 기능" : "데이터 준비 중"}</span><h3>{activeFieldFeature.title}</h3><p>{activeFieldFeature.value}</p></header>
          {activeFieldFeature.id === "space" && <div className="field-space-planner">
            <div className="space-planner-heading"><div><h4>평면도를 보고, 내 가구가 들어가는지 확인하세요.</h4><p>특정 매물과 연결하지 않아도 평면도 이미지와 실제 방 치수만 있으면 공간을 검토할 수 있습니다.</p></div><div><Ruler size={20} strokeWidth={1.8} aria-hidden="true" /><span><b>{spaceAreaNumber > 0 ? `${spaceAreaNumber.toFixed(1)}㎡` : "면적 입력 전"}</b><small>{spaceAreaNumber > 0 ? `${(spaceAreaNumber / 3.3058).toFixed(1)}평 · 전용면적` : "계약서·도면 기준"}</small></span></div></div>
            <div className="space-measurement-form"><label><span>전용면적</span><div><input type="number" min="1" max="1000" step="0.1" value={spaceArea} onChange={(event) => setSpaceArea(event.target.value)} placeholder="예: 84" /><em>㎡</em></div></label><label><span>검토 공간</span><input value={spaceRoomName} maxLength={20} onChange={(event) => setSpaceRoomName(event.target.value)} placeholder="예: 안방" /></label><label><span>방 가로</span><div><input type="number" min="50" max="3000" step="10" value={spaceRoomWidth} onChange={(event) => setSpaceRoomWidth(event.target.value)} /><em>cm</em></div></label><label><span>방 세로</span><div><input type="number" min="50" max="3000" step="10" value={spaceRoomDepth} onChange={(event) => setSpaceRoomDepth(event.target.value)} /><em>cm</em></div></label>{selectedVariant && <button type="button" onClick={() => setSpaceArea(String(Math.round(selectedVariant.areaMedian * 10) / 10))}>현재 선택 평형 {selectedVariant.areaMedian.toFixed(1)}㎡ 불러오기</button>}</div>
            <div className="space-planner-stage">
              <section className="space-plan-source"><header><div><b>1. 평면도 확인</b><span>매물 광고·분양 자료의 평면도를 불러옵니다.</span></div>{spacePlanUrl && <button type="button" onClick={removeSpacePlan}>이미지 제거</button>}</header>{spacePlanUrl ? <div className="space-plan-preview"><img src={spacePlanUrl} alt={`${spacePlanName} 사용자가 불러온 평면도`} /><span>{spacePlanName}</span></div> : <label className="space-plan-upload"><ImagePlus size={34} strokeWidth={1.5} aria-hidden="true" /><b>평면도 이미지 불러오기</b><span>JPG·PNG·WEBP · 최대 10MB</span><em><Upload size={15} strokeWidth={2} aria-hidden="true" />파일 선택</em><input ref={spacePlanInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSpacePlanUpload} /></label>}{spacePlanError && <p className="space-plan-error">{spacePlanError}</p>}<footer>이미지는 서버로 전송하지 않고 현재 브라우저에서만 미리봅니다. 이미지 비율만으로 실제 면적을 추정하지 않습니다.</footer></section>
              <section className="space-room-editor"><header><div><b>2. {spaceRoomName || "선택 공간"} 배치 스케치</b><span>{spaceRoomWidthNumber > 0 && spaceRoomDepthNumber > 0 ? `${(spaceRoomWidthNumber / 100).toFixed(1)}m × ${(spaceRoomDepthNumber / 100).toFixed(1)}m · ${spaceRoomArea.toFixed(1)}㎡` : "가로·세로 치수를 입력하세요."}</span></div><Move size={18} strokeWidth={1.8} aria-hidden="true" /></header>{spaceRoomWidthNumber > 0 && spaceRoomDepthNumber > 0 ? <div className="space-room-canvas-wrap"><div className="space-room-width-ruler"><span>{(spaceRoomWidthNumber / 100).toFixed(1)}m</span></div><div className="space-room-depth-ruler"><span>{(spaceRoomDepthNumber / 100).toFixed(1)}m</span></div><div className="space-room-canvas" style={{ aspectRatio: `${spaceRoomWidthNumber} / ${spaceRoomDepthNumber}` }}>{spaceFurnitureLayouts.map((item) => { const ItemIcon = item.catalog.icon; const colliding = collidingSpaceFurniture.has(item.id); return <button type="button" key={item.id} className={`${selectedSpaceFurnitureId === item.id ? "selected" : ""} ${colliding ? "collision" : ""} ${item.overflow ? "overflow" : ""}`} style={{ left: `${item.left}%`, top: `${item.top}%`, width: `${item.widthPercent}%`, height: `${item.depthPercent}%`, "--furniture-color": item.catalog.color } as React.CSSProperties} onClick={() => setSelectedSpaceFurnitureId(item.id)} aria-label={`${item.catalog.label} ${item.width}×${item.depth}cm${colliding ? ", 다른 가구와 겹침" : ""}${item.overflow ? ", 방 크기 초과" : ""}`}><ItemIcon size={16} strokeWidth={1.8} aria-hidden="true" /><span>{item.catalog.label}<small>{item.width}×{item.depth}</small></span></button>; })}{!spaceFurniture.length && <div className="space-room-empty"><Sofa size={28} strokeWidth={1.5} aria-hidden="true" /><b>가구를 추가해 배치를 시작하세요.</b><span>아래 대표 규격을 선택하면 실제 치수 비율로 표시됩니다.</span></div>}</div></div> : <div className="field-data-state"><Ruler size={20} strokeWidth={1.7} aria-hidden="true" />방 가로·세로 치수를 입력해주세요.</div>}</section>
            </div>
            <div className="space-furniture-library"><div><b>3. 배치할 가구</b><span>대표 규격이며 실제 제품 치수는 직접 확인해야 합니다.</span></div><div>{FURNITURE_CATALOG.map((item) => { const ItemIcon = item.icon; return <button type="button" key={item.kind} onClick={() => addSpaceFurniture(item.kind)} disabled={spaceFurniture.length >= 8}><ItemIcon size={19} strokeWidth={1.8} aria-hidden="true" /><span><b>{item.label}</b><small>{item.width} × {item.depth}cm</small></span></button>; })}</div></div>
            {selectedSpaceFurniture && <div className="space-furniture-controls"><div><span>선택 가구</span><b>{selectedSpaceFurniture.catalog.label}</b><small>{selectedSpaceFurniture.width} × {selectedSpaceFurniture.depth}cm</small></div><div className="space-position-grid" aria-label="선택 가구 위치"><button type="button" onClick={() => moveSpaceFurniture(0, 0)}>왼쪽 위</button><button type="button" onClick={() => moveSpaceFurniture(.5, 0)}>가운데 위</button><button type="button" onClick={() => moveSpaceFurniture(1, 0)}>오른쪽 위</button><button type="button" onClick={() => moveSpaceFurniture(0, 1)}>왼쪽 아래</button><button type="button" onClick={() => moveSpaceFurniture(.5, .5)}>정중앙</button><button type="button" onClick={() => moveSpaceFurniture(1, 1)}>오른쪽 아래</button></div><div className="space-edit-actions"><button type="button" onClick={rotateSpaceFurniture}><RotateCw size={15} strokeWidth={2} aria-hidden="true" />90° 회전</button><button type="button" className="delete" onClick={removeSpaceFurniture}><Trash2 size={15} strokeWidth={2} aria-hidden="true" />삭제</button></div></div>}
            <div className="space-fit-status"><div><span>방 바닥면적</span><b>{spaceRoomArea > 0 ? `${spaceRoomArea.toFixed(1)}㎡` : "-"}</b></div><div><span>가구 바닥면적 합</span><b>{occupiedSpaceArea > 0 ? `${occupiedSpaceArea.toFixed(1)}㎡` : "0㎡"}</b><small>{spaceRoomArea > 0 ? `방 면적의 ${Math.round(occupiedSpaceArea / spaceRoomArea * 100)}%` : "방 치수 필요"}</small></div><div><span>배치 확인</span><b className={collidingSpaceFurniture.size || spaceFurnitureLayouts.some((item) => item.overflow) ? "caution" : "good"}>{spaceFurnitureLayouts.some((item) => item.overflow) ? "방 크기 초과" : collidingSpaceFurniture.size ? `${collidingSpaceFurniture.size}개 겹침` : spaceFurniture.length ? "현재 스케치상 가능" : "가구 미선택"}</b></div><button type="button" onClick={() => { setSpaceFurniture([]); setSelectedSpaceFurnitureId(""); }} disabled={!spaceFurniture.length}>배치 초기화</button></div>
            <p className="space-planner-note"><b>판단 범위:</b> 입력한 방 치수와 가구의 대표 외곽 크기만 비교합니다. 문·창문·기둥·콘센트·동선 여유는 자동 판독하지 않으므로 최종 구매 전 현장 실측이 필요합니다.</p>
          </div>}
          {activeFieldFeature.id === "region" && <div className="field-region-redirect"><MapPin size={22} strokeWidth={1.8} aria-hidden="true" /><div><b>생활권 분석을 가격 화면에 통합했습니다.</b><p>시설 수, 거리, 지도와 생활 유형을 한곳에서 이어서 확인할 수 있습니다.</p></div><button type="button" onClick={() => { setAnalysisMode("price"); window.requestAnimationFrame(() => facilityPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>가격·생활 분석 보기</button></div>}
          {activeFieldFeature.id === "region" && <div className="field-region-dashboard" hidden aria-hidden="true">
            <div className="field-region-intro"><div><span>반경 1km 생활시설</span><h4>{fieldAreaTitle}의 생활 여건을 확인하세요.</h4><p>생활시설 수와 가장 가까운 곳을 먼저 비교한 뒤 지도에서 위치를 확인할 수 있습니다.</p></div><div><b>{nearbyPlaces.length}</b><span>1km 안 확인된 시설</span><small>선택 건물 중심</small></div></div>
            {!selectedProperty ? <div className="field-selection-needed"><b>먼저 지도에서 동과 건물을 선택해주세요.</b><p>정확한 건물 좌표가 있어야 주변 시설이 다른 동과 섞이지 않습니다.</p><button type="button" onClick={() => fieldSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>임장 지도에서 건물 선택</button></div> : nearbyLoading || locationLoading ? <div className="field-data-state"><i />생활권 시설을 집계하고 있습니다.</div> : nearbyError || locationError ? <div className="field-data-state error"><b>생활권을 불러오지 못했습니다.</b><span>{nearbyError || locationError}</span></div> : <>
              <div className="field-lifestyle-filter"><span>내 생활 기준</span><div>{["마트","병원","학교","헬스장","공원"].map((keyword) => <button type="button" key={keyword} className={lifestyleKeyword === keyword ? "active" : ""} aria-pressed={lifestyleKeyword === keyword} onClick={() => setLifestyleKeyword(keyword)}>{keyword}</button>)}</div><p><b>{lifestyleKeyword} {lifestylePlaces.length}곳</b>{lifestylePlaces[0] ? ` · 가장 가까운 ${lifestylePlaces[0].name} ${lifestylePlaces[0].distance.toLocaleString()}m` : " · 1km 안에서 확인되지 않음"}</p></div>
              <div className="field-life-chart" aria-label={`${fieldAreaTitle} 1km 생활시설 분포`}>{fieldCategorySummaries.map((category) => { const CategoryIcon = category.icon; return <div key={category.label} style={{ "--facility-color": category.color } as React.CSSProperties}><i><CategoryIcon size={17} strokeWidth={1.9} aria-hidden="true" /></i><span><b>{category.label}</b><small>{category.nearest ? `가장 가까운 ${category.nearest.name} · ${category.nearest.distance.toLocaleString()}m` : "확인 시설 없음"}</small></span><em><i style={{ width: `${Math.max(3, category.count / maxFieldCategoryCount * 100)}%` }} /></em><strong>{category.count}<small>곳</small></strong><p>{category.within500m}곳<small>500m 안</small></p></div>; })}</div>
              <div className="field-map-option"><div><b>위치가 궁금할 때만 지도를 여세요.</b><p>요약 차트에서 후보를 좁힌 뒤 500m·1km 반경과 실제 시설 위치를 확인할 수 있습니다.</p></div><button type="button" aria-expanded={showFieldMap} aria-controls="field-inline-map" onClick={toggleFieldMap}>{showFieldMap ? "생활권 지도 닫기" : "필요할 때 지도 보기"}</button></div>
              {showFieldMap && propertyLocation && <div ref={fieldInlineMapRef} id="field-inline-map" className="field-inline-map"><KakaoPlaceMap location={propertyLocation} title={selectedProperty.name} places={nearbyPlaces} active={activeSection === "chart" && fieldFeatureId === "region"} /><div className="radius-key"><span><i />500m 생활권</span><span><i />1km 생활권</span></div></div>}
              <p className="field-estimate-note">시설 수는 등록 정보, 거리는 직선거리 기준입니다. 등록 누락과 실제 출입구 위치에 따라 체감 접근성은 달라질 수 있습니다.</p>
            </>}
          </div>}
          {activeFieldFeature.id === "walk" && <div className="field-walk-panel"><header><div><span>일상 동선 비교</span><h4>{fieldAreaTitle}에서 자주 오갈 곳</h4><p>가까운 역·학교·병원·장보기 시설을 한 화면에서 비교합니다.</p></div><small>도보·차량 모두 예상값</small></header>{!selectedProperty ? <div className="field-selection-needed"><b>건물을 선택하면 동선을 계산합니다.</b><button type="button" onClick={() => fieldSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>임장 지도에서 건물 선택</button></div> : nearbyLoading ? <div className="field-data-state"><i />가까운 목적지를 찾고 있습니다.</div> : <div className="field-route-list">{nearestWalkTargets.map((target) => { const place = target.place; const drivingMinutes = place ? estimatedTravelMinutes(place.distance).drivingMinutes : 0; return <article key={target.id}><i><FacilityIcon name={place?.subCategory || target.category} size={20} /></i><div><span>{target.label}</span><b>{place?.name || "1km 안 확인 시설 없음"}</b><small>{place ? `${place.subCategory} · 직선 ${place.distance.toLocaleString()}m` : "검색 범위를 넓혀 확인해주세요."}</small></div><p><strong>{place ? `약 ${place.walkingMinutes}분` : "-"}</strong><small>도보 예상</small></p><p><strong>{place ? `약 ${drivingMinutes}분` : "-"}</strong><small>차량 예상</small></p></article>; })}</div>}<footer><b>계산 기준</b><p>도보는 직선거리의 1.2배와 분당 75m, 차량은 직선거리의 1.25배와 도심 평균 18km/h·진출입 3분을 적용한 예상입니다. 신호·경사·정체·출입구는 아직 반영하지 않습니다.</p></footer></div>}
          {activeFieldFeature.id === "time" && <div className={`field-time-panel tone-${activeTimeSlot.tone}`}>
            <header><div><span>선택 시간</span><b>{activeTimeSlot.label}</b></div><small>{fieldMapQuery}</small></header>
            <div className="field-time-slider"><input type="range" min="0" max={TIME_SLOTS.length - 1} step="1" value={timeSlotIndex} onChange={(event) => setTimeSlotIndex(Number(event.target.value))} aria-label={`동네 분위기 시간 선택, 현재 ${activeTimeSlot.label}`} /><div>{TIME_SLOTS.map((slot, index) => <button type="button" key={slot.hour} className={timeSlotIndex === index ? "active" : ""} aria-pressed={timeSlotIndex === index} onClick={() => setTimeSlotIndex(index)}>{slot.hour}시</button>)}</div></div>
            <div className="field-time-result" aria-live="polite"><div><span>{activeTimeSlot.phase}</span><h4>{activeTimeSlot.title}</h4><p>선택한 시간에 현장에서 우선 확인할 항목입니다.</p></div><ul>{activeTimeSlot.checks.map((check) => <li key={check.label}><b>{check.label}</b><span>{check.detail}</span></li>)}</ul></div>
            <footer><div><span>실측 데이터 연결 전</span><p>현재는 시간대별 현장 확인 기준을 제공합니다. 교통량·유동인구·소음 수치는 공식 데이터가 연결된 뒤 표시합니다.</p></div><a href={fieldMapUrl} target="_blank" rel="noreferrer">현재 지도에서 현장 확인</a></footer>
          </div>}
          {activeFieldFeature.id === "noise" && <div className="field-noise-panel">
            <header><div><span>소음원별 확인</span><h4>소음원을 나눠 시간대별로 비교합니다.</h4><p>같은 단지도 도로·철도·상가·학교처럼 소음원이 다르면 체감이 달라집니다.</p></div><button type="button" onClick={() => setNoiseSources(NOISE_SOURCES.map((source) => source.id))}>전체 소음원 선택</button></header>
            <div className="noise-source-picker" aria-label="표시할 소음원">{NOISE_SOURCES.map((source) => { const active = noiseSources.includes(source.id); return <button type="button" key={source.id} className={active ? "active" : ""} aria-pressed={active} onClick={() => setNoiseSources((current) => active ? current.filter((id) => id !== source.id) : [...current, source.id])}><b>{source.label}</b><small>{source.detail}</small></button>; })}</div>
            <div className="noise-layer-status"><div><span>선택된 레이어</span><b>{noiseSources.length}개 소음원</b><p>{noiseSources.length ? "선택한 소음원을 기준으로 이 위치의 측정망·공간 데이터를 결합합니다." : "지도에 표시할 소음원을 하나 이상 선택하세요."}</p></div><a href={fieldMapUrl} target="_blank" rel="noreferrer">주변 위치 확인</a></div>
            <div className="noise-time-table"><div className="noise-time-head"><span>시간</span><span>예상 소음</span><span>표시 기준</span></div>{["07시", "12시", "18시", "23시"].map((hour) => <div key={hour}><b>{hour}</b><strong>연결 대기</strong><span>{noiseSources.length ? "측정망·도로·철도·시설 데이터 결합" : "소음원 선택 필요"}</span></div>)}</div>
            <footer><span>실제 dB는 아직 표시하지 않습니다.</span><p>환경소음 측정망, 도로·철도·항공 경로, 공사 정보가 연결되면 선택한 소음원과 시간대별 dB·주의 구간을 같은 표와 지도에 표시합니다.</p></footer>
          </div>}
          {activeFieldFeature.id === "night" && <div className="field-night-panel"><header><div><span>야간 생활 확인</span><h4>{fieldAreaTitle}의 늦은 귀가 조건</h4><p>막차와 밤 생활환경은 서로 다른 원천으로 나눠 확인합니다.</p></div><small>22:00 · 01:00 기준</small></header>{!selectedProperty ? <div className="field-selection-needed"><b>건물을 선택하면 야간 생활권을 확인합니다.</b><button type="button" onClick={() => fieldSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>임장 지도에서 건물 선택</button></div> : <><div className="field-last-service"><div><FacilityIcon name="지하철역" size={20} /><span><small>가까운 교통 거점</small><b>{nightStation?.name || "1km 안 확인되지 않음"}</b><em>{nightStation ? `직선 ${nightStation.distance.toLocaleString()}m · 도보 약 ${nightStation.walkingMinutes}분` : "교통 검색 결과 없음"}</em></span></div><p><span>지하철 막차</span><strong>확인 필요</strong><small>노선·요일별 공식 시간표 연결 전</small></p><p><span>버스 막차</span><strong>확인 필요</strong><small>정류장·노선별 도착정보 연결 전</small></p></div><div className="field-night-environment"><article><FacilityIcon name="편의점" size={19} /><span><b>{nightConveniences.length}곳</b><small>1km 안 편의점</small></span></article><article><FacilityIcon name="약국" size={19} /><span><b>{nightMedical.length}곳</b><small>병원·약국 검색 결과</small></span></article><article><Moon size={19} strokeWidth={1.9} aria-hidden="true" /><span><b>현장 확인</b><small>가로등·골목·야간 소음</small></span></article></div><div className="field-night-checks">{TIME_SLOTS.filter((slot) => slot.hour === "22" || slot.hour === "01").map((slot) => <div key={slot.hour}><b>{slot.label}</b><span>{slot.phase}</span><ul>{slot.checks.map((check) => <li key={check.label}><strong>{check.label}</strong><small>{check.detail}</small></li>)}</ul></div>)}</div><p className="field-estimate-note">막차 시각은 임의로 표시하지 않습니다. 지하철·버스 공식 노선 시간표가 연결되면 요일과 역·정류장 기준으로 갱신합니다.</p></>}</div>}
          {activeFieldFeature.id === "commute" && <div className="field-commute-panel"><form onSubmit={calculateCommute}><label><span>회사·학교·자주 가는 곳</span><input value={commuteDestination} onChange={(event) => { setCommuteDestination(event.target.value); setCommuteEstimate(null); setCommuteError(""); }} placeholder="예: 광화문역, 판교테크노밸리" /></label><button type="submit" disabled={!commuteDestination.trim() || !propertyLocation || commuteLoading}>{commuteLoading ? "목적지 확인 중…" : propertyLocation ? "이동시간 바로 계산" : "먼저 단지를 선택해주세요"}</button></form><small>출발지: {selectedProperty ? `${fieldMapQuery}` : "단지 선택 필요"}</small>{commuteError && <div className="field-data-state error"><b>계산하지 못했습니다.</b><span>{commuteError}</span></div>}{commuteEstimate && <div className="commute-result" aria-live="polite"><header><span><small>목적지</small><b>{commuteEstimate.destination}</b><em>{commuteEstimate.address}</em></span><strong>{(commuteEstimate.distance / 1000).toFixed(1)}km<small>직선거리</small></strong></header><div><article><MapPin size={20} strokeWidth={1.9} aria-hidden="true" /><span>걸어서</span><b>약 {commuteEstimate.walkingMinutes}분</b></article><article><CarFront size={20} strokeWidth={1.9} aria-hidden="true" /><span>차량</span><b>약 {commuteEstimate.drivingMinutes}분</b></article><article><BusFront size={20} strokeWidth={1.9} aria-hidden="true" /><span>대중교통</span><b>약 {commuteEstimate.transitMinutes}분</b></article></div><footer><b>실제 경로 정보 연결 전 예상</b><p>직선거리의 1.25배, 도보 분당 75m, 차량 평균 18km/h, 대중교통 평균 13.8km/h에 기본 대기시간을 더했습니다. 실제 환승·정체·신호는 반영되지 않습니다.</p></footer></div>}</div>}
          {activeFieldFeature.id === "price" && <div className="field-facts"><div><span>최근 3개월 거래</span><strong>{latestQuarterTrades.length.toLocaleString()}건</strong></div><div><span>분기 중위가격</span><strong>{formatPrice(median(latestQuarterTrades.map((trade) => trade.amount)))}</strong></div><div><span>유사 면적 대비</span><strong>{selectedKey && peerPyeongPrice ? `${valuationGap >= 0 ? "+" : ""}${valuationGap.toFixed(1)}%` : "단지 선택 필요"}</strong></div><a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>상세 가격 차트 보기 →</a></div>}
          {activeFieldFeature.id === "report" && <div className="field-report"><h4>현재 실거래 자동 요약</h4><ul><li>{activeRegion.sigungu}에서 최근 3개월 신고 거래 {latestQuarterTrades.length.toLocaleString()}건을 확인했습니다.</li><li>{propertyRows.length ? `동·평형 조건 ${propertyRows.length.toLocaleString()}개를 같은 기준으로 비교할 수 있습니다.` : "현재 조건은 비교 가능한 동·평형 표본이 부족합니다."}</li><li>{selectedKey && peerPyeongPrice ? `선택 후보는 유사 면적 지역 중위보다 ${Math.abs(valuationGap).toFixed(1)}% ${valuationGap > 0 ? "높습니다." : "낮습니다."}` : "단지를 선택하면 유사 면적 실거래와 가격 차이를 계산합니다."}</li></ul><small>생성형 문장이 아니라 현재 화면의 실거래 계산값을 요약합니다.</small></div>}
          {activeFieldFeature.id === "compare" && <div className="field-compare">{savedHomes.length ? savedHomes.slice(0,3).map((home) => <div key={home.id}><b>{home.name}</b><span>{home.region} · {home.area}평</span><strong>{home.score}점</strong></div>) : <p>가격 차트에서 관심 후보를 담으면 최대 3개 단지를 한눈에 비교할 수 있습니다.</p>}<a href="#chart" onClick={(event) => { event.preventDefault(); changeView("chart"); }}>비교 후보 고르기 →</a></div>}
          {!(["space","region","walk","time","noise","night","commute","price","report","compare"].includes(activeFieldFeature.id)) && <div className="field-connect"><span>{activeFieldFeature.information}</span><strong>공식 데이터 연결이 필요합니다.</strong><p>확인 가능한 데이터가 연결되기 전에는 추정 점수를 표시하지 않습니다.</p><div><i />원천 검증 <i />주소·동 매칭 <i />사용자 교차 확인</div></div>}
        </article>
      </div>
    </section>

    <section className="research-section" id="research">
      <div className="research-heading">
        <div><h2>매수 판단에 필요한 21가지 분석</h2><span>가격, 수급, 공급, 입지, 수익 순서로 필요한 근거를 차근차근 확인합니다.</span></div>
        <div className="research-counts"><article><strong>21</strong><span>전체 분석</span></article><article><strong>9</strong><span>바로 사용 가능</span></article><article><strong>12</strong><span>추가 데이터 필요</span></article></div>
      </div>
      <div className="research-scope"><span>현재 분석 범위</span><b>{activeRegion.sido}</b><i>›</i><b>{activeRegion.sigungu}</b>{selectedDong !== "all" && <><i>›</i><b>{selectedDong}</b></>}<em>{PROPERTY_TYPES.find((item) => item.key === type)?.label}</em><small>위 지역 선택과 자동 동기화</small></div>
      <div className="research-shell">
        <aside className="research-axis" aria-label="리서치 대분류">
          {RESEARCH_CATEGORIES.map((category) => <button key={category.id} className={researchCategory === category.id ? "active" : ""} aria-pressed={researchCategory === category.id} onClick={() => { setResearchCategory(category.id); setResearchTool(category.tools[0].id); }}><em>{category.number}</em><span><b>{category.label}</b><small>{category.short}</small></span><i>{category.tools.length}</i></button>)}
        </aside>
        {researchCategory === "price" ? <ResearchAnalysisWorkspace
          view={analysisResearchView}
          onViewChange={changeAnalysisResearchView}
          rows={analysisResearchRows}
          columnOrder={analysisResearchColumns}
          onSelectProperty={selectAnalysisResearchProperty}
          visibleCount={analysisResearchRows.length}
          totalCount={activeResearchDataView?.rowIds.length || 0}
          onLoadMore={() => setResearchLimit((value) => value + 30)}
          state={loading ? "loading" : error ? "error" : researchBundle?.status === "partial" ? "partial" : "ready"}
          stateMessage={error || (researchBundle?.status === "partial" ? "일부 월의 응답이 지연되어 확인된 거래만 표시합니다." : undefined)}
          onRetry={() => setDataRetry((value) => value + 1)}
        /> : <div className="research-workspace">
          <div className="research-category-head"><div><span>{activeResearchCategory.short}</span><h3>{activeResearchCategory.label}</h3><p>{activeResearchCategory.description}</p></div><b>{activeResearchCategory.tools.filter((tool) => tool.mode === "live").length}개 사용 가능</b></div>
          <div className="research-tool-grid">{activeResearchCategory.tools.map((tool) => <button key={tool.id} className={researchTool === tool.id ? "active" : ""} aria-pressed={researchTool === tool.id} onClick={() => setResearchTool(tool.id)}><span>{tool.label}</span><small className={tool.mode}>{tool.mode === "live" ? "사용 가능" : "데이터 준비 중"}</small></button>)}</div>
          <article className="research-output">
            <header><div><span className={activeResearchTool.mode}>{activeResearchTool.mode === "live" ? "실거래 기반" : "추가 데이터 필요"}</span><h3>{activeResearchTool.label}</h3><p>{activeResearchTool.description}</p></div><small>{activeResearchTool.mode === "live" ? "사용 가능" : "준비 중"}</small></header>
            {activeResearchTool.mode === "live" ? <div className="research-live-board">
              <div className="research-table-head"><span>순위</span><span>단지 · 동 · 평형</span><span>3개월 중위가</span><span>도구 기준</span></div>
              {loading ? <div className="research-state"><i />선택 지역의 실거래를 계산하고 있습니다.</div> : error ? <div className="research-state error"><b>실거래 분석을 불러오지 못했습니다.</b><span>{error}</span><button type="button" onClick={() => setDataRetry((value) => value + 1)}>다시 불러오기</button></div> : researchRows.length ? researchRows.map((row, index) => <button key={row.key} onClick={() => selectCandidate(row)}><em>{String(index + 1).padStart(2, "0")}</em><span className={`research-building tone-${index % 5}`}>{row.name.slice(0, 1)}</span><b>{row.name}<small>{row.dong} · {dongLabel(row.buildingDong) || "동 정보 없음"} · 전용 {row.areaBucket}평 · {row.quarterCount}건</small></b><span>{formatPrice(row.current)}</span><strong className={researchTool === "record-high" || researchTool === "multi-compare" || researchTool === "most-bought" || researchTool === "volume" ? "" : researchTool === "price-compare" ? row.gap >= 0 ? "up" : "down" : (row.change ?? 0) >= 0 ? "up" : "down"}>{researchMetric(row)}</strong></button>) : <div className="research-state"><b>이 조건에서 비교 가능한 표본이 없습니다.</b><span>시·군·구 전체 또는 다른 주택 유형으로 범위를 넓혀보세요.</span></div>}
            </div> : <div className="research-connect-state"><div><span>데이터 준비 중</span><strong>확인된 공식 데이터만<br/>분석에 연결합니다.</strong><p>{activeResearchTool.label}에는 현재 실거래 외에 <b>{activeResearchTool.source}</b> 데이터가 필요합니다. 연결 전에는 임의의 값을 표시하지 않습니다.</p></div><ol><li><em>1</em><b>출처 확인</b><span>공식 기관과 갱신 주기 확인</span></li><li><em>2</em><b>지역 코드 통합</b><span>시·군·구·읍·면·동 연결</span></li><li><em>3</em><b>교차 분석</b><span>실거래와 같은 화면에서 비교</span></li></ol></div>}
          </article>
        </div>}
      </div>
      <p className="research-note">가격·거래량 분석은 현재 선택 지역의 신고 실거래로 계산합니다. 매물·전세·공급·인구·학군처럼 추가 공식 데이터가 필요한 기능은 준비 중으로 구분했습니다.</p>
    </section>

    <section className="map-section" id="map">
      <header className="map-section-title"><div><h2>지역과 단지를 지도에서 찾기</h2><p>지역을 고르고 동 경계를 누르면 실제 도로 지도에서 거래가 있는 건물과 가격을 확인할 수 있습니다.</p></div><span>{marketMonth ? `${marketMonth.slice(0, 4)}년 ${Number(marketMonth.slice(4))}월 기준 · 최근 3개월` : marketError ? "전국 실거래 연결 확인 필요" : "실거래 집계 중"}</span></header>
      <nav className="map-path" aria-label="현재 지도 탐색 경로">
        <button type="button" className={mapFocus === "sido" ? "active" : ""} aria-current={mapFocus === "sido" ? "step" : undefined} onClick={() => setMapFocus("sido")}>{selectedMapSido}</button>
        <button type="button" className={mapFocus === "district" ? "active" : ""} aria-current={mapFocus === "district" ? "step" : undefined} disabled={selectedMapSido !== activeRegion.sido} onClick={() => setMapFocus("district")}>{selectedMapSido === activeRegion.sido ? activeRegion.sigungu : "시·군·구 선택"}</button>
        <button type="button" className={mapFocus === "buildings" ? "active" : ""} aria-current={mapFocus === "buildings" ? "step" : undefined} disabled={!ROAD_MAP_AVAILABLE || selectedDong === "all" || selectedMapSido !== activeRegion.sido} onClick={openMapBuildings}>{selectedDong === "all" ? "동 선택" : ROAD_MAP_AVAILABLE ? selectedDong : `${selectedDong} · 지도 연결 전`}</button>
      </nav>
      {activeSection === "research" && <div className="map-direct-picker" aria-label="목록으로 지역 선택">
        <div aria-live="polite"><span>현재 범위</span><b>{mapLocationTitle}</b><small>{mapLocationDescription}</small></div>
        <label><span>시·도</span><select value={selectedMapSido} onChange={(event) => chooseMapSido(event.target.value)}>{sidoOptions.map((sido) => <option key={sido} value={sido}>{sido}</option>)}</select></label>
        <label><span>시·군·구</span><select value={selectedMapSido === activeRegion.sido ? regionCode : ""} onChange={(event) => { const next = REGIONS.find((region) => region.code === event.target.value); if (next) chooseMapRegion(next); }}><option value="" disabled>시·군·구 선택</option>{mapDistricts.map((region) => <option key={region.code} value={region.code}>{region.sigungu}</option>)}</select></label>
        <label><span>읍·면·동</span><select value={mapDongChoices.includes(mapPickerDong) ? mapPickerDong : ""} disabled={!mapDongChoices.length} onChange={(event) => setMapPickerDong(event.target.value)}><option value="" disabled>{mapDongChoices.length ? "읍·면·동 선택" : "동 목록 불러오는 중"}</option>{mapDongChoices.map((dong) => <option key={dong} value={dong}>{dong} · {formatDongMetric(mapDongStats[dong], dongMetric)}</option>)}</select></label>
        <button type="button" disabled={!mapPickerDong || !mapDongChoices.includes(mapPickerDong)} onClick={() => chooseMapDong(mapPickerDong)}>{mapPickerDong ? `${mapPickerDong} 선택` : "동을 선택하세요"}</button>
      </div>}
      <div className="map-layout"><KakaoMarketMap markets={markets} focus={mapFocus} active={activeSection === "home" || activeSection === "research"} propertyType={type} selectedSido={selectedMapSido} activeRegion={activeRegion} selectedDong={selectedDong} selectedBoundaryDong={selectedBoundaryDong} dongStats={mapDongStats} dongMetric={dongMetric} onDongMetricChange={setDongMetric} buildingLocations={buildingLocations} buildingsLoading={buildingsLoading} buildingsError={buildingsError} selectedPropertyKey={selectedKey} camera={mapCamera} onCameraChange={setMapCamera} onSelectSido={chooseMapSido} onSelectRegion={chooseMapRegion} onSelectDong={chooseMapDong} onOpenBuildings={openMapBuildings} onSelectProperty={chooseMapProperty} />
        <aside className={`map-ranking${mapFocus === "buildings" ? "" : " map-selection-summary"}`} data-sheet-state={mobileSheetState} aria-label={mapFocus === "buildings" ? "선택 동과 주변 동의 최근 실거래 건물" : "선택 지역 요약"}>
          <div className="mobile-sheet-controls" role="group" aria-label="지도 결과 패널 높이"><button type="button" aria-pressed={mobileSheetState === "collapsed"} onClick={() => setMobileSheetState("collapsed")}>요약</button><button type="button" aria-pressed={mobileSheetState === "peek"} onClick={() => setMobileSheetState("peek")}>목록</button><button type="button" aria-pressed={mobileSheetState === "expanded"} onClick={() => setMobileSheetState("expanded")}>전체</button></div>
          {mapFocus === "buildings" ? <>
            <div className="map-inspector-scope"><span>{selectedMapProperty ? "선택 건물 가격" : "선택 동과 주변 생활권"}</span><h3>{selectedMapProperty ? selectedMapProperty.name : mapLocationTitle}</h3><p>{selectedMapProperty ? `${selectedMapProperty.dong} ${selectedMapProperty.jibun || "지번 확인 중"} · 최근 실거래 ${formatPrice(selectedMapProperty.lastAmount)} · ${selectedMapProperty.count}건 · 다른 아이콘을 눌러 계속 비교할 수 있습니다.` : visibleBuildingDongs.length > 1 ? `${visibleBuildingDongs.slice(0, 4).join(" · ")}${visibleBuildingDongs.length > 4 ? ` 외 ${visibleBuildingDongs.length - 4}곳` : ""}의 거래 건물을 함께 표시합니다.` : "선택 지역의 최근 실거래 건물을 지도에 표시합니다."}</p></div>
            <div className="map-market-summary"><div><span>{selectedDong} 건물</span><strong>{selectedMapBuildingCount}곳</strong></div><div><span>주변 동 건물</span><strong>{nearbyMapBuildingCount}곳</strong></div><div><span>표시 건물 중위가</span><strong>{mapBuildingMedian ? formatPrice(mapBuildingMedian) : buildingsLoading ? "확인 중" : buildingsError ? "좌표 확인 불가" : "데이터 없음"}</strong></div></div>
            <div className="map-ranking-head"><div><b>지도에 표시된 거래 건물</b><span>선택 동을 먼저, 인접 동을 다음에 보여줍니다.</span></div></div>
            <div className="ranking-labels building-labels"><span>구분</span><span>건물</span><span>최근 거래가</span><span>거래</span></div>
            {buildingStatus === "partial" && <div className="map-summary-loading" role="status">일부 주소 검증이 완료되지 않아 확인된 건물만 표시합니다.</div>}
            <div className="map-ranking-list building-list">{buildingsLoading ? <div className="ranking-loading">선택 동과 주변 동의 건물 좌표를 확인하고 있습니다.</div> : mapBuildingRows.length ? mapBuildingRows.map((building) => { const activeBuilding = building.key === selectedKey; return <button key={building.key} className={`${building.scope === "selected" ? "selected" : "nearby"}${activeBuilding ? " active-building" : ""}`} aria-pressed={activeBuilding} onClick={() => chooseMapProperty(building.key)}><em>{activeBuilding ? "선택됨" : building.scope === "selected" ? "선택 동" : "주변"}</em><b>{building.name}<small>{building.dong} · {PROPERTY_MAP_META[building.propertyType].short}</small></b><span>{formatPrice(building.lastAmount)}</span><strong>{building.count}건</strong></button>; }) : <div className="ranking-loading">{buildingsError || "이 범위에서 지도 좌표가 확인된 거래 건물이 없습니다."}</div>}</div>
            <div className="map-example-links map-context-foot"><span>지도 아이콘을 누르면 가격이 열립니다. 선택 후에도 다른 건물 아이콘은 유지됩니다.</span></div>
          </> : <>
            <div className="map-inspector-scope"><span>선택 지역</span><h3>{mapLocationTitle}</h3><p>{mapLocationDescription}</p></div>
            {selectedMapDongStat?.count ? <div className="map-market-summary"><div><span>동 중위가격</span><strong>{formatPrice(selectedMapDongStat.median)}</strong></div><div><span>동 평당가</span><strong>{compactPrice(selectedMapDongStat.perPy)}/평</strong></div><div><span>최근 거래</span><strong>{selectedMapDongStat.count.toLocaleString()}건</strong></div></div> : selectedMapMarket ? <div className="map-market-summary"><div><span>대표 지역 중위가격</span><strong>{selectedMapMarket.medianAmountManwon ? formatPrice(selectedMapMarket.medianAmountManwon) : "표본 부족"}</strong></div><div><span>직전 3개월 대비</span><strong className={selectedMapMarket.changePct === null || selectedMapMarket.changePct === undefined ? "" : selectedMapMarket.changePct >= 0 ? "up" : "down"}>{selectedMapMarket.changePct === null || selectedMapMarket.changePct === undefined ? "표본 부족" : `${selectedMapMarket.changePct >= 0 ? "+" : ""}${selectedMapMarket.changePct.toFixed(2)}%`}</strong></div><div><span>최근 거래</span><strong>{selectedMapMarket.count.toLocaleString()}건</strong></div></div> : marketError ? <div className="map-summary-loading error"><b>대표 지역 실거래를 불러오지 못했습니다.</b><span>{publicDataErrorMessage(marketError)}</span><button type="button" onClick={() => setMarketRetry((value) => value + 1)}>다시 불러오기</button></div> : <div className="map-summary-loading">선택 지역의 실거래를 집계하고 있습니다.</div>}
            <div className="map-example-links"><span>빠른 예시</span><div><button type="button" onClick={openGangnamMap}>강남구</button><button type="button" onClick={openHaengdangMap}>행당동</button></div></div>
          </>}
        </aside>
      </div>
    </section>

    <section className="trade-section" id="transactions">
      <div className="section-title wide"><div><h2>{displayName} 최근 실거래</h2><span>평수를 선택하면 같은 면적대의 거래만 모아봅니다.</span></div><span>단위: 만원 · 최대 30건 표시</span></div>
      <nav className="trade-area-tabs" aria-label="평수별 최근 실거래 필터"><button type="button" className={activeTradeAreaFilter === "all" ? "active" : ""} aria-pressed={activeTradeAreaFilter === "all"} onClick={() => setTradeAreaFilter("all")}>전체 <small>{propertyTrades.length}건</small></button>{tradeAreaGroups.map((group) => <button type="button" key={group.pyeong} className={activeTradeAreaFilter === String(group.pyeong) ? "active" : ""} aria-pressed={activeTradeAreaFilter === String(group.pyeong)} onClick={() => setTradeAreaFilter(String(group.pyeong))}>{group.pyeong}평 <small>{group.rows.length}건</small></button>)}</nav>
      <div className="trade-analysis-layout">
        <div className="trade-table" role="region" aria-label={`${displayName} ${activeTradeAreaFilter === "all" ? "전체 평수" : `${activeTradeAreaFilter}평`} 최근 실거래`}><div className="table-head"><span>계약일</span><span>건물명</span><span>전용면적</span><span>평수</span><span>층</span><span>거래금액</span><span>평당가</span></div>{recentTradeRows.map((trade) => { const expanded = expandedTradeIds.has(trade.id); return <button type="button" className="table-row" key={trade.id} aria-expanded={expanded} data-expanded={expanded} onClick={() => setExpandedTradeIds((current) => { const next = new Set(current); if (next.has(trade.id)) next.delete(trade.id); else next.add(trade.id); return next; })}><span>{trade.date.replaceAll("-", ".")}</span><b>{trade.name}</b><span>{trade.area ? `${trade.area.toFixed(1)}㎡` : "-"}</span><span>{trade.area ? `${(trade.area / 3.3058).toFixed(1)}평` : "-"}</span><span>{trade.floor === null ? "-" : `${trade.floor}층`}</span><strong>{formatPrice(trade.amount)}</strong><span>{trade.area ? `${Math.round(trade.amount / (trade.area / 3.3058)).toLocaleString()}만` : "-"}</span></button>; })}{!recentTradeRows.length && <div className="trade-empty">선택한 평수의 실거래가 없습니다.</div>}</div>
        <aside className="area-trade-chart" aria-label="면적별 전체 거래 차트"><header><div><span>면적별 전체 거래</span><h3>평수별 가격과 거래량</h3></div><small>중위가격 기준</small></header><div className="area-trade-bars">{tradeAreaGroups.length ? tradeAreaGroups.map((group) => <button type="button" key={group.pyeong} className={activeTradeAreaFilter === String(group.pyeong) ? "active" : ""} onClick={() => setTradeAreaFilter(String(group.pyeong))} aria-label={`${group.pyeong}평, 중위가격 ${formatPrice(group.median)}, ${group.rows.length}건`}><span><b>{group.pyeong}평</b><small>{group.areaMedian.toFixed(1)}㎡</small></span><i><em style={{ width: `${Math.max(8, group.median / maxAreaMedian * 100)}%` }} /></i><strong>{formatPrice(group.median)}<small>{group.rows.length}건</small></strong></button>) : <div className="trade-empty">면적별로 집계할 실거래가 없습니다.</div>}</div><p>막대 길이는 각 평수의 중위 거래가격이며, 오른쪽 숫자는 신고 거래 건수입니다.</p></aside>
      </div>
    </section>

    <section className="study-community" id="community">
      <div className="study-heading"><div><h2>광고보다 근거가 먼저인 부동산 스터디</h2><span>주제별 게시판에서 지역·평형·기간을 밝히고, 사실과 의견을 나눠 이야기합니다.</span></div><div><strong>5</strong><span>대분류</span><i /><strong>25</strong><span>세부 게시판</span></div></div>
      <div className="study-shell">
        <aside className="study-categories" aria-label="커뮤니티 대분류">{COMMUNITY_CATEGORIES.map((category) => <button key={category.id} className={communityCategory === category.id ? "active" : ""} aria-pressed={communityCategory === category.id} onClick={() => { setCommunityCategory(category.id); setCommunityBoard("전체"); setDraftSaved(false); }}><em>{category.number}</em><span><b>{category.label}</b><small>{category.description}</small></span><i>›</i></button>)}</aside>
        <div className="study-stage">
          <header><div><span>{activeCommunityCategory.label} 게시판</span><h3>{activeCommunityCategory.label}</h3><p>{activeCommunityCategory.description}</p></div><button type="button" onClick={() => { setShowStudyWriter((value) => !value); setDraftSaved(false); }}>{showStudyWriter ? "작성 창 닫기" : "분석 글 작성"}</button></header>
          <div className="study-board-tabs" aria-label={`${activeCommunityCategory.label} 세부 게시판`}>{activeCommunityCategory.boards.map((board) => <button key={board} className={communityBoard === board ? "active" : ""} aria-pressed={communityBoard === board} onClick={() => { setCommunityBoard(board); setDraftSaved(false); }}>{board}</button>)}</div>
          {showStudyWriter && <form className="study-writer" onSubmit={saveStudyDraft}><div><span>선택한 게시판</span><b>{activeCommunityCategory.label} · {communityBoard === "전체" ? activeCommunityCategory.boards[1] : communityBoard}</b></div><label><span>제목</span><input value={studyTitle} onChange={(event) => { setStudyTitle(event.target.value); setDraftSaved(false); }} maxLength={80} placeholder="무엇을 비교했고 어떤 판단이 궁금한가요?" required /></label><label><span>분석 내용</span><textarea value={studyBody} onChange={(event) => { setStudyBody(event.target.value); setDraftSaved(false); }} maxLength={1500} placeholder="지역·단지·평형, 확인한 실거래와 내 관점을 함께 적어주세요." required /></label><div className="study-writer-actions"><small>정식 게시 기능이 준비될 때까지 초안은 이 기기에만 저장됩니다. 공개 게시와 댓글은 로그인·신고 기능을 갖춘 뒤 연결합니다.</small><button type="submit">{draftSaved ? "이 기기에 저장됨" : "초안 저장"}</button></div></form>}
          <div className="study-topic-head"><div><b>{communityBoard === "전체" ? "토론 가이드" : communityBoard}</b><span>사실과 의견을 나눠 적는 예시 주제입니다.</span></div><small>{visibleCommunityGuides.length}개 주제</small></div>
          {visibleCommunityGuides.length ? <div className="study-topic-grid">{visibleCommunityGuides.map((guide) => <article key={guide.id}><div><span>{guide.board}</span><em>{guide.tag}</em></div><h4>{guide.title}</h4><p>{guide.summary}</p><div className="study-topic-foot"><b>근거</b><span>{guide.evidence}</span><button type="button" onClick={() => { setCommunityBoard(guide.board); setStudyTitle(guide.title); setShowStudyWriter(true); setDraftSaved(false); }}>이 주제로 글쓰기</button></div></article>)}</div> : <div className="study-empty"><span>{communityBoard}</span><b>아직 준비된 예시 주제가 없습니다.</b><p>이 게시판에서 가장 먼저 확인하고 싶은 질문을 초안으로 남겨보세요.</p><button type="button" onClick={() => setShowStudyWriter(true)}>첫 분석 글 작성</button></div>}
        </div>
      </div>
      <div className="study-rules"><article><em>01</em><b>근거 먼저</b><span>실거래·정부 원문·현장 사진처럼 확인 가능한 출처를 붙입니다.</span></article><article><em>02</em><b>조건을 정확히</b><span>지역·단지·동·평형·기간을 적어 다른 조건끼리 섞지 않습니다.</span></article><article><em>03</em><b>광고는 분리</b><span>중개·매물 유도·수익 보장 글은 일반 분석 게시판과 섞지 않습니다.</span></article></div>
    </section>

    <section className="policy-section" id="policy"><div className="section-title wide"><div><h2>부동산 정책 해설</h2><span>정부 공식 발표를 기준으로 매수자에게 영향을 줄 수 있는 내용을 정리합니다.{policyUpdated ? ` · ${new Date(policyUpdated).toLocaleString("ko-KR")} 마지막 확인` : ""}</span></div><a href="https://www.molit.go.kr/portal.do" target="_blank" rel="noreferrer">국토교통부 정책 원문</a></div><div className="policy-grid">{policyItems.map((policy) => <a key={policy.title} href={policy.url} target="_blank" rel="noreferrer" className={`policy-card ${policy.tone}`}><div><span>{policy.date}</span><em>{policy.scope}</em></div><b><i>{policyImpactLabel(policy.tone)}</i>{policy.title}</b><p>{policy.summary}</p><small>공식 발표 원문 보기</small></a>)}</div><p className="policy-method">영향 분류는 실수요자의 선택지, 금융·세금 부담, 공급 확대 여부를 기준으로 한 서비스의 해석입니다. 실제 효과는 지역과 보유 상황에 따라 달라질 수 있습니다.</p></section>

    <section className="insight home-next-actions" aria-label="정책과 커뮤니티 바로가기">
      <a href="#policy" onClick={(event) => { event.preventDefault(); changeView("policy"); }}>
        <span>정책</span><h2>내 집 선택에 영향을 주는 정책</h2><p>정부 공식 발표와 시장 영향을 한곳에서 확인하세요.</p><strong>정책 확인 <i aria-hidden="true">→</i></strong>
      </a>
      <a href="#community" onClick={(event) => { event.preventDefault(); changeView("community"); }}>
        <span>커뮤니티</span><h2>근거를 나누는 부동산 스터디</h2><p>실거래·지역·임장에 대한 다양한 관점을 살펴보세요.</p><strong>커뮤니티 보기 <i aria-hidden="true">→</i></strong>
      </a>
    </section>
    <footer className="site-footer"><div><a className="brand" href="#home" onClick={(event) => { event.preventDefault(); changeView("home"); }}><span>집값</span>의 정석</a><p>데이터로 보고, 실제로 살 집을 고르다.</p><small className="footer-build" title={releaseInfo?.commit || "빌드 버전 확인 중"}>버전 {releaseInfo?.shortCommit || "확인 중"}</small></div><div className="footer-data-sources"><b>데이터 제공·출처</b><span>국토교통부 실거래가 공개시스템 · 카카오맵·로컬 API · 국토교통부·정책브리핑 공식 발표 · <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer">SGIS 기반 행정구역 경계(CC BY 4.0)</a></span></div></footer>
  </main>;
}
