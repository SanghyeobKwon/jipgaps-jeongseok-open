"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { AsyncState, Button, Surface, Tabs, type AsyncStatus } from "@/app/components/common";
import { PriceBucketLegend, PropertyTypeIcon } from "./PropertyVisual";
import type { ResearchCell, ResearchPropertyRow, ResearchView } from "./types";

const RESEARCH_TABS: Array<{ value: ResearchView; label: string }> = [
  { value: "recent-decline", label: "최근 하락" },
  { value: "record-high", label: "최고가" },
  { value: "growth-leaders", label: "상승률 상위" },
  { value: "price-per-pyeong", label: "평당가격" },
  { value: "price-trend", label: "가격 변화" },
  { value: "complex-compare", label: "단지 비교" },
];

export const RESEARCH_VIEW_COPY: Record<ResearchView, { title: string; description: string }> = {
  "recent-decline": { title: "최근 하락", description: "같은 단지·면적 조건의 최근 분기와 직전 분기 중위가격을 비교합니다." },
  "record-high": { title: "최고가", description: "선택 기간에 신고된 최고 거래와 같은 평형의 최근 가격을 함께 봅니다." },
  "growth-leaders": { title: "상승률 상위", description: "비교 가능한 표본이 있는 같은 단지·면적의 분기 변화만 순위에 반영합니다." },
  "price-per-pyeong": { title: "평당가격", description: "전용면적 환산평을 기준으로 총가격 차이를 보정해 비교합니다." },
  "price-trend": { title: "가격 변화", description: "월 중위가격, 이동중위가격과 거래량을 같은 흐름에서 확인합니다." },
  "complex-compare": { title: "단지 비교", description: "동일 평형 또는 선택한 면적 구간 안에서 최대 4개 단지를 비교합니다." },
};

export interface ResearchAnalysisWorkspaceProps {
  view: ResearchView;
  onViewChange: (view: ResearchView) => void;
  rows: ResearchPropertyRow[];
  columnOrder: string[];
  onSelectProperty: (key: string) => void;
  visibleCount?: number;
  totalCount?: number;
  onLoadMore?: () => void;
  state?: AsyncStatus | "ready";
  stateMessage?: string;
  onRetry?: () => void;
  detail?: ReactNode;
  className?: string;
}

function SortIcon({ cell }: { cell: ResearchCell }) {
  if (!cell.sortDirection) return null;
  if (cell.sortDirection === "ascending") return <ArrowUp aria-hidden="true" />;
  if (cell.sortDirection === "descending") return <ArrowDown aria-hidden="true" />;
  return <ChevronsUpDown aria-hidden="true" />;
}

export function ResearchAnalysisWorkspace({
  view,
  onViewChange,
  rows,
  columnOrder,
  onSelectProperty,
  visibleCount = rows.length,
  totalCount = rows.length,
  onLoadMore,
  state = "ready",
  stateMessage,
  onRetry,
  detail,
  className,
}: ResearchAnalysisWorkspaceProps) {
  const copy = RESEARCH_VIEW_COPY[view];
  const headerCells = columnOrder.map((key) => rows.flatMap((row) => row.cells).find((cell) => cell.key === key)).filter(Boolean) as ResearchCell[];

  const panel = (
    <div className="analysis-research-panel">
      <header className="analysis-research-panel__heading">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <PriceBucketLegend />
      </header>

      {state !== "ready" && state !== "partial" ? (
        <AsyncState status={state} message={stateMessage} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <AsyncState status="empty" title="비교 가능한 거래가 없습니다" message="지역이나 주택 유형을 바꾸거나 조회 기간을 넓혀보세요." />
      ) : (
        <>
          {state === "partial" && <AsyncState status="partial" title="확인된 거래만 표시합니다" message={stateMessage} onRetry={onRetry} />}
          <div
            className="analysis-research-table"
            role="table"
            aria-label={`${copy.title} 분석 결과`}
            style={{ "--analysis-column-count": Math.max(columnOrder.length, 1) } as CSSProperties}
          >
            <div className="analysis-research-table__head" role="row">
              <span role="columnheader">순위</span>
              <span role="columnheader">단지</span>
              {headerCells.map((cell) => (
                <span key={cell.key} role="columnheader" aria-sort={cell.sortDirection} className={cell.numeric ? "is-numeric" : undefined}>
                  {cell.label}<SortIcon cell={cell} />
                </span>
              ))}
            </div>
            <div className="analysis-research-table__body" role="rowgroup">
              {rows.map((row) => (
                <button
                  type="button"
                  role="row"
                  key={row.key}
                  className={row.selected ? "is-selected" : undefined}
                  onClick={() => onSelectProperty(row.key)}
                >
                  <span role="cell" className="analysis-rank">{String(row.rank).padStart(2, "0")}</span>
                  <span role="cell" className="analysis-property-identity">
                    <PropertyTypeIcon type={row.propertyType} priceBucket={row.priceBucket} selected={row.selected} />
                    <span><b>{row.name}{row.selected && <span className="hmi-sr-only">, 현재 선택</span>}</b><small>{row.dong}</small></span>
                  </span>
                  {columnOrder.map((key) => {
                    const cell = row.cells.find((item) => item.key === key);
                    return (
                      <span
                        key={key}
                        role="cell"
                        data-label={cell?.label}
                        data-mobile-priority={cell?.mobilePriority || "detail"}
                        className={[cell?.numeric && "is-numeric", cell?.tone && `is-${cell.tone}`].filter(Boolean).join(" ")}
                      >
                        {cell?.value ?? "—"}
                      </span>
                    );
                  })}
                  <span className={`analysis-sample is-${row.sample.state}`} aria-label={`표본 ${row.sample.count}건`}>
                    {row.sample.state === "sufficient" ? `${row.sample.count}건` : row.sample.state === "partial" ? "일부 수집" : "표본 부족"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {visibleCount < totalCount && onLoadMore && (
            <div className="analysis-load-more">
              <Button variant="secondary" onClick={onLoadMore}>30개 더 보기</Button>
              <span>{visibleCount.toLocaleString()}개 표시 중 · 전체 {totalCount.toLocaleString()}개</span>
            </div>
          )}
          {visibleCount >= totalCount && totalCount > 30 && <p className="analysis-list-complete" role="status">모든 후보를 확인했습니다.</p>}
        </>
      )}
    </div>
  );

  return (
    <Surface className={["analysis-workspace", className].filter(Boolean).join(" ")} aria-label="가격 리서치">
      <Tabs
        className="analysis-view-tabs"
        label="가격 분석 종류"
        value={view}
        onValueChange={onViewChange}
        items={RESEARCH_TABS.map((tab) => ({ ...tab, panel }))}
      />
      {detail && <div className="analysis-workspace__detail">{detail}</div>}
    </Surface>
  );
}
