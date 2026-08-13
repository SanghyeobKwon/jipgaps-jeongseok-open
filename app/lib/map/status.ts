import type { KakaoFailureKind } from "./kakao-local";
import type { MapDataStatus } from "./types";

export function deriveMapStatus(successes: number, completedEmpty: number, failures: KakaoFailureKind[]): MapDataStatus {
  if (successes > 0) return failures.length || completedEmpty ? "partial" : "success";
  if (failures.length && completedEmpty > 0) return "partial";
  if (failures.length && failures.every((failure) => failure === "quota")) return "quota";
  if (failures.length && completedEmpty === 0) return "error";
  return "empty";
}

export function statusHttpCode(status: MapDataStatus, failures: KakaoFailureKind[] = []) {
  if (status === "quota") return 429;
  if (status !== "error") return 200;
  if (failures.includes("timeout")) return 504;
  return failures.includes("authentication") ? 502 : 502;
}
