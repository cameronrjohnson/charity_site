export function getPageContext(document) {
  const filename = new URL(document.URL).pathname.split("/").at(-1);
  const selectors = {
    "": ".home-intro-copy h1, .home-intro-copy > p:not(.eyebrow)",
    "index.html": ".home-intro-copy h1, .home-intro-copy > p:not(.eyebrow)",
    "charities.html": ".page-heading h1, .page-heading > p:not(.eyebrow), .entry-main h2, .entry-main > p",
    "charity-direct-relief.html": ".profile-hero h1, .profile-hero > div > p, .profile-section > p",
    "charity-donorschoose.html": ".profile-hero h1, .profile-hero > div > p, .profile-section > p",
    "charity-nature-conservancy.html": ".profile-hero h1, .profile-hero > div > p, .profile-section > p",
    "quiz.html": ".quiz-panel h1, .quiz-panel .answer-option, .quiz-footnote",
    "quiz-focus.html": ".quiz-panel h1, .quiz-panel .answer-option, .quiz-footnote",
    "quiz-results.html": ".page-heading h1, .page-heading > p, .result-item h2, .result-item p, .research-note",
  };
  if (!Object.hasOwn(selectors, filename)) {
    return { page: "Account or other page", heading: "", summary: "No private account details or form contents are shared. Ask the user which cause they want to explore." };
  }
  const clean = (text) => text.replace(/\s+/g, " ").trim();
  return {
    page: clean(document.title).slice(0, 120),
    heading: clean(document.querySelector("main h1")?.textContent ?? "").slice(0, 120),
    summary: Array.from(document.querySelectorAll(selectors[filename]), (element) => clean(element.textContent)).join("\n").slice(0, 700),
  };
}