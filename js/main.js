const sections = document.querySelectorAll("main > section[id]");
const sectionLinks = document.querySelectorAll('nav a[href^="#"]');

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of sectionLinks) {
        if (link.hash === `#${entry.target.id}`) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      }
    }
  }, { rootMargin: "-20% 0px -65% 0px" });

  sections.forEach((section) => observer.observe(section));
}