import test from "node:test";
import assert from "node:assert/strict";
import { selectRegionDocuments, validateRegionScope } from "../../app/lib/map/region-codes.ts";

const regions = selectRegionDocuments([
  { region_type: "H", code: "1168064000", region_1depth_name: "서울특별시", region_2depth_name: "강남구", region_3depth_name: "역삼1동" },
  { region_type: "B", code: "1168010100", region_1depth_name: "서울특별시", region_2depth_name: "강남구", region_3depth_name: "역삼동" },
]);

test("validates distinct h_code and b_code without name regex", () => {
  assert.equal(validateRegionScope({ sidoCode: "11", sigunguCode: "11680", adminDongCode: "1168064000", legalDongCode: "1168010100", adminDongName: "역삼1동", legalDongName: "역삼동" }, regions).valid, true);
  assert.equal(validateRegionScope({}, regions).adminDongName, "역삼1동");
  assert.equal(validateRegionScope({}, regions).legalDongName, "역삼동");
});
test("rejects code mismatch even when a similar name could match", () => {
  const result = validateRegionScope({ sigunguCode: "11500", legalDongName: "역삼동" }, regions);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("sigungu_code_mismatch"));
});
