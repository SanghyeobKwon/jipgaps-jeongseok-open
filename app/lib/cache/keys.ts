import { createHash } from "node:crypto";

const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, entry]) => [name, canonicalize(entry)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("캐시 키에는 유한한 숫자만 사용할 수 있습니다.");
  }
  return value;
}

export function normalizeCacheNamespace(namespace: string): string {
  const value = namespace.trim().toLowerCase();
  if (!NAMESPACE_PATTERN.test(value)) {
    throw new Error("캐시 namespace는 영문 소문자, 숫자, 점, 밑줄, 콜론, 하이픈만 사용할 수 있습니다.");
  }
  return value;
}

export function normalizeCacheKey(key: string | Record<string, unknown>): string {
  const raw = typeof key === "string" ? key.trim() : JSON.stringify(canonicalize(key));
  if (!raw) throw new Error("캐시 키가 비어 있습니다.");
  if (raw.length <= 240) return raw;
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}
