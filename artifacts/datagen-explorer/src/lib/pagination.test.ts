import test from "node:test";
import assert from "node:assert/strict";
import { getPaginationItems } from "./pagination";

test("pagination shows every page when the page count is compact", () => {
  assert.deepEqual(getPaginationItems({ currentPage: 2, totalPages: 5 }), [1, 2, 3, 4, 5]);
});

test("pagination keeps the current page surrounded for long result sets", () => {
  assert.deepEqual(getPaginationItems({ currentPage: 7, totalPages: 12 }), [1, "ellipsis-start", 6, 7, 8, "ellipsis-end", 12]);
});

test("pagination keeps the first pages visible near the beginning", () => {
  assert.deepEqual(getPaginationItems({ currentPage: 1, totalPages: 12 }), [1, 2, 3, "ellipsis-end", 12]);
});

test("pagination keeps the last pages visible near the end", () => {
  assert.deepEqual(getPaginationItems({ currentPage: 12, totalPages: 12 }), [1, "ellipsis-start", 10, 11, 12]);
});
