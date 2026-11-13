import { test } from "node:test";
import assert from "node:assert/strict";

import { pageMeta, paginationQuerySchema, skipFor } from "../src/utils/pagination.js";

test("pagination defaults to page 1 with 10 items", () => {
  assert.deepEqual(paginationQuerySchema.parse({}), { page: 1, limit: 10 });
});

test("pagination accepts numbers sent as query strings", () => {
  assert.deepEqual(paginationQuerySchema.parse({ page: "2", limit: "15" }), { page: 2, limit: 15 });
});

test("pagination rejects page 0, non-numbers and a limit above 50", () => {
  assert.throws(() => paginationQuerySchema.parse({ page: "0" }));
  assert.throws(() => paginationQuerySchema.parse({ page: "abc" }));
  assert.throws(() => paginationQuerySchema.parse({ limit: "51" }));
});

test("skipFor and pageMeta: 25 items at 10 per page gives 3 pages", () => {
  assert.equal(skipFor({ page: 2, limit: 10 }), 10);
  assert.equal(pageMeta({ page: 2, limit: 10 }, 25).hasMore, true);
  assert.equal(pageMeta({ page: 3, limit: 10 }, 25).hasMore, false);
  assert.equal(pageMeta({ page: 1, limit: 10 }, 10).hasMore, false);
});
