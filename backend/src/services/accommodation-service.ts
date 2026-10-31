import type { Accommodation, AccommodationType, LonLat } from "../types/geo.js";

export type PlaceFeature = {
  id: string;
  name?: string;
  location: LonLat;
  address?: string;
};

export type SearchPlaces = (categories: string[], point: LonLat, radiusMeters: number, limit: number) => Promise<PlaceFeature[]>;

const CATEGORY_MAP: Record<AccommodationType, string[]> = {
  hotel: ["accommodation.hotel"],
  hostel: ["accommodation.hostel"],
  camping: ["camping.camp_site"],
  parking: ["parking.cars"],
};

export type AccommodationFinder = {
  readonly type: AccommodationType;
  readonly categories: string[];
  search(point: LonLat, radiusMeters: number): Promise<Accommodation[]>;
};

class Finder implements AccommodationFinder {
  readonly categories: string[];

  constructor(
    readonly type: AccommodationType,
    private readonly searchPlaces: SearchPlaces,
  ) {
    this.categories = CATEGORY_MAP[type];
  }

  async search(point: LonLat, radiusMeters: number): Promise<Accommodation[]> {
    const places = await this.searchPlaces(this.categories, point, radiusMeters, 20);
    return places
      .filter((place) => place.name?.trim() && Number.isFinite(place.location[0]) && Number.isFinite(place.location[1]))
      .map((place) => ({
        id: place.id,
        name: place.name!.trim(),
        type: this.type,
        location: place.location,
        distanceMeters: Math.round(haversineMeters(point, place.location)),
        ...(place.address ? { address: place.address } : {}),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}

export class AccommodationFinderFactory {
  static get(type: AccommodationType, searchPlaces: SearchPlaces): AccommodationFinder {
    if (!(type in CATEGORY_MAP)) throw new Error(`Unknown accommodation type: ${type}`);
    return new Finder(type, searchPlaces);
  }
}

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function selectAccommodations(byType: Map<AccommodationType, Accommodation[]>, types: AccommodationType[]): Accommodation[] {
  const selected: Accommodation[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (selected.length < 5) {
    let added = false;
    for (const type of types) {
      const place = byType.get(type)?.[index];
      if (!place || seen.has(place.id)) continue;
      seen.add(place.id);
      selected.push(place);
      added = true;
      if (selected.length === 5) break;
    }

    if (!added) break;
    index += 1;
  }
  return selected.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function keepPreferredType(byType: Map<AccommodationType, Accommodation[]>, types: AccommodationType[]) {
  const claimed = new Set<string>();
  for (const type of types) {
    const places = byType.get(type);
    if (!places) continue;
    byType.set(type, places.filter((place) => {
      if (claimed.has(place.id)) return false;
      claimed.add(place.id);
      return true;
    }));
  }
}

export type AccommodationSearchResult = {
  accommodation: Accommodation[];
  radiusMeters: number;
  partial: boolean;
  unavailable: boolean;
  limitReached: boolean;
};

export type RequestBudget = {
  run<T>(operation: () => Promise<T>): Promise<T | undefined>;
};

export async function findAccommodation(
  point: LonLat,
  types: AccommodationType[],
  searchPlaces: SearchPlaces,
  budget?: RequestBudget,
  initialRadiusMeters = 10_000,
): Promise<AccommodationSearchResult> {
  const run = budget?.run.bind(budget) ?? (async <T>(operation: () => Promise<T>) => operation());
  let failedTypes = 0;
  let successfulTypes = 0;
  let limitReached = false;

  const searchAtRadius = async (radiusMeters: number) => {
    const byType = new Map<AccommodationType, Accommodation[]>();
    await Promise.all(types.map(async (type) => {
      try {
        const result = await run(() => AccommodationFinderFactory.get(type, searchPlaces).search(point, radiusMeters));
        if (result === undefined) {
          limitReached = true;
          return;
        }
        byType.set(type, result);
      } catch (error) {
        failedTypes += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Accommodation ${type} search failed at ${radiusMeters}m: ${message}`);
      }
      if (byType.has(type)) successfulTypes += 1;
    }));
    return byType;
  };

  let radiusMeters = initialRadiusMeters;
  let byType = await searchAtRadius(radiusMeters);
  if (radiusMeters === 10_000 && [...byType.values()].every((places) => places.length === 0) && !limitReached) {
    radiusMeters = 25_000;
    byType = await searchAtRadius(radiusMeters);
  }
  keepPreferredType(byType, types);

  return {
    accommodation: selectAccommodations(byType, types),
    radiusMeters,
    partial: failedTypes > 0 && successfulTypes > 0,
    unavailable: failedTypes > 0 && successfulTypes === 0 && !limitReached,
    limitReached,
  };
}
