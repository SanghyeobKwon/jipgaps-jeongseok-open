export type MapScope = {
  sidoCode: string;
  sidoName: string;
  sigunguCode?: string;
  sigunguName?: string;
  adminDongCode?: string;
  adminDongName?: string;
  legalDongCode?: string;
  legalDongName?: string;
  propertyKey?: string;
};

export type MapCamera = {
  contextKey: string;
  center: { lat: number; lng: number };
  level: number;
  changedBy: "fit" | "user" | "restore";
};

export type MapEntity = {
  id: string;
  scope: "selected" | "neighbor";
  lat: number;
  lng: number;
  propertyType: string;
  lastAmount: number;
  tradeCount: number;
  validation: "verified" | "rejected" | "unverified";
};

export type MapLoadState =
  | { status: "loading" }
  | { status: "ready"; partial: boolean }
  | { status: "empty"; verified: true }
  | { status: "error"; kind: "boundary" | "sdk" | "geocode" | "quota" | "trades"; retryable: boolean };

