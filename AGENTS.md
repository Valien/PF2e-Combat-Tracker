# AGENTS.md

High-signal notes for OpenCode agents working in this repo. Read alongside `docs/CLAUDE.md` (architecture overview) and `docs/CONTRIBUTING.md` (workflow/style conventions). When prose and config disagree, trust the executable source.

## Repository agent instructions

Commit before returning. After completing a user request, run the relevant validation and commit all changes made for that request before sending the final response. Do not leave agent-authored changes uncommitted.

Keep commits scoped to the requested work. Preserve unrelated or pre-existing worktree changes, and do not include them in the commit. If a commit cannot be created safely, explain the blocker in the final response.

Do not amend, rewrite, force-push, or otherwise alter existing history unless the user explicitly requests it.

## Commands

Package manager is **pnpm** (CI uses pnpm 10 on Node 20).

```bash
pnpm install
pnpm dev                 # Vite dev server at http://localhost:5173
pnpm test                # vitest run (single run, not watch)
pnpm test:watch          # vitest in watch mode
pnpm test:ui             # vitest UI
pnpm run type-check      # vue-tsc -b --noEmit (project references / build mode)
pnpm build               # vue-tsc -b && vite build  ->  output in ./dist
pnpm preview            # serve the production build
pnpm lint                # eslint . (flat config)
pnpm lint:fix            # eslint . --fix
pnpm format              # prettier --write src + root config files
pnpm format:check        # prettier --check (CI does not run this)
pnpm update-monsters     # re-scrape AoN monster data (see "Monster data")
```

Run a single test file: `pnpm vitest run src/functions.test.ts` or `pnpm test <path>`.

CI order (`.github/workflows/ci.yml`, runs on push/PR to `main` and `prod`): `pnpm lint` -> `pnpm test` -> `pnpm run type-check` -> `pnpm build`. Reproduce locally in that order before pushing.

## Build output & deploy

Two-branch strategy:
- `main` — active development. CI runs on every push/PR.
- `prod` — production release. Pushing here triggers `deploy.yml` (build + GitHub Pages deploy to `https://valforte.github.io/Initiative-Tracker/`). CI also runs on `prod` PRs; the deploy job injects `VITE_FIREBASE_*` from GitHub Secrets.

Build emits to `./dist` (vite default; `vite.config.ts` does not override `outDir`). `./dist` is gitignored — do not commit it. Local `prod` may not exist yet; create it from `main` when first preparing a release.

