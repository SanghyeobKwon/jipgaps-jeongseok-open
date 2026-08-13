"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { joinClassNames } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  selected?: boolean;
  wide?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    loadingLabel = "처리 중",
    selected,
    wide = false,
    leadingIcon,
    trailingIcon,
    className,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-pressed={selected}
      className={joinClassNames(
        "hmi-button",
        `hmi-button--${variant}`,
        loading && "hmi-button--loading",
        wide && "hmi-button--wide",
        className,
      )}
    >
      {loading ? <span className="hmi-button__spinner" aria-hidden="true" /> : leadingIcon}
      <span>{loading ? loadingLabel : children}</span>
      {!loading && trailingIcon}
    </button>
  );
});
