# Landing website

Static marketing site for Black White Accounting (黑白記帳), built with
[Vite](https://vite.dev). It **reuses the repo's existing materials** instead of
duplicating them:

| Website content        | Source of truth                                        |
| ---------------------- | ------------------------------------------------------ |
| Marketing copy (16 languages) | `../fastlane/metadata/<locale>/*.txt` via `scripts/sync-content.mjs` |
| Screenshots            | `../captures/ios26-iphone17-pro-max/screenshots/` via `scripts/prepare-assets.sh` |
| App icon / favicon     | `../assets/images/` via `scripts/prepare-assets.sh`    |
| Design tokens (colors, radii, type) | `../docs/design-tokens.json`, mirrored in `src/styles.css` |

## Pages

- `index.html` — landing page; localized into all 16 store languages (copy is
  parsed from the App Store description, so store and site never drift).
- `privacy.html` — Privacy Policy (English governing text + 繁體中文).
- `terms.html` — Terms & Conditions (English governing text + 繁體中文).
- `support.html` — Support / FAQ (English + 繁體中文).

The privacy, terms, and support URLs are referenced by the App Store metadata
(`fastlane/metadata/<locale>/{privacy_url,support_url,marketing_url}.txt`), so
**do not rename these pages** without regenerating the metadata.

## Develop

```bash
cd website
npm install
npm run dev        # syncs content from ../fastlane/metadata, then starts Vite
```

## Build

```bash
npm run build      # sync + typecheck + vite build → dist/
npm run preview
```

`npm run assets` regenerates `public/` images from the repo captures (macOS
only — uses `sips`; results are committed, so CI doesn't need it).

## Deploy

`.github/workflows/deploy-website.yml` builds and publishes `website/dist` to
GitHub Pages (https://zii144.github.io/flash-accounting/) on every push to
`main` that touches `website/**` or `fastlane/metadata/**`.

One-time setup (already done for this repo): **Settings → Pages → Source:
GitHub Actions**. GitHub Pages on the free plan requires a **public**
repository (private Pages needs a paid plan).

Hosting somewhere else? Set the base path at build time:

```bash
WEBSITE_BASE=/ npm run build   # e.g. for a custom domain at the site root
```

…and update the URLs in `../scripts/gen-appstore-metadata.mjs`, then regenerate
the metadata URL files.

## Post-launch checklist

- When the app goes live, set `APP_STORE_URL` in `src/config.ts` — the hero
  badge switches from "coming soon" to a real download link.
- The support email lives in `src/config.ts` (`SUPPORT_EMAIL`).
