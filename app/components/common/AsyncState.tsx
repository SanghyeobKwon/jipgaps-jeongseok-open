"use client";

import type { ReactNode } from "react";
import { joinClassNames } from "./utils";

export type AsyncStatus = "loading" | "empty" | "error" | "partial" | "low-sample";

const DEFAULT_COPY: Record<AsyncStatus, { title: string; message: string }> = {
  loading: { title: "데이터를 불러오는 중입니다", message: "잠시만 기다려주세요." },
  empty: { title: "표시할 데이터가 없습니다", message: "조건을 바꾸거나 범위를 넓혀 다시 확인해보세요." },
  error: { title: "데이터를 불러오지 못했습니다", message: "연결 상태를 확인한 뒤 다시 시도해주세요." },
  partial: { title: "일부 데이터만 확인됐습니다", message: "확인된 범위만 표시하며 나머지는 집계에서 제외했습니다." },
  "low-sample": { title: "표본이 부족합니다", message: "현재 결과만으로 가격 변화를 단정하기 어렵습니다." },
};

export interface AsyncStateProps {
  status: AsyncStatus;
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

function StateMark({ status }: { status: AsyncStatus }) {
  if (status === "loading") return <span className="hmi-async-state__spinner" aria-hidden="true" />;
  const path = status === "empty"
    ? "M5 7h14v11H5zM8 4h8"
    : status === "error"
      ? "M12 4v9m0 4v.5"
      : "M12 5v8m0 4v.5";
  return <span className="hmi-async-state__mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

export function AsyncState({ status, title, message, onRetry, retryLabel = "다시 불러오기", className }: AsyncStateProps) {
  const copy = DEFAULT_COPY[status];
  const isError = status === "error";

  return (
    <div
      className={joinClassNames("hmi-async-state", `hmi-async-state--${status}`, className)}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={status === "loading" || undefined}
    >
      <StateMark status={status} />
      <div className="hmi-async-state__copy">
        <strong>{title ?? copy.title}</strong>
        <p>{message ?? copy.message}</p>
        {onRetry && <button type="button" className="hmi-async-state__retry" onClick={onRetry}>{retryLabel}</button>}
      </div>
    </div>
  );
}
