# Repository guidance

This repository builds Devola, a Manifest V3 Chrome extension for Amazon.co.jp wishlists.

## Architecture invariants

- `src/index.ts` is the content-script entry point, `src/wishlist.ts` owns wishlist DOM integration, and `src/util.ts` owns product-page fetching and point parsing.
- Keep the extension limited to the Amazon.co.jp URLs declared in `public/manifest.json`.
- Treat selectors and DOM behavior in source and their tests as canonical; do not copy selector lists into documentation.
- `package.json` is the package version source. Use `pnpm sync-version` when changing it so `public/manifest.json` stays aligned.
- Do not commit generated `dist/` or `extension.zip` artifacts.

## Toolchain and completion gates

- Use exactly pnpm 9.15.9 and install with `pnpm install --frozen-lockfile` when the lockfile must not change.
- `pnpm build` removes all previous `dist/` contents before a production build. `pnpm zip` also performs that clean production build and replaces `extension.zip`; do not package an existing `dist/` incrementally.
- Before completing a change, run `pnpm test`, `pnpm type-check`, and `pnpm build`.
- For dependency or release maintenance, also run `pnpm audit --audit-level high` and `pnpm zip` as relevant.
- If a change affects content-script behavior, selectors, the manifest, permissions, or packaged output, load `dist/` as an unpacked extension in Chrome and verify the affected Amazon.co.jp wishlist flow manually. Record anything not manually verified.

## Sources of truth

- Commands and dependency policy: `package.json` and `pnpm-lock.yaml`
- Extension scope, permissions, and packaged entry point: `public/manifest.json`
- Runtime behavior and selectors: `src/` plus `tests/`
- CI and publishing conditions: `.github/workflows/`
- Chrome Web Store environment contract: `.env.example` and `scripts/upload-chrome-web-store.js`
- Human setup and release instructions: `README.md` and `DEPLOYMENT.md`
