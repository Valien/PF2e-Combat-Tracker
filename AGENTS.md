# AGENTS.md

High-signal notes for OpenCode agents working in this repo. Read alongside `docs/CLAUDE.md` (architecture overview) and `docs/CONTRIBUTING.md` (workflow/style conventions).

## Commands

Package manager is **pnpm** (CI uses pnpm 10 on Node 20). No lint or format script exists.

```bash
pnpm install
pnpm dev                 # Vite dev server at http://localhost:5173
pnpm test                # vitest run (single run, not watch)
pnpm test:watch          # vitest in watch mode
pnpm test:ui             # vitest UI
pnpm run type-check      # vue-tsc -b --noEmit (project references / build mode)
pnpm build               # vue-tsc -b && vite build  ->  output in ./dist
pnpm preview             # serve the production build
```

Run a single test file: `pnpm vitest run src/functions.test.ts` or `pnpm test <path>`.

CI order (`.github/workflows/ci.yml`): `pnpm test` -> `pnpm run type-check` -> `pnpm build`. Reproduce CI locally in that order before pushing.

## Build output is `./dist`, not `./docs`

`README.md`, `docs/CLAUDE.md`, and `docs/GIT_WORKFLOW.md` all claim the build emits to `./docs`. **That is stale.** `vite.config.ts` does not override `outDir`, so the default `./dist` is used, and `deploy.yml` uploads `path: './dist'`. Treat `./dist` as the real build artifact; do not commit it (already gitignored).

## Branches & deploy

Two-branch strategy:
- `main` — active development. CI runs on every push/PR.
- `prod` — production release. Pushing here triggers `deploy.yml` (build + GitHub Pages deploy to `https://valforte.github.io/Initiative-Tracker/`).
- Only `main` may not have a `prod` counterpart yet locally; create it from `main` when first preparing a release.

Conventional commits required (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`). PR template expects verification in both DM and Player views, both languages (EN/PT-BR), and multiple themes.

## Firebase / online mode

`src/firebase.config.ts` **is committed** and reads credentials from Vite env vars (`import.meta.env.VITE_FIREBASE_*`). The root `firebase.config.template.ts` is legacy — ignore it. `.env.example` lists the required vars; copy to `.env` for local dev. In CI/deploys, `deploy.yml` injects them from GitHub Secrets.

- The build **succeeds without** the env vars set: `App.vue` dynamically imports `./firebase.config.ts` and swallows errors, so online mode silently disables itself at runtime. CI builds without secrets on purpose.
- Online mode is active when a `?session=<id>` query param is present. DM vs player view is a **security property**: a session ID present in `localStorage.dmSessions` grants DM view; otherwise the link is forced into read-only player view (see `src/InitiativeManager.vue:23-43`).

## Type-checking

`tsconfig.json` uses project references: `tsconfig.app.json` (includes `src/**`) and `tsconfig.node.json` (includes only `vite.config.ts`). Both `build` and `type-check` invoke `vue-tsc -b` (build mode). Strict mode is on; `noUnusedLocals: false` in the app config (unused locals are allowed), but `noUnusedParameters: true`. Do not relax strict settings casually.

## Vite base path

`vite.config.ts` sets `base: '/Initiative-Tracker/'` for GitHub Pages subpath hosting. Dev server still runs at root. Asset URLs in templates should not hardcode the base path — use Vite's asset handling. `cssMinify: 'esbuild'` is intentional (avoids lightningcss `@property` warnings); don't switch back to the default.

## Styling

Tailwind v4 is configured in `src/style.css` (not a JS config): `@import "tailwindcss"; @plugin "@tailwindcss/typography"; @plugin "daisyui" { themes: all; }`. Apply themes via `data-theme` attribute on `<html>`. The theme list is hardcoded in `src/App.vue` — add new DaisyUI themes there. Use DaisyUI semantic classes (`btn`, `card`, `table`, `bg-base-100`, `text-primary-content`) for theme compatibility; Tailwind utilities for layout only.

## Localization

All user-facing strings must be added to `src/lang.ts` in **both** `en` and `pt_BR`. Use the `useTranslations()` composable (`const { t, lang } = useTranslations()`; render as `{{ t.section.key }}`). Do not hardcode user-facing English/Portuguese strings in components. Default app language is `pt_BR` (set in `src/main.ts`).

## State, serialization, and class instances

`Combatant` and `Condition` (defined in `src/functions.ts`) are real classes with methods, not plain objects. localStorage (via VueUse `useStorage`) and Firebase both require a **custom serializer** to rehydrate plain objects back into class instances — see `combatantSerializer` in `src/InitiativeManager.vue:49-71`. When adding a field to `Combatant`/`Condition`, update both the class and the serializer's `read` (and the constructor call inside it) or persisted state will silently drop the field. Visibility enum (`None=0 / Half=1 / Full=2`) drives both player-view visibility and turn-order skipping.

## Monster data is generated, but committed

`src/data/pathfinder/*.json` and `src/data/dnd5e/*.json` are static JSON files imported by `src/db.ts`. They are generated by `scripts/parse-pf2e-monsters.cjs`, which parses `src/data/pf2e-monsters.json` and writes one JSON per source book into `src/data/pathfinder/`. The script preserves existing `enabledByDefault` flags on update. Run it manually when `pf2e-monsters.json` changes (no npm script wraps it): `node scripts/parse-pf2e-monsters.cjs`. The generated JSONs are committed to the repo; do not edit them by hand.

## pnpm-workspace.yaml is required

`pnpm-workspace.yaml` exists only to declare `onlyBuiltDependencies` for `@firebase/util` and `protobufjs` (pnpm 10 hard-fails builds of native/postinstall packages without listing them). Do **not** delete this file — `docs/GIT_WORKFLOW.md` says to delete it on a "packages field missing" error, but that troubleshooting note is stale and will break installs.

## Tests

Vitest config lives inline in `vite.config.ts` (`test: { globals: true, environment: 'jsdom' }`). The only test file is `src/functions.test.ts`, covering `Combatant`, `Condition`, `Visibility`, and `colorIsDark` logic. There are no integration tests, fixtures, or services required. Temp HP overflow, condition decrement-to-zero removal, and visibility cycling are the gotchas most likely to regress — add tests there for any changes to `functions.ts`.

## Player view

Append `?view=player` to the dev URL (e.g. `http://localhost:5173/?view=player`) for the read-only player view. For online sessions: `?session=<id>` produces a shareable player link; the DM keeps the original URL (with the session registered in `localStorage.dmSessions`).
