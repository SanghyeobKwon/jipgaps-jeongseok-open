"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export interface UseThemeOptions {
  storageKey?: string;
  defaultPreference?: ThemePreference;
  transitionClassName?: string;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme({
  storageKey = "jipgaps:theme",
  defaultPreference = "system",
  transitionClassName = "hmi-theme-transition",
}: UseThemeOptions = {}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(defaultPreference);
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>("light");
  const resolvedTheme = useMemo<ResolvedTheme>(() => preference === "system" ? systemPreference : preference, [preference, systemPreference]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemPreference = () => setSystemPreference(media.matches ? "dark" : "light");
    updateSystemPreference();
    media.addEventListener("change", updateSystemPreference);
    const storageTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (isThemePreference(stored)) setPreferenceState(stored);
      } catch {
        // Storage can be unavailable in privacy-restricted browsers.
      }
    }, 0);
    return () => {
      window.clearTimeout(storageTimer);
      media.removeEventListener("change", updateSystemPreference);
    };
  }, [storageKey]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    const root = document.documentElement;
    root.classList.add(transitionClassName);
    window.setTimeout(() => root.classList.remove(transitionClassName), 220);
    setPreferenceState(nextPreference);
    try {
      window.localStorage.setItem(storageKey, nextPreference);
    } catch {
      // Theme still works for the current session without storage.
    }
  }, [storageKey, transitionClassName]);

  return { preference, resolvedTheme, setPreference, systemTheme: systemTheme() } as const;
}
