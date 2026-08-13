import test from "node:test";
import assert from "node:assert/strict";
import { geometryLabelPoint, pointInGeometry, pointInPolygon } from "../../app/lib/map/geometry.ts";

test("polygon includes interior and boundary but excludes exterior", () => {
  const polygon = [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]];
  assert.equal(pointInPolygon([2, 2], polygon), true);
  assert.equal(pointInPolygon([0, 2], polygon), true);
  assert.equal(pointInPolygon([5, 2], polygon), false);
});
test("visual label point remains inside concave polygon and outside its hole", () => {
  const geometry = { type: "Polygon", coordinates: [[[0, 0], [6, 0], [6, 1], [1, 1], [1, 6], [0, 6], [0, 0]], [[0.2, 2], [0.8, 2], [0.8, 3], [0.2, 3], [0.2, 2]]] };
  const point = geometryLabelPoint(geometry, 0.005);
  assert.ok(point);
  assert.equal(pointInGeometry(point, geometry), true);
});

test("visual label point uses an actual multipolygon member", () => {
  const geometry = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]]] };
  const point = geometryLabelPoint(geometry, 0.005);
  assert.ok(point);
  assert.equal(pointInGeometry(point, geometry), true);
  assert.ok(point[0] >= 10);
});
test("polygon holes and multipolygons are handled", () => {
  const coordinates = [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]];
  assert.equal(pointInPolygon([1.5, 1.5], coordinates), false);
  assert.equal(pointInGeometry([11, 11], { type: "MultiPolygon", coordinates: [coordinates, [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]]] }), true);
});
