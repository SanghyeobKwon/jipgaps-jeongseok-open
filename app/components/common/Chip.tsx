"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { joinClassNames } from "./utils";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  selected: boolean;
  leadingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, leadingIcon, loading = false, loadingLabel = "처리 중", disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} aria-pressed={selected} className={joinClassNames("hmi-chip", loading && "hmi-chip--loading", className)}>
      {loading ? <span className="hmi-button__spinner" aria-hidden="true" /> : leadingIcon}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
});

export function ChipList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={joinClassNames("hmi-chip-list", className)} role="group" aria-label={label}>{children}</div>;
}
