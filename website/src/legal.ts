import "./styles.css";
import { SUPPORT_EMAIL, GITHUB_ISSUES_URL } from "./config";

// English / Traditional Chinese toggle for the info pages. English is the
// governing text (stated on each page); zh-Hant is provided for convenience.
const STORAGE_KEY = "bw-legal-lang";

function detect(): "en" | "zh" {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;
  const siteLang = localStorage.getItem("bw-site-lang");
  if (siteLang === "zh-Hant") return "zh";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function apply(lang: "en" | "zh") {
  document.body.dataset.legalLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-set-lang]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.setLang === lang));
  }
}

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-set-lang]")) {
  btn.addEventListener("click", () => {
    const lang = btn.dataset.setLang as "en" | "zh";
    localStorage.setItem(STORAGE_KEY, lang);
    apply(lang);
  });
}

for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-mail]")) {
  a.href = `mailto:${SUPPORT_EMAIL}`;
  a.textContent = SUPPORT_EMAIL;
}

for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-issues]")) {
  a.href = GITHUB_ISSUES_URL;
}

apply(detect());
