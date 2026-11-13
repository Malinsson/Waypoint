import { Location } from "../models/location.js";

// MongoDB's error code for a unique index violation
const DUPLICATE_KEY_ERROR = 11000;

export type LocationInput = {
  name: string;
  description?: string | undefined;
  latitude: number;
  longitude: number;
  wikidataId?: string | undefined;
};

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === DUPLICATE_KEY_ERROR;
}

// Location is a catalog shared by every user, so this only ever CREATES a
// place. If it already exists it is returned untouched: otherwise one user
// could change the name or coordinates of a place that other users' trips and
// favorites point at. (The first saver's data wins; the spec accepts that.)
export async function findOrCreateLocation(input: LocationInput) {
  const name = input.name.slice(0, 80);
  const description = input.description?.slice(0, 200);
  const { latitude, longitude, wikidataId } = input;

  const filter = wikidataId ? { wikidataId } : { name, longitude, latitude };
  const create = () =>
    Location.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          name,
          longitude,
          latitude,
          ...(description === undefined ? {} : { description }),
          ...(wikidataId ? { wikidataId } : {}),
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );

  try {
    return await create();
  } catch (err) {
    // Two requests inserted the same wikidataId at the same moment and the
    // unique index let only one win. The place exists now, so read it.
    if (wikidataId && isDuplicateKeyError(err)) return create();
    throw err;
  }
}
