import type { LonLat, Suggestion } from "../types/geo.js";

// Tunable values (see Suggestion merging in the spec). The exported helpers
// below are also used by scripts/suggestion-report.ts, so the report
// compares names and distances exactly the way the merge does.

// Two entries farther apart than this are different places, even with the
// same name (e.g. Liseberg in Gothenburg and Liseberg in Stockholm). The two
// sources often put the same city or landmark a few km apart (seen up to
// 9.7 km); the nearest different place with the same name was 61.7 km away.
// Counties (about 29 km apart) stay unmerged on purpose.
export const MAX_MERGE_DISTANCE_METERS = 15_000;
// A digit in the typed text probably means a street address, which
// Geoapify knows better than Wikidata
const ADDRESS_HINT = /\d/;
// Letters that NFD below does not split into a base letter plus a mark, so
// they need an explicit replacement. Applied to lowercase text.
const LETTER_REPLACEMENTS: Record<string, string> = {
  ø: "o",
  æ: "ae",
  ß: "ss",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
};

// Not tunable: the mean radius of the Earth, used by haversineMeters
const EARTH_RADIUS_METERS = 6_371_000;

// Straight-line distance between two points on the Earth's surface. The
// haversine formula treats the Earth as a sphere, which is accurate to well
// under 1% and more than enough to compare against a 2 km limit.
export function haversineMeters([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  // `a` is the square of half the straight chord between the points,
  // measured on a sphere with radius 1
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  // The angle between the points seen from the Earth's center, times the radius
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

function isValid(suggestion: Suggestion): boolean {
  const [lon, lat] = suggestion.location;
  return (
    suggestion.label.trim() !== "" &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90
  );
}

// Keeps the first of each entry with the same label and location
function dedupe(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return list.filter((suggestion) => {
    const key = `${suggestion.label}|${suggestion.location[0]}|${suggestion.location[1]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Makes names comparable: "Göteborg", "goteborg" and "GÖTEBORG!" all
// become "goteborg"
export function normalizeName(name: string): string {
  const replaced = [...name.toLowerCase()].map((letter) => LETTER_REPLACEMENTS[letter] ?? letter).join("");
  return (
    replaced
      // NFD splits e.g. "ö" into "o" plus a combining diaeresis...
      .normalize("NFD")
      // ...and the combining marks (this Unicode block) are removed
      .replace(/[̀-ͯ]/g, "")
      // Anything that is not a letter, digit or space, in any alphabet
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Geoapify labels are full addresses ("Liseberg, 125 35 Stockholm,
// Sweden"); the name is the part before the first comma
export function geoapifyName(label: string): string {
  return label.split(",")[0]!;
}

// Takes one entry from each list in turn, starting with `first`. When one
// list runs out, the rest of the other follows.
function alternate(first: Suggestion[], second: Suggestion[]): Suggestion[] {
  const result: Suggestion[] = [];
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    if (index < first.length) result.push(first[index]!);
    if (index < second.length) result.push(second[index]!);
  }
  return result;
}

// Combines the suggestion lists from Geoapify and Wikidata into one list.
// Pure: no network, no clock, no randomness, and the inputs are only read,
// so the same input always gives the same output.
export function mergeSuggestions(
  geoapify: Suggestion[],
  wikidata: Suggestion[],
  text: string,
  max: number,
): Suggestion[] {
  // 1. Clean each list on its own
  const cleanGeoapify = dedupe(geoapify.filter(isValid));
  const cleanWikidata = dedupe(wikidata.filter(isValid));

  // 2. Find places that both sources know. Every same-name pair within the
  // limit is a candidate; the nearest candidates are paired first, and each
  // entry can be in only one pair. Ties are broken by list position, so the
  // result never depends on chance.
  const wikidataNames = cleanWikidata.map((wd) => normalizeName(wd.label));
  const geoapifyNames = cleanGeoapify.map((geo) => normalizeName(geoapifyName(geo.label)));

  const candidates: { wdIndex: number; geoIndex: number; meters: number }[] = [];
  cleanWikidata.forEach((wd, wdIndex) => {
    cleanGeoapify.forEach((geo, geoIndex) => {
      if (wikidataNames[wdIndex] !== geoapifyNames[geoIndex]) return;
      const meters = haversineMeters(geo.location, wd.location);
      if (meters <= MAX_MERGE_DISTANCE_METERS) candidates.push({ wdIndex, geoIndex, meters });
    });
  });
  candidates.sort((a, b) => a.meters - b.meters || a.wdIndex - b.wdIndex || a.geoIndex - b.geoIndex);

  // Wikidata index -> the Geoapify entry it is paired with
  const pairOf = new Map<number, Suggestion>();
  const pairedGeoapify = new Set<number>();
  for (const { wdIndex, geoIndex } of candidates) {
    if (pairOf.has(wdIndex) || pairedGeoapify.has(geoIndex)) continue;
    pairOf.set(wdIndex, cleanGeoapify[geoIndex]!);
    pairedGeoapify.add(geoIndex);
  }

  // 3. A merged entry replaces its Wikidata entry in place, so it keeps
  // Wikidata's ranking instead of jumping to the top
  const wikidataWithMerged = cleanWikidata.map((wd, wdIndex): Suggestion => {
    const geo = pairOf.get(wdIndex);
    if (!geo) return wd;
    // Wikidata has the better name and a description; Geoapify has a
    // location that matches its own map data. Geoapify calls named places
    // such as museums and stations "address", so only its "city" is kept
    // and everything else that Wikidata knows by name is a point of interest.
    return {
      id: wd.id,
      label: wd.label,
      ...(wd.description && { description: wd.description }),
      location: geo.location,
      kind: geo.kind === "city" ? "city" : "poi",
      source: "both",
    };
  });

  // 4. The Wikidata list (with merged entries in place) and the Geoapify
  // entries that were not merged take turns
  const restGeoapify = cleanGeoapify.filter((_suggestion, geoIndex) => !pairedGeoapify.has(geoIndex));
  const ordered = ADDRESS_HINT.test(text)
    ? alternate(restGeoapify, wikidataWithMerged)
    : alternate(wikidataWithMerged, restGeoapify);

  // 5. Cut to the maximum length
  return ordered.slice(0, Math.max(0, max));
}
