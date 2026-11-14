// Live charity search on pages/charities.html backed by the Every.org API.
import { isApiConfigured, searchCharities, searchCauses } from "./charity-api.js";

const form = document.querySelector("#charity-search-form");
const input = document.querySelector("#charity-search-input");
const causeSelect = document.querySelector("#charity-search-cause");
const status = document.querySelector("#charity-search-status");
const resultsList = document.querySelector("#charity-search-results");

const DEBOUNCE_MS = 300;
let debounceTimer;
let activeController;
let requestCounter = 0;

function setStatus(text, isError = false) {
  if (!status) return;
  status.textContent = text;
  if (isError) status.setAttribute("data-state", "error");
  else status.removeAttribute("data-state");
}

function externalLink(href, label) {
  const link = document.createElement("a");
  link.className = "text-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(label);
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "\u2197";
  link.append(" ", arrow);
  return link;
}

function renderResults(charitiesFound) {
  resultsList.textContent = "";
  for (const charity of charitiesFound) {
    const item = document.createElement("li");
    item.className = "search-result";
    if (charity.logoUrl) {
      const logo = document.createElement("img");
      logo.src = charity.logoUrl;
      logo.alt = "";
      logo.loading = "lazy";
      logo.className = "search-result-logo";
      logo.addEventListener("error", () => { logo.remove(); });
      item.append(logo);
    }
    const body = document.createElement("div");
    body.className = "search-result-main";
    const heading = document.createElement("h3");
    heading.textContent = charity.name;
    body.append(heading);
    if (charity.location) {
      const location = document.createElement("p");
      location.className = "search-result-location";
      location.textContent = charity.location;
      body.append(location);
    }
    if (charity.description) {
      const description = document.createElement("p");
      description.textContent = charity.description;
      body.append(description);
    }
    const links = document.createElement("p");
    links.className = "search-result-links";
    if (charity.profileUrl) links.append(externalLink(charity.profileUrl, "Every.org profile"));
    if (charity.websiteUrl) links.append(externalLink(charity.websiteUrl, "Official website"));
    if (links.childNodes.length) body.append(links);
    item.append(body);
    resultsList.append(item);
  }
}

async function runSearch() {
  const term = input.value.trim();
  if (activeController) activeController.abort();
  if (!term) {
    resultsList.textContent = "";
    setStatus("");
    return;
  }
  activeController = new AbortController();
  const requestId = ++requestCounter;
  setStatus("Searching...");
  try {
    const found = await searchCharities(term, {
      cause: causeSelect ? causeSelect.value : "",
      signal: activeController.signal,
    });
    if (requestId !== requestCounter) return;
    renderResults(found);
    setStatus(found.length
      ? `Showing ${found.length} result${found.length === 1 ? "" : "s"} from Every.org.`
      : "No charities matched that search. Try a different term or cause.");
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== requestCounter) return;
    resultsList.textContent = "";
    setStatus(error?.message || "Charity search failed. Try again.", true);
  }
}

function scheduleSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
}

if (form && input && resultsList) {
  if (causeSelect) {
    for (const cause of searchCauses) {
      const option = document.createElement("option");
      option.value = cause;
      option.textContent = cause[0].toUpperCase() + cause.slice(1);
      causeSelect.append(option);
    }
    causeSelect.addEventListener("change", runSearch);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(debounceTimer);
    runSearch();
  });
  input.addEventListener("input", scheduleSearch);
  if (!isApiConfigured()) {
    input.disabled = true;
    if (causeSelect) causeSelect.disabled = true;
    setStatus("Live search is not configured yet. Add a free Every.org public API key in js/charity-api-key.js to enable it.", true);
  }
}
