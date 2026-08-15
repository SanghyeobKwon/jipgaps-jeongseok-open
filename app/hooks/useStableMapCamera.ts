"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapCamera } from "../lib/map/types";

export type StableMapCameraIntent =
  | { kind: "preserve"; camera: MapCamera | null }
  | { kind: "restore"; camera: MapCamera }
  | { kind: "fit"; scopeKey: string; reason: "initial-scope" | "scope-change" };

export function sameMapCamera(first: MapCamera | null | undefined, second: MapCamera | null | undefined) {
  if (!first || !second) return first === second;
  return first.contextKey === second.contextKey
    && first.level === second.level
    && Math.abs(first.center.lat - second.center.lat) < 0.0000001
    && Math.abs(first.center.lng - second.center.lng) < 0.0000001;
}

export function stableMapCameraIntent({
  previousScopeKey,
  nextScopeKey,
  camera,
  restoredCamera,
}: {
  previousScopeKey?: string;
  nextScopeKey: string;
  camera?: MapCamera | null;
  restoredCamera?: MapCamera | null;
}): StableMapCameraIntent {
  const normalizedRestore = restoredCamera
    ? { ...restoredCamera, contextKey: nextScopeKey, changedBy: "restore" as const }
    : null;
  const restoreMatchesScope = !previousScopeKey || restoredCamera?.contextKey === nextScopeKey;
  if (normalizedRestore && restoreMatchesScope && !sameMapCamera(camera, normalizedRestore)) {
    return { kind: "restore", camera: normalizedRestore };
  }
  if (!previousScopeKey) return { kind: "fit", scopeKey: nextScopeKey, reason: "initial-scope" };
  if (previousScopeKey !== nextScopeKey) return { kind: "fit", scopeKey: nextScopeKey, reason: "scope-change" };
  return { kind: "preserve", camera: camera ?? null };
}

export function useStableMapCamera({
  scopeKey,
  restoredCamera,
  throttleMs = 180,
  onReplace,
}: {
  scopeKey: string;
  restoredCamera?: MapCamera | null;
  throttleMs?: number;
  onReplace: (camera: MapCamera) => void;
}) {
  const scopeRef = useRef<string | undefined>(undefined);
  const cameraRef = useRef<MapCamera | null>(restoredCamera ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [intent, setIntent] = useState<StableMapCameraIntent>(() => stableMapCameraIntent({ nextScopeKey: scopeKey, restoredCamera }));

  useEffect(() => {
    if (scopeRef.current && scopeRef.current !== scopeKey && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const nextIntent = stableMapCameraIntent({
      previousScopeKey: scopeRef.current,
      nextScopeKey: scopeKey,
      camera: cameraRef.current,
      restoredCamera,
    });
    scopeRef.current = scopeKey;
    if (nextIntent.kind === "restore") cameraRef.current = nextIntent.camera;
    setIntent(nextIntent);
  }, [restoredCamera, scopeKey]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const scheduleReplace = useCallback((camera: MapCamera) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onReplace(camera), throttleMs);
  }, [onReplace, throttleMs]);

  const recordUserCamera = useCallback((next: Omit<MapCamera, "contextKey" | "changedBy">) => {
    const normalized: MapCamera = { ...next, contextKey: scopeKey, changedBy: "user" };
    if (sameMapCamera(cameraRef.current, normalized)) return false;
    cameraRef.current = normalized;
    setIntent({ kind: "preserve", camera: normalized });
    scheduleReplace(normalized);
    return true;
  }, [scheduleReplace, scopeKey]);

  const acceptFittedCamera = useCallback((camera: Omit<MapCamera, "contextKey" | "changedBy">) => {
    const normalized: MapCamera = { ...camera, contextKey: scopeKey, changedBy: "fit" };
    if (sameMapCamera(cameraRef.current, normalized)) return normalized;
    cameraRef.current = normalized;
    setIntent({ kind: "preserve", camera: normalized });
    scheduleReplace(normalized);
    return normalized;
  }, [scheduleReplace, scopeKey]);

  const preserveCamera = useCallback(() => cameraRef.current, []);

  return { intent, recordUserCamera, acceptFittedCamera, preserveCamera };
}
