import assert from "node:assert/strict";
import test from "node:test";
import { sortModelsNewestFirst } from "../src/models/sort.js";

test("sorts newer models first with stable title and id tie-breakers", () => {
  const sorted = sortModelsNewestFirst([
    { id: "z", title: "Zeta", updatedAt: 1 },
    { id: "b", title: "Alpha", updatedAt: 2 },
    { id: "a", title: "Alpha", updatedAt: 2 },
  ]);

  assert.deepEqual(
    sorted.map(({ id }) => id),
    ["a", "b", "z"],
  );
});
