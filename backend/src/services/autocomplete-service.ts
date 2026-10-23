import type { LonLat, Suggestion } from "../types/geo.js";
import { UpstreamError } from "../utils/upstream-error.js";
import { autocomplete } from "./geoapify-facade.js";
import { mergeSuggestions } from "./suggestions.js";
import { searchPlaces } from "./wikidata-facade.js";

export type SuggestionQuery = {
  text: string;
  bias?: LonLat | undefined;
  lang: string;
};

export type SuggestionResponse = {
  results: Suggestion[];
  // True when a source failed, so the list may be missing results
  partial: boolean;
};

// Tunable values (see Configuration in the spec). Each source gets its own
// deadline, so one slow source never holds up the dropdown.
const SOURCE_TIMEOUT_MS = 4_000;
// Exported so scripts/suggestion-report.ts always uses the same numbers
export const CANDIDATES_PER_SOURCE = 6;
export const MAX_SUGGESTIONS = 8;
// A digit in the text means a street address. Wikidata has no addresses and
// only adds wrong matches (e.g. a building with another house number), so
// it is not asked at all.
const ADDRESS_HINT = /\d/;

// The two sources, passed in as a parameter so tests can replace them with
// fakes. The controller never passes it, so the real Facades are used.
export type SuggestionSources = {
  geoapify: typeof autocomplete;
  wikidata: typeof searchPlaces;
  timeoutMs: number;
};

const realSources: SuggestionSources = {
  geoapify: autocomplete,
  wikidata: searchPlaces,
  timeoutMs: SOURCE_TIMEOUT_MS,
};

// Rejects as soon as `signal` fires, even if `promise` never settles. The
// Facades also stop their request on the signal; this makes the deadline
// hold even if a source ignored it.
function withTimeout<T>(promise: Promise<T>, signal: AbortSignal, source: string, timeoutMs: number): Promise<T> {
  const timedOut = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () =>
      reject(new UpstreamError("UNAVAILABLE", `${source} timed out after ${timeoutMs} ms`)),
    );
  });
  return Promise.race([promise, timedOut]);
}

// Only the message: it never contains an API key or a full upstream URL,
// because the Facades write their messages that way
function logFailure(source: string, reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.warn(`Suggestion source ${source} failed: ${message}`);
}

// Asks Geoapify and Wikidata at the same time and merges their answers.
// Promise.allSettled waits for both and never rejects, so one failing
// source cannot cancel the other.
export async function getSuggestions(
  query: SuggestionQuery,
  sources: SuggestionSources = realSources,
): Promise<SuggestionResponse> {
  const { timeoutMs } = sources;
  const askWikidata = !ADDRESS_HINT.test(query.text);
  const geoapifySignal = AbortSignal.timeout(timeoutMs);
  const wikidataSignal = AbortSignal.timeout(timeoutMs);

  const [geoapifyOutcome, wikidataOutcome] = await Promise.allSettled([
    withTimeout(
      sources.geoapify(query.text, {
        bias: query.bias,
        lang: query.lang,
        limit: CANDIDATES_PER_SOURCE,
        signal: geoapifySignal,
      }),
      geoapifySignal,
      "geoapify",
      timeoutMs,
    ),
    // Not asked counts as an empty answer, not as a failure
    askWikidata
      ? withTimeout(
          sources.wikidata(query.text, { lang: query.lang, limit: CANDIDATES_PER_SOURCE, signal: wikidataSignal }),
          wikidataSignal,
          "wikidata",
          timeoutMs,
        )
      : Promise.resolve([]),
  ]);

  if (geoapifyOutcome.status === "rejected") logFailure("geoapify", geoapifyOutcome.reason);
  if (wikidataOutcome.status === "rejected") logFailure("wikidata", wikidataOutcome.reason);

  // Every source we asked failed, so there is nothing to show. The error
  // handler turns these into 503 with UPSTREAM_RATE_LIMITED or
  // UPSTREAM_UNAVAILABLE.
  const allAskedFailed =
    geoapifyOutcome.status === "rejected" && (!askWikidata || wikidataOutcome.status === "rejected");
  if (allAskedFailed) {
    const geoapifyQuota =
      geoapifyOutcome.reason instanceof UpstreamError && geoapifyOutcome.reason.kind === "RATE_LIMITED";
    throw geoapifyQuota
      ? new UpstreamError("RATE_LIMITED", "All suggestion sources failed; Geoapify is rate limited")
      : new UpstreamError("UNAVAILABLE", "All suggestion sources failed");
  }

  // A failed source counts as an empty list
  const geoapifyList = geoapifyOutcome.status === "fulfilled" ? geoapifyOutcome.value : [];
  const wikidataList = wikidataOutcome.status === "fulfilled" ? wikidataOutcome.value : [];

  return {
    results: mergeSuggestions(geoapifyList, wikidataList, MAX_SUGGESTIONS),
    partial: geoapifyOutcome.status === "rejected" || wikidataOutcome.status === "rejected",
  };
}
