import "./styles.css";
import content from "./generated/content.json";
import { CHROME } from "./chrome";
import { APP_STORE_URL, SUPPORT_EMAIL, COPYRIGHT } from "./config";

type LocaleContent = {
  asc: string;
  label: string;
  name: string;
  subtitle: string;
  promo: string;
  hook: string;
  features: { title: string; body: string }[];
  shots: string;
};

const locales = content.locales as Record<string, LocaleContent>;
const LANGS = Object.keys(locales);
const STORAGE_KEY = "bw-site-lang";

function detectLang(): string {
  const fromQuery = new URLSearchParams(location.search).get("lang");
  if (fromQuery && LANGS.includes(fromQuery)) return fromQuery;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LANGS.includes(stored)) return stored;
  for (const nav of navigator.languages ?? [navigator.language]) {
    if (nav.toLowerCase().startsWith("zh")) return "zh-Hant";
    const base = nav.split("-")[0];
    if (LANGS.includes(base)) return base;
  }
  return "en";
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

const $$ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  [...document.querySelectorAll<T>(sel)];

const shot = (lang: string, screen: string) =>
  `${import.meta.env.BASE_URL}shots/${lang}-${screen}.png`;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let revealObserver: IntersectionObserver | null = null;

function observeReveals() {
  if (reduceMotion) {
    for (const el of $$(".reveal")) el.classList.add("is-in");
    return;
  }
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay ?? 0);
        el.style.setProperty("--reveal-delay", `${delay}ms`);
        el.classList.add("is-in");
        revealObserver?.unobserve(el);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
  );
  for (const el of $$(".reveal:not(.is-in)")) revealObserver.observe(el);
}

function render(lang: string) {
  const t = locales[lang];
  const c = CHROME[lang] ?? CHROME.en;
  document.documentElement.lang = lang;
  document.title = `${t.name} — ${t.subtitle}`;
  $("meta[name=description]")?.setAttribute("content", t.promo);

  const set = (sel: string, text: string) => {
    for (const el of $$(sel)) el.textContent = text;
  };

  set("[data-brand-name]", t.name);
  set("[data-nav-features]", c.features);
  set("[data-nav-shots]", c.screenshots);
  set("[data-nav-langs]", c.languages);
  set("[data-nav-support]", c.support);
  set("[data-hero-hook]", t.hook);
  set("[data-hero-subtitle]", t.subtitle);
  set("[data-hero-promo]", t.promo);
  set("[data-title-features]", c.features);
  set("[data-title-shots]", c.screenshots);
  set("[data-title-langs]", c.languages);
  set("[data-footer-privacy]", c.privacy);
  set("[data-footer-terms]", c.terms);
  set("[data-footer-support]", c.support);
  set("[data-footer-contact]", c.contact);
  set("[data-footer-copyright]", COPYRIGHT);

  // Store badge: real link when live, localized "coming soon" otherwise.
  const badgeHost = $("[data-store-badge]");
  if (badgeHost) {
    const apple =
      '<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
    badgeHost.innerHTML = APP_STORE_URL
      ? `<a class="store-badge" href="${APP_STORE_URL}">${apple}<span>${c.download}</span></a>`
      : `<span class="store-badge soon">${apple}<span>${c.comingSoon}</span></span>`;
  }

  // Feature cards from the App Store description.
  const grid = $("[data-features-grid]");
  if (grid) {
    grid.replaceChildren(
      ...t.features.map((f, i) => {
        const card = document.createElement("div");
        card.className = "feature-card reveal";
        card.style.setProperty("--i", String(i));
        card.dataset.revealDelay = String(i * 70);
        const h = document.createElement("h3");
        h.textContent = f.title;
        const p = document.createElement("p");
        p.textContent = f.body;
        card.append(h, p);
        return card;
      }),
    );
  }

  // Screenshots: localized captures where available, English fallback.
  $("[data-hero-shot]")?.setAttribute("src", shot(t.shots, "accounting"));
  for (const screen of ["accounting", "statistics", "settings"]) {
    $(`[data-shot="${screen}"]`)?.setAttribute("src", shot(t.shots, screen));
  }

  // Language picker + chips.
  const select = $<HTMLSelectElement>("[data-lang-select]");
  if (select) select.value = lang;
  const chips = $("[data-langs-grid]");
  if (chips) {
    chips.replaceChildren(
      ...LANGS.map((l) => {
        const b = document.createElement("button");
        b.className = "lang-chip";
        b.textContent = locales[l].label;
        b.setAttribute("aria-pressed", String(l === lang));
        b.addEventListener("click", () => setLang(l));
        return b;
      }),
    );
  }

  const mail = $<HTMLAnchorElement>("[data-contact-mail]");
  if (mail) {
    mail.href = `mailto:${SUPPORT_EMAIL}`;
    mail.textContent = SUPPORT_EMAIL;
  }

  observeReveals();
}

function setLang(lang: string) {
  localStorage.setItem(STORAGE_KEY, lang);
  render(lang);
}

// Populate the <select> once, then render.
const select = $<HTMLSelectElement>("[data-lang-select]");
if (select) {
  for (const l of LANGS) {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = locales[l].label;
    select.append(opt);
  }
  select.addEventListener("change", () => setLang(select.value));
}

render(detectLang());
