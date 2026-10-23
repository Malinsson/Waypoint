import { z } from "zod";
import { config } from "../config/env.js";
import type { LonLat, Suggestion } from "../types/geo.js";
import { UpstreamError, type UpstreamErrorKind } from "../utils/upstream-error.js";

// Facade: the only file that knows Wikidata's API, its parameters and its
// response shapes, including its latitude/longitude fields. The rest of the
// backend only sees our own Suggestion type.

const BASE_URL = "https://www.wikidata.org/w/api.php";
// One deadline for the whole search (both requests), the same 4 seconds
// every suggestion source gets (see Configuration in the spec)
const TIMEOUT_MS = 4_000;
const DEFAULT_LIMIT = 6;
// Coordinates on other bodies (the Moon, Mars, ...) use another globe
const EARTH_GLOBE = "http://www.wikidata.org/entity/Q2";

// Zod schemas for the parts of Wikidata's responses we use. Wikidata can
// report API errors with status 200 and an `error` field instead of these
// fields, so a failed parse also covers that case.
const searchResponseSchema = z.object({
  query: z.object({
    // `title` holds the item id, e.g. "Q1413270"
    search: z.array(z.object({ title: z.string() })),
  }),
});

const textSchema = z.object({ value: z.string() });

const coordinateStatementSchema = z.object({
  rank: z.enum(["preferred", "normal", "deprecated"]),
  mainsnak: z.object({
    // Missing for "unknown value" and "no value" statements
    datavalue: z
      .object({
        value: z.object({ latitude: z.number(), longitude: z.number(), globe: z.string() }),
      })
      .optional(),
  }),
});
type CoordinateStatement = z.infer<typeof coordinateStatementSchema>;

const entitiesResponseSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      // All optional: an unknown id comes back without them, and an item
      // may lack a label, a description or coordinates in our language
      labels: z.record(z.string(), textSchema).optional(),
      descriptions: z.record(z.string(), textSchema).optional(),
      // Only P625 (coordinates) is read; Zod drops all other properties
      claims: z.object({ P625: z.array(coordinateStatementSchema).optional() }).optional(),
    }),
  ),
});

// Characters with a meaning in Wikidata's search syntax: quotes start a
// phrase, a colon starts a keyword such as haswbstatement:, and a pipe
// means "or". Replacing them keeps the user's text plain text.
export function sanitizeSearchText(text: string): string {
  return text.replace(/[":|]/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSearchParams(cleanText: string, limit: number): Record<string, string> {
  return {
    action: "query",
    list: "search",
    // Only items that have coordinates (property P625)
    srsearch: `${cleanText} haswbstatement:P625`,
    // Namespace 0 holds the items themselves
    srnamespace: "0",
    srlimit: String(limit),
    format: "json",
  };
}

export function buildEntitiesParams(ids: string[], lang: string): Record<string, string> {
  return {
    action: "wbgetentities",
    // One request for all ids (the API accepts up to 50)
    ids: ids.join("|"),
    props: "labels|descriptions|claims",
    languages: lang,
    format: "json",
  };
}

// The coordinate to use from an item's P625 statements: Earth only, the
// statement Wikidata marks as preferred if there is one, otherwise the first
// that is not deprecated. The only place Wikidata's latitude/longitude
// fields are read, and where they become our [lon, lat] order.
export function pickCoordinate(statements: CoordinateStatement[]): LonLat | undefined {
  const usable = statements.filter(
    (statement) => statement.rank !== "deprecated" && statement.mainsnak.datavalue?.value.globe === EARTH_GLOBE,
  );
  const chosen = usable.find((statement) => statement.rank === "preferred") ?? usable[0];
  const value = chosen?.mainsnak.datavalue?.value;
  return value ? [value.longitude, value.latitude] : undefined;
}

// Sends a GET request and returns the parsed JSON. Every failure becomes an
// UpstreamError, so callers never deal with fetch or HTTP details.
async function getJson(params: Record<string, string>, signal: AbortSignal): Promise<unknown> {
  // URLSearchParams encodes every value, so the user's text is sent as data
  const url = new URL(BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    // Wikimedia asks every API client to identify itself with a contact
    response = await fetch(url, { headers: { "User-Agent": config.wikidataUserAgent }, signal });
  } catch (err) {
    // Network failure, timeout, or the caller cancelled the search
    const reason = err instanceof Error ? err.message : String(err);
    throw new UpstreamError("UNAVAILABLE", `Wikidata ${params.action} request failed: ${reason}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const kind: UpstreamErrorKind = response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
    throw new UpstreamError(kind, `Wikidata ${params.action} returned ${response.status}: ${body.slice(0, 300)}`);
  }

  try {
    return await response.json();
  } catch {
    throw new UpstreamError("UNAVAILABLE", `Wikidata ${params.action} returned invalid JSON`);
  }
}

function parseResponse<T>(schema: z.ZodType<T>, data: unknown, action: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new UpstreamError("UNAVAILABLE", `Wikidata ${action} returned an unexpected shape: ${result.error.message}`);
  }
  return result.data;
}

// Finding places takes two requests, because search results have no
// coordinates: first search for matching item ids, then fetch labels,
// descriptions and coordinates for all of them at once.
export async function searchPlaces(
  text: string,
  options: { lang?: string | undefined; limit?: number | undefined; signal?: AbortSignal | undefined } = {},
): Promise<Suggestion[]> {
  const lang = options.lang ?? "en";
  const cleanText = sanitizeSearchText(text);
  // Text made only of quotes, colons or pipes: searching for nothing but
  // "haswbstatement:P625" would return random places
  if (cleanText === "") return [];

  // Stops both requests when the deadline passes or the caller cancels
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  const searchData = await getJson(buildSearchParams(cleanText, options.limit ?? DEFAULT_LIMIT), signal);
  const ids = parseResponse(searchResponseSchema, searchData, "search").query.search.map((hit) => hit.title);
  if (ids.length === 0) return [];

  const entitiesData = await getJson(buildEntitiesParams(ids, lang), signal);
  const { entities } = parseResponse(entitiesResponseSchema, entitiesData, "wbgetentities");

  // Walk the ids in search order, so Wikidata's ranking is kept
  const suggestions: Suggestion[] = [];
  for (const id of ids) {
    const entity = entities[id];
    const label = entity?.labels?.[lang]?.value;
    const location = pickCoordinate(entity?.claims?.P625 ?? []);
    // Without a name in the user's language or a place on Earth, the row
    // would be useless in the dropdown
    if (!label || !location) continue;

    const description = entity.descriptions?.[lang]?.value;
    suggestions.push({
      id: `wd:${id}`,
      label,
      ...(description && { description }),
      location,
      kind: "poi",
      source: "wikidata",
    });
  }
  return suggestions;
}
