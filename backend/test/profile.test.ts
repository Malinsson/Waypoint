import "./helpers/test-env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

import { User } from "../src/models/user.js";
import { Trip } from "../src/models/trip.js";
import { FavoriteList } from "../src/models/favorite-list.js";
import { changePassword } from "../src/services/auth-service.js";
import { getProfileStats } from "../src/services/profile-service.js";

const userA = "64b8f1e2c9e77a0012345678";

test("changePassword rejects a wrong current password and saves nothing", async (t) => {
  const passwordHash = await bcrypt.hash("correct-password", 4);
  let saved = false;
  t.mock.method(User, "findById", () => ({
    select: async () => ({ passwordHash, save: async () => { saved = true; } }),
  }));

  await assert.rejects(changePassword(userA, "wrong-password", "new-password-1"), (error: unknown) => {
    assert.equal(error instanceof Error && "code" in error ? error.code : undefined, "INVALID_CURRENT_PASSWORD");
    return true;
  });
  assert.equal(saved, false);
});

test("changePassword stores a new hash when the current password is right", async (t) => {
  const user = { passwordHash: await bcrypt.hash("correct-password", 4), save: async () => {} };
  t.mock.method(User, "findById", () => ({ select: async () => user }));

  await changePassword(userA, "correct-password", "new-password-1");
  assert.equal(await bcrypt.compare("new-password-1", user.passwordHash), true);
});

test("getProfileStats filters on the user and counts only completed trips for km and destinations", async (t) => {
  const filters: unknown[] = [];
  t.mock.method(FavoriteList, "find", (filter: unknown) => {
    filters.push(filter);
    // The same location in two lists counts once
    return { select: () => ({ lean: async () => [{ locations: ["a", "b"] }, { locations: ["b"] }] }) };
  });
  t.mock.method(Trip, "countDocuments", async (filter: unknown) => {
    filters.push(filter);
    return 3;
  });
  t.mock.method(Trip, "find", (filter: unknown) => {
    filters.push(filter);
    return {
      select: () => ({
        lean: async () => [
          { destinations: [{}, {}, {}], route: { distanceMeters: 400_400 } },
          { destinations: [{}, {}], route: { distanceMeters: 100_000 } },
        ],
      }),
    };
  });

  const stats = await getProfileStats(userA);

  assert.deepEqual(stats, {
    favorites: 2,
    tripsSaved: 3,
    tripsCompleted: 2,
    kilometersDriven: 500,
    destinationsVisited: 5,
  });
  for (const filter of filters) {
    const owner = (filter as { user?: unknown; userId?: unknown }).user ?? (filter as { userId?: unknown }).userId;
    assert.equal(String(owner), userA);
  }
});
