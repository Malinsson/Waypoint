import type { LonLat, Suggestion } from "../types/geo.js";
import { autocomplete } from "./geoapify-facade.js";

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

const MAX_SUGGESTIONS = 8;

// Asks every suggestion source at the same time. Promise.allSettled waits
// for all of them and never rejects, so one failing source cannot cancel
// the others. Only Geoapify exists so far; Wikidata is added to `lookups`
// in a later step and the merge step then replaces the flat() below.
export async function getSuggestions(query: SuggestionQuery): Promise<SuggestionResponse> {
  const lookups = [autocomplete(query.text, { bias: query.bias, lang: query.lang })];

  const outcomes = await Promise.allSettled(lookups);
  const succeeded = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const failed = outcomes.filter((outcome) => outcome.status === "rejected");

  // With no list at all there is nothing to show. Rethrowing lets the
  // central error handler log it and pick the right 503 code.
  if (succeeded.length === 0) {
    throw failed[0]!.reason;
  }

  // Partial answer: the user still gets results, so only log the failure
  for (const outcome of failed) {
    console.error("Suggestion source failed:", outcome.reason);
  }

  return {
    results: succeeded.flatMap((outcome) => outcome.value).slice(0, MAX_SUGGESTIONS),
    partial: failed.length > 0,
  };
}
