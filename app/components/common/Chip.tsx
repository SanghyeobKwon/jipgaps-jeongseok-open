"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { joinClassNames } from "./utils";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  selected: boolean;
  leadingIcon?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, leadingIcon, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} aria-pressed={selected} className={joinClassNames("hmi-chip", className)}>
      {leadingIcon}
      <span>{children}</span>
    </button>
  );
});

export function ChipList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={joinClassNames("hmi-chip-list", className)} role="group" aria-label={label}>{children}</div>;
}
