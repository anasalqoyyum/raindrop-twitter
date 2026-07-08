# Twitter → Raindrop Bookmark Sync

Browser extension (Chromium + Firefox, Manifest V3) that saves every tweet you bookmark on x.com to a Raindrop.io collection. One-way and idempotent: re-bookmarking never duplicates, un-bookmarking never deletes.

See [PLAN.md](PLAN.md) for the full design.

## Build

TypeScript sources in `src/` compile to `dist/`, which the manifest points at.

```sh
pnpm install
pnpm build
```

Other scripts: `pnpm typecheck`, `pnpm lint`, `pnpm fmt`.

## Install

Build first — the manifest references `dist/`.

**Chromium (Chrome, Edge, Brave):**

1. `chrome://extensions` → enable Developer mode → "Load unpacked" → select this directory

**Firefox (128+):**

1. `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…" → select `manifest.json`
2. Temporary add-ons are removed on restart; permanent install requires signing via [AMO](https://addons.mozilla.org/developers/) (unlisted is fine)

## Setup

1. Go to [app.raindrop.io/settings/integrations](https://app.raindrop.io/settings/integrations) → "For Developers" → create an app → copy its **Test token**
2. Open the extension's options page (right-click the toolbar icon → Options)
3. Paste the token → **Save & test connection** — this grants host permissions (Firefox prompts here), validates the token, and creates the "Twitter Bookmark" collection if it doesn't exist
4. Optionally pick a different collection or change the default `twitter` tag

## How it works

- A MAIN-world script wraps `fetch` and watches for Twitter's `CreateBookmark` GraphQL call (catches clicks and the `B` shortcut); a `data-testid="bookmark"` click listener acts as fallback
- The background worker dedupes by tweet id (in-memory pending set + `storage.local` cache + server-side search) and POSTs to the Raindrop API
- Failed syncs (network, 429, 5xx) retry with exponential backoff via the `alarms` API; permanent failures land in the options page error log
- Toolbar badge flashes ✓ on sync, ! on failure
