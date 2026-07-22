# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rich monster stat blocks: level, AC, perception, saves, speed, resistances,
  weaknesses, immunities, traits, family, source, attacks, and abilities for
  all 410 Monster Core entries (scraped from Archives of Nethys)
- `Combatant.applyTypedDamage(amount, type)` — auto-applies resistances,
  weaknesses, and immunities per PF2e RAW (weakness first)
- `Condition` duration system: `duration` (rounds or null), `expiresOn`
  (start/end of turn), `persistentDamage`, `description`
- Schema migration framework (`src/serialization.ts`) with v1→v2 migrator
- Archives of Nethys scraper (`scripts/parse-aon-monsters.mjs`) with Zod
  validation, throttling, retries, and `--source/--all/--force/--elite/--weak`
  flags
- `src/composables/useSettings.ts` — single source of truth for app settings
- ESLint 9 flat config + Prettier formatting
- `pnpm lint`, `pnpm format`, `pnpm update-monsters` scripts
- Vite `manualChunks` — monster-data and Firebase split into separate lazy-loaded
  chunks (main bundle 60% smaller)
- ImportMetaEnv type augmentation for Firebase env vars
- Deployment guide ([DEPLOYMENT.md](DEPLOYMENT.md))

### Changed
- DnD 5e support dropped entirely (pathfinder-only focus)
- Dead files removed: `firebase.config.template.ts`, `scripts/parse-pf2e-monsters.cjs`
- `useStorage` refs for settings consolidated into `useSettings` composable
- Hand-rolled reset-confirm modal replaced with reka-ui `AlertDialog`
- Theme button: always-visible icon buttons (fixed touch device support)
- Temp HP follows PF2e RAW: takes the higher of existing or new (was incorrectly stacking)
- `changeConditionValue()` (no-arg) renamed to `decrementAllConditions()` for clarity
- CI now runs `lint → test → type-check → build` on every push/PR
- Unit test suite expanded to 37 tests (was 21)

### Fixed
- Stale doc references: build output directory corrected from `./docs` to `./dist`
- `pnpm-workspace.yaml` troubleshooting note corrected (file is required, not deletable)

## [1.0.0] - YYYY-MM-DD

### Added
- Initial release
- Combat initiative tracking with automatic sorting
- HP management with healing, damage, and temporary HP support
- Three-tier visibility system (Hidden/Half/Full)
- Condition tracking with auto-generated colors
- Dual view system (DM view with controls, Player view read-only)
- 35+ DaisyUI themes
- Bilingual support (English and Brazilian Portuguese)
- LocalStorage persistence for combat state
- Integrated Pathfinder 2e monster database (Monster Core + Age of Ashes)
- Official PF2e condition database with descriptions
- Bulk creature spawning with automatic color naming
- Responsive design for desktop and mobile
- Keyboard shortcuts and accessibility features
- Real-time synchronization between DM and player views

[Unreleased]: https://github.com/Valforte/initiative-tracker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Valforte/initiative-tracker/releases/tag/v1.0.0
