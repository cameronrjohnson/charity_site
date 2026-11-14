// Renders pages/charity.html for any nonprofit using the Every.org details API.
// The charity is chosen with an `id` query parameter (slug, EIN, or nonprofit ID),
// e.g. charity.html?id=redcross
import { getNonprofit, isApiConfigured } from "./charity-api.js";

const SUMMARY_LIMIT = 220;

const status = document.querySelector("#charity-profile-status");
const hero = document.querySelector("#charity-profile-hero");
const body = document.querySelector("#charity-profile-body");
const nameEl = document.querySelector("#charity-profile-name");
const locationEl = document.querySelector("#charity-profile-location");
const summaryEl = document.querySelector("#charity-profile-summary");
const descriptionEl = document.querySelector("#charity-profile-description");
const websiteLink = document.querySelector("#charity-profile-website");
const everyOrgLink = document.querySelector("#charity-profile-everyorg");
const imageEl = document.querySelector("#charity-profile-image");
const factsList = document.querySelector("#charity-profile-facts");

function setStatus(text, isError = false) {
  if (!status) return;
  status.textContent = text;
  if (isError) status.setAttribute("data-state", "error");
  else status.removeAttribute("data-state");
}

function summarize(description) {
  if (description.length <= SUMMARY_LIMIT) return description;
  return `${description.slice(0, SUMMARY_LIMIT).trimEnd()}...`;
}

function addFact(label, value) {
  if (!value) return;
  const item = document.createElement("li");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  item.append(strong, value);
  factsList.append(item);
}

function render(charity) {
  document.title = `${charity.name} | Charity Finder`;
  nameEl.textContent = charity.name;
  locationEl.textContent = charity.location || "Nonprofit organization";
  const description = charity.description
    || "No description is available for this organization in the Every.org directory yet.";
  summaryEl.textContent = summarize(description);
  descriptionEl.textContent = description;
  if (charity.websiteUrl) {
    websiteLink.href = charity.websiteUrl;
    websiteLink.hidden = false;
  }
  if (charity.profileUrl) {
    everyOrgLink.href = charity.profileUrl;
    everyOrgLink.hidden = false;
  }
  const imageUrl = charity.coverImageUrl || charity.logoUrl;
  if (imageUrl) {
    imageEl.src = imageUrl;
    imageEl.hidden = false;
    imageEl.addEventListener("error", () => { imageEl.hidden = true; });
  }
  addFact("Location", charity.location);
  addFact("EIN", charity.ein);
  if (charity.tags.length) addFact("Causes", charity.tags.join(", "));
  if (!factsList.childNodes.length) {
    addFact("Directory", "Listed on Every.org");
  }
  hero.hidden = false;
  body.hidden = false;
  setStatus("");
}

async function loadProfile() {
  const identifier = (new URLSearchParams(window.location.search).get("id") || "").trim();
  if (!identifier) {
    setStatus("No charity selected. Search the directory on the charities page, then choose a result.", true);
    return;
  }
  if (!isApiConfigured()) {
    setStatus("Charity profiles are not configured yet. Add an Every.org public API key in js/charity-api-key.js.", true);
    return;
  }
  try {
    render(await getNonprofit(identifier));
  } catch (error) {
    setStatus(error?.message || "Could not load this charity profile. Try again.", true);
  }
}

if (status && hero && body && nameEl && summaryEl && descriptionEl && factsList) {
  loadProfile();
}
