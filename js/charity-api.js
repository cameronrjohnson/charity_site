// Client for the Every.org Nonprofit Search API: https://docs.every.org/docs/endpoints/nonprofits
// Every.org public keys are designed for client-side use and are not secrets,
// but private keys must never appear here. Get a public key (pk_live_...) at
// https://www.every.org/developer. The key lives in js/charity-api-key.js,
// which deployment fills in from the EVERY_ORG_API_KEY GitHub Actions secret.
import { EVERY_ORG_API_KEY } from "./charity-api-key.js";
export { EVERY_ORG_API_KEY };

const API_BASE = "https://partners.every.org/v0.2";
const MAX_RESULTS = 50;

// Causes accepted by the search endpoint; see https://docs.every.org/docs/types#causes
export const searchCauses = Object.freeze([
  "animals", "arts", "education", "environment", "health",
  "humans", "justice", "poverty", "research", "religion",
]);

export function isApiConfigured(apiKey = EVERY_ORG_API_KEY) {
  return typeof apiKey === "string" && apiKey.startsWith("pk_");
}

export function buildSearchUrl(term, { cause = "", take = 20, apiKey = EVERY_ORG_API_KEY } = {}) {
  const trimmed = typeof term === "string" ? term.trim() : "";
  if (!trimmed) throw new Error("Enter a search term.");
  const url = new URL(`${API_BASE}/search/${encodeURIComponent(trimmed)}`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("take", String(Math.min(Math.max(1, take), MAX_RESULTS)));
  if (cause) url.searchParams.set("causes", cause);
  return url.toString();
}

function normalizeNonprofit(nonprofit) {
  if (!nonprofit || typeof nonprofit.name !== "string" || !nonprofit.name) return null;
  return {
    name: nonprofit.name,
    description: typeof nonprofit.description === "string" ? nonprofit.description : "",
    profileUrl: typeof nonprofit.profileUrl === "string" ? nonprofit.profileUrl : "",
    websiteUrl: typeof nonprofit.websiteUrl === "string" ? nonprofit.websiteUrl : "",
    logoUrl: typeof nonprofit.logoUrl === "string" ? nonprofit.logoUrl : "",
    ein: typeof nonprofit.ein === "string" ? nonprofit.ein : "",
    location: typeof nonprofit.location === "string" ? nonprofit.location : "",
    slug: typeof nonprofit.slug === "string" ? nonprofit.slug : "",
  };
}

export async function searchCharities(term, options = {}) {
  const { fetchImpl = fetch, signal, ...urlOptions } = options;
  if (!isApiConfigured(urlOptions.apiKey ?? EVERY_ORG_API_KEY)) {
    throw new Error("Charity search is not configured yet. Add an Every.org public API key in js/charity-api-key.js.");
  }
  const response = await fetchImpl(buildSearchUrl(term, urlOptions), { signal });
  if (!response.ok) throw new Error(`Charity search failed (status ${response.status}).`);
  const payload = await response.json();
  const nonprofits = Array.isArray(payload?.nonprofits) ? payload.nonprofits : [];
  return nonprofits.map(normalizeNonprofit).filter(Boolean);
}

// Details endpoint: GET /v0.2/nonprofit/:identifier (slug, EIN, or nonprofit ID).
export function buildNonprofitUrl(identifier, { apiKey = EVERY_ORG_API_KEY } = {}) {
  const trimmed = typeof identifier === "string" ? identifier.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) throw new Error("Select a charity to view its profile.");
  const url = new URL(`${API_BASE}/nonprofit/${encodeURIComponent(trimmed)}`);
  url.searchParams.set("apiKey", apiKey);
  return url.toString();
}

function text(value) {
  return typeof value === "string" ? value : "";
}

export async function getNonprofit(identifier, options = {}) {
  const { fetchImpl = fetch, signal, apiKey = EVERY_ORG_API_KEY } = options;
  if (!isApiConfigured(apiKey)) {
    throw new Error("Charity profiles are not configured yet. Add an Every.org public API key in js/charity-api-key.js.");
  }
  const response = await fetchImpl(buildNonprofitUrl(identifier, { apiKey }), { signal });
  if (response.status === 404) throw new Error("That charity was not found in the Every.org directory.");
  if (!response.ok) throw new Error(`Charity lookup failed (status ${response.status}).`);
  const payload = await response.json();
  const nonprofit = payload?.data?.nonprofit;
  if (!nonprofit || typeof nonprofit.name !== "string" || !nonprofit.name) {
    throw new Error("That charity was not found in the Every.org directory.");
  }
  const tags = Array.isArray(payload.data.nonprofitTags)
    ? payload.data.nonprofitTags.map((tag) => text(tag?.title)).filter(Boolean)
    : [];
  return {
    name: nonprofit.name,
    description: text(nonprofit.descriptionLong) || text(nonprofit.description),
    profileUrl: text(nonprofit.profileUrl),
    websiteUrl: text(nonprofit.websiteUrl),
    logoUrl: text(nonprofit.logoUrl),
    coverImageUrl: text(nonprofit.coverImageUrl),
    ein: text(nonprofit.ein),
    location: text(nonprofit.locationAddress),
    slug: text(nonprofit.primarySlug),
    tags,
  };
}
