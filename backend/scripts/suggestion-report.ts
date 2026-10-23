// Dev-only report for tuning the suggestion merge (Step 5). For each text
// below it asks Geoapify and Wikidata directly, merges the lists, and prints
// what each source and the merged dropdown would show.
//
// Uses real quota on every run: one Geoapify request and up to two
// Wikidata requests per text (18 texts: 18 Geoapify, up to 36 Wikidata).
// Not part of the Express app or the build.
// Run with: npm run report:suggestions
// Only some texts: npm run report:suggestions -- Gothenburg Aarhus Bodø
import { CANDIDATES_PER_SOURCE, MAX_SUGGESTIONS } from "../src/services/autocomplete-service.js";
import { autocomplete } from "../src/services/geoapify-facade.js";
import {
  geoapifyName,
  haversineMeters,
  MAX_MERGE_DISTANCE_METERS,
  mergeSuggestions,
  normalizeName,
} from "../src/services/suggestions.js";
import { searchPlaces } from "../src/services/wikidata-facade.js";
import type { Suggestion } from "../src/types/geo.js";

const SEARCH_TEXTS = [
  "Liseberg",
  "Stockholm",
  "Drottninggatan 1 Stockholm",
  "Göteborg",
  "Gothenburg",
  "Malmö",
  "Malmo",
  "Kebnekaise",
  "Stockholm Central Station",
  "Vasa Museum",
  "Tromsø",
  "Tromso",
  "Ålesund",
  "Bodø",
  "København",
  "Copenhagen",
  "Aarhus",
  "Århus",
];
// Spaces out the texts, to stay gentle with Wikidata's public API
const PAUSE_BETWEEN_TEXTS_MS = 2_000;
const LANG = "en";

// Texts given on the command line replace the list above. NFC turns a
// letter typed as base letter + mark (as some terminals send it) into the
// single character, so "Bodø" is the same text however it was typed.
const requestedTexts = process.argv
  .slice(2)
  .map((text) => text.normalize("NFC").trim())
  .filter((text) => text !== "");
const textsToRun = requestedTexts.length > 0 ? requestedTexts : SEARCH_TEXTS;

const COLUMNS: { title: string; width: number; value: (suggestion: Suggestion, index: number) => string }[] = [
  { title: "#", width: 3, value: (_suggestion, index) => String(index + 1) },
  { title: "label", width: 45, value: (suggestion) => suggestion.label },
  { title: "kind", width: 8, value: (suggestion) => suggestion.kind },
  { title: "source", width: 9, value: (suggestion) => suggestion.source },
  { title: "description", width: 45, value: (suggestion) => suggestion.description ?? "" },
];

// Cuts long values so the columns stay aligned
function cell(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

function printTable(title: string, suggestions: Suggestion[]): void {
  console.log(`\n  ${title}`);
  if (suggestions.length === 0) {
    console.log("    (none)");
    return;
  }
  console.log(`    ${COLUMNS.map((column) => cell(column.title, column.width)).join(" ")}`);
  suggestions.forEach((suggestion, index) => {
    console.log(`    ${COLUMNS.map((column) => cell(column.value(suggestion, index), column.width)).join(" ")}`);
  });
}

// Like the real endpoint, a failed source counts as an empty list. Only the
// error message is printed; the Facades never put keys or full URLs in it.
function listOrEmpty(source: string, outcome: PromiseSettledResult<Suggestion[]>): Suggestion[] {
  if (outcome.status === "fulfilled") return outcome.value;
  const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
  console.log(`\n  ${source} failed: ${message}`);
  return [];
}

// Every Geoapify/Wikidata pair whose names are equal after the merge's own
// normalization, with their distance and whether the merge paired them.
// Shows why two entries with the same name did or did not become one row.
function printNameMatches(geoapify: Suggestion[], wikidata: Suggestion[]): void {
  // Uncapped, so a merged pair is not reported as unmerged just because it
  // fell below the 8-row cut
  const allMerged = mergeSuggestions(geoapify, wikidata, Number.MAX_SAFE_INTEGER);
  const limitKm = MAX_MERGE_DISTANCE_METERS / 1000;

  console.log(`\n  Name matches (merge limit ${limitKm} km)`);
  let found = false;
  for (const geo of geoapify) {
    for (const wd of wikidata) {
      if (normalizeName(geoapifyName(geo.label)) !== normalizeName(wd.label)) continue;
      found = true;

      const meters = haversineMeters(geo.location, wd.location);
      // A merged row has Wikidata's id and Geoapify's location
      const merged = allMerged.some(
        (suggestion) =>
          suggestion.source === "both" &&
          suggestion.id === wd.id &&
          suggestion.location[0] === geo.location[0] &&
          suggestion.location[1] === geo.location[1],
      );
      console.log(
        `    ${cell(geo.label, 40)} ${cell(wd.label, 30)} ${cell(`${(meters / 1000).toFixed(1)} km`, 10)} ` +
          `within: ${meters <= MAX_MERGE_DISTANCE_METERS ? "yes" : "no "}  merged: ${merged ? "yes" : "no"}`,
      );
    }
  }
  if (!found) console.log("    (no name matches)");
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

for (const [index, text] of textsToRun.entries()) {
  if (index > 0) await pause(PAUSE_BETWEEN_TEXTS_MS);
  console.log(`\n=== "${text}" ===`);

  const [geoapifyOutcome, wikidataOutcome] = await Promise.allSettled([
    autocomplete(text, { lang: LANG, limit: CANDIDATES_PER_SOURCE }),
    searchPlaces(text, { lang: LANG, limit: CANDIDATES_PER_SOURCE }),
  ]);
  const geoapify = listOrEmpty("Geoapify", geoapifyOutcome);
  const wikidata = listOrEmpty("Wikidata", wikidataOutcome);

  printTable("Geoapify only", geoapify);
  printTable("Wikidata only", wikidata);
  printTable("Merged", mergeSuggestions(geoapify, wikidata, MAX_SUGGESTIONS));
  printNameMatches(geoapify, wikidata);
}
