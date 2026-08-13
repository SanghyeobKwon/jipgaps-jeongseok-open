import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { joinClassNames } from "./utils";

export type SurfaceVariant = "plain" | "section" | "inset";

export type SurfaceProps<T extends ElementType = "section"> = {
  as?: T;
  variant?: SurfaceVariant;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "section">({
  as,
  variant = "plain",
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? "section";
  return <Component {...props} className={joinClassNames("hmi-surface", `hmi-surface--${variant}`, className)}>{children}</Component>;
}
