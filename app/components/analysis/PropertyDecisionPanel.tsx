"use client";

import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { AsyncState, Chip, ChipList, Surface, type AsyncStatus } from "@/app/components/common";
import { PropertyTypeIcon } from "./PropertyVisual";
import type { LivingCategory, NearbyFacility, PropertyDecisionData } from "./types";

export interface PropertyDecisionPanelProps {
  property: PropertyDecisionData;
  chart: ReactNode;
  map: ReactNode;
  livingCategories: LivingCategory[];
  selectedLivingCategory: string;
  onLivingCategoryChange: (key: string) => void;
  facilities: NearbyFacility[];
  nearbyState?: AsyncStatus | "ready";
  onRetryNearby?: () => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  onSelectFacility?: (key: string) => void;
  className?: string;
}

function SampleLabel({ state, count }: { state: PropertyDecisionData["sample"]["state"]; count: number }) {
  if (state === "sufficient") return <span>{count}건 기준</span>;
  if (state === "partial") return <span className="is-warning">일부 수집 · {count}건</span>;
  return <span className="is-warning">표본 부족 · {count}건</span>;
}

export function PropertyDecisionPanel({
  property,
  chart,
  map,
  livingCategories,
  selectedLivingCategory,
  onLivingCategoryChange,
  facilities,
  nearbyState = "ready",
  onRetryNearby,
  radius,
  onRadiusChange,
  onSelectFacility,
  className,
}: PropertyDecisionPanelProps) {
  return (
    <Surface className={["analysis-decision", className].filter(Boolean).join(" ")} aria-label={`${property.name} 가격과 생활권`}>
      <header className="analysis-decision__header">
        <div className="analysis-decision__identity">
          <PropertyTypeIcon type={property.propertyType} priceBucket={property.priceBucket} selected />
          <div>
            <h2>{property.name}</h2>
            <p>{property.address}{property.areaLabel ? ` · ${property.areaLabel}` : ""}</p>
          </div>
        </div>
        <div className="analysis-decision__price">
          <strong>{property.latestPriceLabel}</strong>
          <small>{property.latestContractDate ? `${property.latestContractDate} 최근 거래` : "최근 거래일 확인 필요"}</small>
          <SampleLabel state={property.sample.state} count={property.sample.count} />
        </div>
      </header>

      <dl className="analysis-metrics">
        {property.metrics.map((metric) => (
          <div key={metric.key} className={metric.tone ? `is-${metric.tone}` : undefined}>
            <dt>{metric.label}</dt><dd>{metric.value}</dd>{metric.note && <small>{metric.note}</small>}
          </div>
        ))}
      </dl>

      <section className="analysis-compact-chart" aria-label="가격 변화 차트">
        <header><h3>가격 흐름</h3><p>월 중위가격과 거래량을 함께 확인합니다.</p></header>
        <div className="analysis-compact-chart__canvas">{chart}</div>
      </section>

      <section className="analysis-area-prices" aria-labelledby="analysis-area-price-title">
        <header><h3 id="analysis-area-price-title">평형별 가격</h3><p>전용면적 환산평 기준이며 공급평형과 다를 수 있습니다.</p></header>
        {property.areaPrices.length ? (
          <div className="analysis-area-prices__table" role="table" aria-label={`${property.name} 평형별 가격`}>
            <div role="row"><span role="columnheader">전용면적</span><span role="columnheader">환산평</span><span role="columnheader">최근 거래</span><span role="columnheader">중위가격</span><span role="columnheader">평당가격</span><span role="columnheader">가격 범위</span><span role="columnheader">최근 분기</span></div>
            {property.areaPrices.map((area) => (
              <div role="row" key={area.key}>
                <span role="cell" data-label="전용면적">{area.areaM2.toFixed(1)}㎡</span>
                <span role="cell" data-label="환산평">{area.pyeong.toFixed(1)}평</span>
                <span role="cell" data-label="최근 거래"><b>{area.latestAmountLabel}</b><small>{area.latestContractDate || "거래일 확인 필요"}</small></span>
                <span role="cell" data-label="중위가격">{area.medianAmountLabel}</span>
                <span role="cell" data-label="평당가격">{area.perPyeongLabel}</span>
                <span role="cell" data-label="가격 범위">{area.lowLabel}–{area.highLabel}</span>
                <span role="cell" data-label="최근 분기">{area.quarterVolume}건<small>{area.sample.state === "sufficient" ? area.changeLabel || "비교 기준 없음" : "표본 부족"}</small></span>
              </div>
            ))}
          </div>
        ) : <AsyncState status="empty" title="평형별 거래가 없습니다" message="선택 기간에 신고된 거래가 확인되지 않았습니다." />}
      </section>

      <section className="analysis-living" aria-labelledby="analysis-living-title">
        <header>
          <div><h3 id="analysis-living-title">이 집에서는 어떤 생활을 누릴 수 있을까요?</h3><p>선택한 건물을 중심으로 확인된 시설과 직선거리를 보여줍니다.</p></div>
          <label>탐색 반경
            <select value={radius} onChange={(event) => onRadiusChange(Number(event.target.value))}>
              {[100, 200, 300, 500, 750, 1000].map((value) => <option key={value} value={value}>{value.toLocaleString()}m</option>)}
            </select>
          </label>
        </header>
        <ChipList label="생활권 시설 종류">
          {livingCategories.map((category) => (
            <Chip key={category.key} selected={selectedLivingCategory === category.key} onClick={() => onLivingCategoryChange(category.key)}>
              {category.icon}<span>{category.label}</span><small>{category.count === null ? "확인 중" : `${category.count}곳`}</small>
            </Chip>
          ))}
        </ChipList>
        <div className="analysis-living__workspace">
          <div className="analysis-living__map" aria-label={`${radius.toLocaleString()}미터 생활권 지도`}>{map}</div>
          <div className="analysis-facilities">
            {nearbyState !== "ready" ? <AsyncState status={nearbyState} onRetry={onRetryNearby} /> : facilities.length ? facilities.map((facility) => (
              <button type="button" key={facility.key} className={facility.selected ? "is-selected" : undefined} aria-pressed={facility.selected || false} onClick={() => onSelectFacility?.(facility.key)}>
                <MapPin aria-hidden="true" />
                <span><b>{facility.name}</b><small>{facility.category}</small></span>
                <span><strong>{facility.distanceLabel}</strong>{facility.travelTimeLabel && <small>{facility.travelTimeLabel}</small>}</span>
              </button>
            )) : <AsyncState status="empty" title="이 반경에서 확인된 시설이 없습니다" message="반경을 넓히거나 다른 생활 유형을 선택해보세요." />}
          </div>
        </div>
      </section>
    </Surface>
  );
}
