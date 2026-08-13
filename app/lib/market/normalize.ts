import type { AreaKind, AreaMeasurement, PropertyType, TradeRecord } from "./types";
import type { RawMolitFields } from "./molit";

const M2_PER_PYEONG = 3.3058;

function numberValue(value = ""): number | null {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function areaMeasurement(row: RawMolitFields, type: PropertyType): AreaMeasurement {
  const candidates: Array<[string, AreaKind]> = type === "apt" || type === "rowhouse" || type === "officetel"
    ? [["excluUseAr", "exclusive"]]
    : type === "house"
      ? [["totalFloorAr", "grossFloor"], ["buildingAr", "building"], ["plottageAr", "land"]]
      : [["buildingAr", "building"], ["totalFloorAr", "grossFloor"], ["plottageAr", "land"]];
  for (const [field, kind] of candidates) {
    const valueM2 = numberValue(row[field]);
    if (valueM2 !== null && valueM2 > 0) return { valueM2, pyeongEquivalent: valueM2 / M2_PER_PYEONG, kind };
  }
  return { valueM2: null, pyeongEquivalent: null, kind: "unknown" };
}

function validDate(year: string, month: string, day: string): string | null {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(Date.UTC(Number(year), monthNumber - 1, dayNumber));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) return null;
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
}

export function isCancelledMolitRow(row: RawMolitFields): boolean {
  return row.cdealType?.trim().toUpperCase() === "O" || Boolean(row.cdealDay?.trim());
}

export function normalizeMolitTrade(row: RawMolitFields, type: PropertyType, index: number): TradeRecord | null {
  const date = validDate(row.dealYear || "", row.dealMonth || "", row.dealDay || "");
  const amount = numberValue(row.dealAmount);
  if (!date || amount === null || amount <= 0) return null;
  const dong = row.umdNm?.trim() || "";
  const buildingDong = row.aptDong?.trim() || "";
  const jibun = row.jibun?.trim() || "";
  const suppliedName = row.aptNm || row.mhouseNm || row.offiNm || "";
  const usage = row.buildingUse || row.buildingType || row.houseType || "건물";
  const name = suppliedName.trim() || `${dong} ${jibun} ${usage}`.replace(/\s+/g, " ").trim();
  const measuredArea = areaMeasurement(row, type);
  const area = measuredArea.valueM2 ?? 0;
  const propertyKey = `${name}|${dong}|${jibun}`;
  const floor = numberValue(row.floor);
  const buildYear = numberValue(row.buildYear);
  const cancelled = isCancelledMolitRow(row);
  return {
    id: `${type}-${date.replaceAll("-", "")}-${row.sggCd || ""}-${index}-${amount}`,
    date,
    amount,
    area,
    floor: floor === null ? null : floor,
    name,
    propertyKey,
    dong,
    buildingDong,
    jibun,
    buildYear: buildYear === null ? null : buildYear,
    propertyType: type,
    dealingType: row.dealingGbn || "",
    cancelled,
    amountManwon: amount,
    contractDate: date,
    areaMeasurement: measuredArea,
  };
}
