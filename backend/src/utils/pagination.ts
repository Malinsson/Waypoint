import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// Query strings are always text, so coerce turns "2" into 2 before validating.
export const paginationQuerySchema = z.object({
  page: z.coerce.number("Page must be a number").int("Page must be a whole number").min(1, "Page must be at least 1").default(1),
  limit: z.coerce.number("Limit must be a number").int("Limit must be a whole number").min(1, "Limit must be at least 1").max(MAX_PAGE_SIZE, `Limit must be at most ${MAX_PAGE_SIZE}`).default(DEFAULT_PAGE_SIZE),
});

export type Pagination = z.infer<typeof paginationQuerySchema>;

export function skipFor({ page, limit }: Pagination): number {
  return (page - 1) * limit;
}

// hasMore lets the frontend decide whether to show "Load more" without
// doing the arithmetic itself.
export function pageMeta({ page, limit }: Pagination, total: number) {
  return { page, limit, total, hasMore: page * limit < total };
}
