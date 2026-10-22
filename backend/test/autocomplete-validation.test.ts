import "./helpers/test-env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { autocompleteQuerySchema } from "../src/controllers/geocode-controller.js";

// Query parameters arrive as strings, so the inputs here are strings too

test("accepts valid input and defaults lang to en", () => {
  const result = autocompleteQuerySchema.parse({ text: "Liseberg" });
  assert.deepEqual(result, { text: "Liseberg", lang: "en" });
});

test("trims and collapses repeated spaces", () => {
  const result = autocompleteQuerySchema.parse({ text: "  Lise    berg " });
  assert.equal(result.text, "Lise berg");
});

test("turns lat and lon into numbers", () => {
  const result = autocompleteQuerySchema.parse({ text: "Liseberg", lat: "57.69", lon: "11.99" });
  assert.equal(result.lat, 57.69);
  assert.equal(result.lon, 11.99);
});

test("rejects text that is too short or too long", () => {
  assert.equal(autocompleteQuerySchema.safeParse({ text: "ab" }).success, false);
  // Spaces are collapsed before the length check, so this is only "a b" (3)
  assert.equal(autocompleteQuerySchema.safeParse({ text: "a     b" }).success, true);
  assert.equal(autocompleteQuerySchema.safeParse({ text: "a".repeat(201) }).success, false);
});

test("rejects missing or repeated text", () => {
  assert.equal(autocompleteQuerySchema.safeParse({}).success, false);
  // ?text=a&text=b arrives as an array
  assert.equal(autocompleteQuerySchema.safeParse({ text: ["Lis", "Lise"] }).success, false);
});

test("requires lat and lon together", () => {
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lat: "57.69" }).success, false);
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lon: "11.99" }).success, false);
});

test("rejects coordinates out of range or not numbers", () => {
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lat: "91", lon: "0" }).success, false);
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lat: "0", lon: "181" }).success, false);
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lat: "abc", lon: "0" }).success, false);
});

test("rejects a lang that is not a two-letter code", () => {
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lang: "eng" }).success, false);
  assert.equal(autocompleteQuerySchema.safeParse({ text: "Liseberg", lang: "EN" }).success, false);
});
