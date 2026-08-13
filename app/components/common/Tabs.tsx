"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { joinClassNames } from "./utils";

export interface TabItem<Value extends string = string> {
  value: Value;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<Value extends string = string> {
  items: Array<TabItem<Value>>;
  value: Value;
  onValueChange: (value: Value) => void;
  label: string;
  loading?: boolean;
  className?: string;
}

export function Tabs<Value extends string>({ items, value, onValueChange, label, loading = false, className }: TabsProps<Value>) {
  const generatedId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const requestedIndex = items.findIndex((item) => item.value === value && !item.disabled);
  const selectedIndex = requestedIndex >= 0 ? requestedIndex : items.findIndex((item) => !item.disabled);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (loading) return;
    const enabledIndexes = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
    if (!enabledIndexes.length) return;
    const enabledPosition = enabledIndexes.indexOf(currentIndex);
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = enabledIndexes[(enabledPosition + 1) % enabledIndexes.length];
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = enabledIndexes[(enabledPosition - 1 + enabledIndexes.length) % enabledIndexes.length];
    if (event.key === "Home") nextIndex = enabledIndexes[0];
    if (event.key === "End") nextIndex = enabledIndexes.at(-1);
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    onValueChange(nextItem.value);
    tabRefs.current[nextIndex]?.focus();
  }

  const activeItem = items[selectedIndex];

  return (
    <div className={joinClassNames("hmi-tabs", className)} aria-busy={loading || undefined}>
      <div className="hmi-tabs__list" role="tablist" aria-label={label}>
        {items.map((item, index) => {
          const selected = item.value === activeItem?.value;
          return (
            <button
              key={item.value}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`${generatedId}-tab-${index}`}
              type="button"
              role="tab"
              className="hmi-tab"
              aria-selected={selected}
              aria-controls={`${generatedId}-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled || loading}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => moveFocus(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          id={`${generatedId}-panel-${selectedIndex}`}
          className="hmi-tabs__panel"
          role="tabpanel"
          aria-labelledby={`${generatedId}-tab-${selectedIndex}`}
          tabIndex={0}
        >
          {activeItem.panel}
        </div>
      )}
    </div>
  );
}
