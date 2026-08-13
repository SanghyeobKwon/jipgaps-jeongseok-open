import test from "node:test";
import assert from "node:assert/strict";
import { boundariesTouch, buildAdjacencyContract } from "../../app/lib/map/topology.ts";

const feature = (coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coordinates] } });
const left = feature([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
const right = feature([[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]);
const far = feature([[3, 0], [4, 0], [4, 1], [3, 1], [3, 0]]);

test("builds adjacency from shared boundary topology", () => {
  assert.equal(boundariesTouch(left, right), true);
  assert.equal(boundariesTouch(left, far), false);
  const node = (id, sigunguCode) => ({ id, boundaryCode: id, sidoCode: "11", sigunguCode, name: id });
  const graph = buildAdjacencyContract([{ node: node("a", "11110"), feature: left }, { node: node("b", "11140"), feature: right }, { node: node("c", "11140"), feature: far }]);
  assert.deepEqual(graph.edges, [{ from: "a", to: "b", relation: "touches", crossesSigungu: true }]);
});