Conventional commits required (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`). The PR template (`.github/PULL_REQUEST_TEMPLATE.md`) expects verification in DM + Player views, multiple visibility settings, HP/condition management, multiple themes, and both EN/PT-BR.

## Docker (local hosting without pnpm)

`Dockerfile` (multi-stage) + `docker-compose.yml` let a host with only Docker serve the SPA.

```bash
docker compose up --build    # http://localhost:8080/
```

The Docker build **overrides `--base=/`** (bypassing the GitHub Pages subpath) and serves `./dist` via nginx:alpine. Player view: `http://localhost:8080/?view=player`. For LAN devices (tablet/phone), use the host's LAN IP. Do not assume the `pnpm build` base path when testing via Docker — it differs.

## Firebase / online mode

`src/firebase.config.ts` **is committed** and reads credentials from Vite env vars (`import.meta.env.VITE_FIREBASE_*`). `.env.example` lists the required vars; copy to `.env` for local dev. In CI/deploys, `deploy.yml` injects them from GitHub Secrets.

- The build **succeeds without** the env vars set: `App.vue` dynamically imports `./firebase.config.ts` and swallows errors, so online mode silently disables itself at runtime. CI builds without secrets on purpose.
- Firebase sync logic lives in `src/firebase.ts` (`initializeFirebase`, `isFirebaseReady`, `waitForFirebase`, `useFirebaseSync`, `generateSessionId`). Vite splits it into its own chunk (`manualChunks`) so it lazy-loads only in online mode.
- Online mode is active when a `?session=<id>` query param is present. DM vs player view is a **security property**: a session ID present in `localStorage.dmSessions` grants DM view; otherwise the link is forced into read-only player view. `InitiativeManager.vue` even proactively redirects shared-session URLs back to `?view=player` if a player strips that param (see `src/InitiativeManager.vue:17-54`). Do not weaken this check.

## Linting & formatting

ESLint flat config lives in `eslint.config.js` (not `.eslintrc`). Prettier config in `.prettierrc.json`; prettier integrates via `eslint-config-prettier` (last entry in the flat config). Key conventions worth knowing before editing:

- **`'@typescript-eslint/no-explicit-any': 'off'`** — deliberate. Persistence/serialization boundaries (localStorage, Firebase, JSON rehydration) use `any` because the input shape is unknown until runtime. Don't add `any` elsewhere; don't "fix" these with type narrowing.
- **`'@typescript-eslint/no-unused-vars'`** errors, but ignores identifiers prefixed with `_` (`argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`). Prefix unused params/vars with `_` rather than deleting the signature shape.
- `'vue/multi-word-component-names': 'off'` and `'vue/no-v-html': 'off'` are intentional.
- ESLint ignores: `dist/**`, `node_modules/**`, `src/data/**` (generated JSON), `scripts/**`, `*.json`. Generated monster JSON and the parser script are **not** linted — don't try to fix lint errors there.
- Prettier: `semi: false`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'all'`, `printWidth: 100`, `endOfLine: 'lf'`. There is no format step in CI (`format:check` is not wired into the workflow), so run `pnpm format` before pushing if touching many files.

## Type-checking

`tsconfig.json` uses project references: `tsconfig.app.json` (includes `src/**`) and `tsconfig.node.json` (includes only `vite.config.ts`). Both `build` and `type-check` invoke `vue-tsc -b` (build mode). Strict mode is on in both. In the app config `noUnusedLocals: false` (unused locals allowed) but `noUnusedParameters: true`; the node config is stricter (`noUnusedLocals: true`). Do not relax strict settings casually.

Note: ESLint's unused-vars rule and TS's `noUnusedParameters` interact — a param that TS rejects is also caught if not prefixed `_`. When TS errors on an unused param, prefix it rather than disabling the rule.

## Vite config

`vite.config.ts` sets `base: '/Initiative-Tracker/'` for GitHub Pages subpath hosting. Dev server still runs at root. Asset URLs in templates should not hardcode the base path — use Vite's asset handling.

- `cssMinify: 'esbuild'` is intentional (avoids lightningcss `@property` warnings); don't switch back to the default.
- `manualChunks` splits `src/data/pathfinder/` JSONs into a `monster-data` chunk (~95 files) and Firebase into a `firebase` chunk. Don't inline these — the main bundle would balloon to ~1.5 MB.
- Vite config is loaded via `defineConfig` from `vitest/config`, so the `test` block is inline here (not a separate `vitest.config`) — `pool: 'vmThreads'`, `environment: 'jsdom'`, `globals: true`.

## Styling

Tailwind v4 is configured in `src/style.css` (not a JS config): `@import 'tailwindcss'; @plugin "@tailwindcss/typography"; @plugin "daisyui" { themes: all; }`. Apply themes via `data-theme` attribute on `<html>`. The theme *list* is hardcoded in `src/App.vue` — add new DaisyUI themes there. The **selected** theme state, however, lives in `src/composables/useSettings.ts` (`useTheme()`/`useSettings()`), default `'dracula'`; that file is the single source of truth for `useTempHP`, `HPValue`, `enabledContentSources`, and `theme` (module-singleton `useStorage` refs — don't redeclare per-component `useStorage` for the same keys; use the composable). Use DaisyUI semantic classes (`btn`, `card`, `table`, `bg-base-100`, `text-primary-content`) for theme compatibility; Tailwind utilities for layout only.

## Localization

User-facing strings live in **two** places, both with `en` and `pt_BR` sections — keep them in sync:

- `src/lang.ts` — app UI strings, via `useTranslations()` (`const { t, lang } = useTranslations()`; render as `{{ t.section.key }}`). Default locale is **`'en'`** (`useStorage<Locale>('lang', 'en')`); main.ts no longer sets language.
- `src/db.ts` — condition name/description text and content-source names (own `en`/`pt_BR` structure, separate from `lang.ts`).

Do not hardcode user-facing English or Portuguese strings in components. When adding a condition or content source, add both translations to `db.ts`.

## State, serialization, and schema migrations

`Combatant` and `Condition` (defined in `src/functions.ts`) are real classes with methods, not plain objects. localStorage (via VueUse `useStorage`) and Firebase both require a **custom serializer** to rehydrate plain objects back into class instances. That serializer lives in **`src/serialization.ts`** (not `InitiativeManager.vue`):

- `deserializeCombatant(combatant)` / `deserializeCombatantArray(raw)` — rehydrate plain objects into class instances.
- `createCombatantStorageSerializer(storedVersion)` — VueUse `useStorage` serializer: read runs JSON parse -> migrations -> deserialize; write is plain `JSON.stringify`.
- `combatantFirebaseSerializer` — Firebase variant (Firebase returns arrays directly, no JSON string).

**Schema migrations:** `src/serialization.ts` also tracks `CURRENT_SCHEMA_VERSION` (currently `3`) in `localStorage` key `schemaVersion` (default `1` for existing users, so they get the v1->v2->v3 migration chain on first load). When you **add a field** to `Combatant`/`Condition`:

1. Update the class constructor in `src/functions.ts`.
2. Update `deserializeCombatant` in `serialization.ts` (both the constructor call's options bag and any condition reconstruction).
3. **Bump `CURRENT_SCHEMA_VERSION`** and add a migrator to the `migrations` map (forward-only: each migrator takes raw v(n-1), returns upgraded v(n); conditions are migrated inside the same pass). Without a migrator, existing users' persisted state silently drops the new field on rehydrate.

Visibility enum (`None=0 / Half=1 / Full=2` in `functions.ts`) drives both player-view visibility and turn-order skipping. The v2 migration added rich monster stat-block fields (type/level/ac/saves/speed/resistances/weaknesses/immunities/traits/family/source/attacks/abilities/aonUrl/notes) and condition fields (duration/expiresOn/persistentDamage/description) — all default to `undefined`/empty so v1 state rehydrates losslessly. The v3 migration added per-turn action/reaction tracking (`actionsUsed`/`reactionUsed`, defaulting to `0`/`false`).

## Monster data is generated, but committed

`src/data/pathfinder/*.json` (one file per source book, ~95 files) are static JSONs imported by `src/db.ts` (pathfinder only — there is **no** `dnd5e/` directory). They are generated by `scripts/parse-aon-monsters.mjs`, which **scrapes Archives of Nethys live** (`https://2e.aonprd.com`) — not from a local source JSON (the old `scripts/parse-pf2e-monsters.cjs` and `src/data/pf2e-monsters.json` are gone).

```bash
pnpm update-monsters                          # default: enabledByDefault sources only
node scripts/parse-aon-monsters.mjs --all     # all sources
node scripts/parse-aon-monsters.mjs --source monster-core
node scripts/parse-aon-monsters.mjs --source monster-core --force   # re-fetch already-rich entries
# --elite / --weak apply elite/weak adjustments (level +/-1)
# --delay <ms> throttle (default 1000); script has 1s throttle + exponential backoff on 429/5xx
```

Run it manually when monster data is stale (no CI wrapper). The script is **resumable**: it skips entries that already have a `level` field unless `--force` is passed, and falls back to the existing entry if a fetch or parse fails — so a single bad AoN page won't corrupt the JSON. Every parsed monster is validated against a Zod schema before write. It also preserves each source's `enabledByDefault` flag (which drives `getDefaultEnabledSources()` in `db.ts`). The generated JSONs are committed to the repo; do not edit them by hand.

The parser and `src/data/**` are ESLint-ignored (see Linting) — don't try to lint them.

## Tests

Vitest config lives inline in `vite.config.ts` (`test: { globals: true, environment: 'jsdom', pool: 'vmThreads' }`). The only test file is `src/functions.test.ts`, covering `Combatant`, `Condition`, `Visibility`, and `colorIsDark` logic. There are no integration tests, fixtures, or services required. Temp HP overflow, condition decrement-to-zero removal, and visibility cycling are the gotchas most likely to regress — add tests there for any change to `functions.ts`. (Serialization/migrations are currently untested — be careful editing `serialization.ts`.)

## Player view

Append `?view=player` to the dev URL (e.g. `http://localhost:5173/?view=player`) for the read-only player view (offline). For online sessions: `?session=<id>` produces a shareable player link; the DM keeps the original URL (with the session registered in `localStorage.dmSessions`). In Docker the player view is `http://localhost:8080/?view=player` (base path is `/`, not the GitHub Pages subpath).

## pnpm-workspace.yaml is required

`pnpm-workspace.yaml` declares `packages: ['.']` and an `onlyBuiltDependencies` allowlist for `@firebase/util` and `protobufjs` (pnpm 10 hard-fails builds of native/postinstall packages without listing them). Do **not** delete this file — `pnpm install` will break. (Older repo docs' troubleshooting told you to delete it on a "packages field missing" error; that note has since been corrected, but the file is still load-bearing.)
