export type MapScope = {
  sidoCode: string;
  sidoName: string;
  sigunguCode?: string;
  sigunguName?: string;
  /** Kakao Local API administrative-dong code (`h_code`). */
  adminDongCode?: string;
  adminDongName?: string;
  /** Kakao Local API legal-dong code (`b_code`). */
  legalDongCode?: string;
  legalDongName?: string;
  /** SGIS boundary feature code. This is not interchangeable with `h_code`. */
  boundaryAdminCode?: string;
  propertyKey?: string;
};

export type RegionLevel = "sido" | "sigungu" | "emd";

/**
 * Single source of truth shared by a boundary click, search result and region
 * controls. Codes are authoritative; names are display values only.
 */
export type RegionSelection = {
  level: RegionLevel;
  sidoCode: string;
  sidoName: string;
  sigunguCode?: string;
  sigunguName?: string;
  adminDongCode?: string;
  adminDongName?: string;
  legalDongCode?: string;
  legalDongName?: string;
  boundaryAdminCode?: string;
  propertyKey?: string;
  camera?: { lat: number; lng: number; level: number };
};

export type RegionNavigationChange = {
  selection: RegionSelection;
  cleared: Array<"sigungu" | "dong" | "property" | "area" | "tradePy">;
  history: "push" | "replace";
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

export type MapDataStatus = "success" | "partial" | "empty" | "quota" | "error";

export type MapFailureKind =
  | "authentication"
  | "boundary"
  | "invalid_coordinate"
  | "quota"
  | "scope_mismatch"
  | "timeout"
  | "upstream";

export type MapMarkerState = {
  kind: "marker";
  id: string;
  entityId: string;
  state: "default" | "hovered" | "selected" | "rejected";
  clusterable: boolean;
  priority: number;
};

export type MapClusterState = {
  kind: "cluster";
  id: string;
  memberIds: string[];
  count: number;
  center: { lat: number; lng: number };
  priceRange?: { min: number; max: number };
  containsSelected: boolean;
};

export type MapSelectionState = {
  scope: MapScope;
  selectedEntityId?: string;
  selectedMarkerId?: string;
};

export type MapFallbackContract = {
  markerAllowed: boolean;
  reason: "verified_coordinate" | "no_verified_coordinate" | "upstream_failure";
};

export type MapTopologyNode = {
  id: string;
  boundaryCode: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
};

export type MapAdjacencyEdge = {
  from: string;
  to: string;
  relation: "touches" | "near";
  crossesSigungu: boolean;
};

export type MapLoadState =
  | { status: "loading" }
  | { status: "ready"; partial: boolean }
  | { status: "empty"; verified: true }
  | { status: "quota"; retryable: boolean }
  | { status: "error"; kind: "boundary" | "sdk" | "geocode" | "quota" | "trades"; retryable: boolean };

