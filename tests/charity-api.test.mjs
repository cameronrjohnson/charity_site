import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchUrl,
  isApiConfigured,
  searchCauses,
  searchCharities,
} from "../js/charity-api.js";

const TEST_KEY = "pk_test_1234567890";

test("isApiConfigured accepts public keys and rejects placeholders", () => {
  assert.equal(isApiConfigured(TEST_KEY), true);
  assert.equal(isApiConfigured("pk_live_abc123"), true);
  assert.equal(isApiConfigured("YOUR_EVERY_ORG_PUBLIC_KEY"), false);
  assert.equal(isApiConfigured(""), false);
  assert.equal(isApiConfigured(undefined), false);
});

test("buildSearchUrl encodes the term and includes the key", () => {
  const url = new URL(buildSearchUrl("food bank / pantry", { apiKey: TEST_KEY }));
  assert.equal(url.origin, "https://partners.every.org");
  assert.equal(url.pathname, "/v0.2/search/food%20bank%20%2F%20pantry");
  assert.equal(url.searchParams.get("apiKey"), TEST_KEY);
  assert.equal(url.searchParams.get("take"), "20");
  assert.equal(url.searchParams.get("causes"), null);
});

test("buildSearchUrl supports causes and clamps take to the API maximum", () => {
  const url = new URL(buildSearchUrl("water", { apiKey: TEST_KEY, cause: "environment", take: 500 }));
  assert.equal(url.searchParams.get("causes"), "environment");
  assert.equal(url.searchParams.get("take"), "50");
});

test("buildSearchUrl rejects empty terms", () => {
  assert.throws(() => buildSearchUrl("   ", { apiKey: TEST_KEY }), /search term/i);
});

test("search causes are valid Every.org cause identifiers", () => {
  assert.ok(searchCauses.length > 0);
  for (const cause of searchCauses) assert.match(cause, /^[a-z]+$/);
});

test("searchCharities refuses to run without a configured key", async () => {
  await assert.rejects(
    searchCharities("relief", { apiKey: "YOUR_EVERY_ORG_PUBLIC_KEY", fetchImpl: () => assert.fail("must not fetch") }),
    /not configured/i,
  );
});

test("searchCharities normalizes nonprofits and drops malformed entries", async () => {
  const fetchImpl = async (requestedUrl) => {
    assert.match(requestedUrl, /\/v0\.2\/search\/relief\?/);
    return {
      ok: true,
      json: async () => ({
        nonprofits: [
          {
            name: "Direct Relief",
            description: "Medical aid.",
            profileUrl: "https://www.every.org/directrelief",
            websiteUrl: "https://www.directrelief.org",
            logoUrl: "https://example.com/logo.png",
            ein: "951831116",
            location: "Santa Barbara, CA",
            unexpected: { nested: true },
          },
          { name: "Minimal Org" },
          { description: "No name, should be dropped." },
          null,
        ],
      }),
    };
  };
  const results = await searchCharities("relief", { apiKey: TEST_KEY, fetchImpl });
  assert.equal(results.length, 2);
  assert.deepEqual(results[0], {
    name: "Direct Relief",
    description: "Medical aid.",
    profileUrl: "https://www.every.org/directrelief",
    websiteUrl: "https://www.directrelief.org",
    logoUrl: "https://example.com/logo.png",
    ein: "951831116",
    location: "Santa Barbara, CA",
  });
  assert.deepEqual(results[1], {
    name: "Minimal Org",
    description: "",
    profileUrl: "",
    websiteUrl: "",
    logoUrl: "",
    ein: "",
    location: "",
  });
});

test("searchCharities reports HTTP failures", async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(searchCharities("relief", { apiKey: TEST_KEY, fetchImpl }), /status 403/);
});

test("searchCharities tolerates an empty or malformed payload", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  assert.deepEqual(await searchCharities("relief", { apiKey: TEST_KEY, fetchImpl }), []);
});
