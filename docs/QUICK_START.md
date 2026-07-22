# Quick Start Guide

## Prerequisites

- **Node.js v20+** — [download here](https://nodejs.org/) (the LTS version is fine)
- **pnpm 10+** — install after Node: `npm install -g pnpm`
- **Git** — for cloning the repo

## First Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/Valforte/initiative-tracker.git
cd initiative-tracker

# 2. Install dependencies
pnpm install

# 3. Start the development server
pnpm dev
```

The app will be available at **http://localhost:5173**.

That's it — no environment variables required for local development. The build
succeeds without Firebase credentials (online mode silently disables itself).

## Daily Development

```bash
# Make sure you're on main and up to date
git checkout main
git pull

# Make your changes...

# Run the full CI gate locally before pushing (same order as CI):
pnpm lint          # ESLint — must pass with 0 errors
pnpm test          # Vitest — 37 tests
pnpm run type-check # vue-tsc — TypeScript checking
pnpm build         # Production build

# Commit and push
git add .
git commit -m "feat: your change description"
git push origin main
```

GitHub Actions will automatically run `lint → test → type-check → build` on
every push/PR. Check the green checkmark on GitHub before deploying.

## All Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Vite dev server at http://localhost:5173 |
| `pnpm build` | Type-check (vue-tsc) and build for production (output in `./dist`) |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run all unit tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:ui` | Open the Vitest UI |
| `pnpm run type-check` | TypeScript type checking only (no build) |
| `pnpm lint` | Run ESLint on all source files |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm format` | Format all source files with Prettier |
| `pnpm format:check` | Verify formatting without writing |
| `pnpm update-monsters` | Re-scrape monster stat blocks from Archives of Nethys |

## Player View (Testing)

For local testing, add `?view=player` to the dev URL:

```
http://localhost:5173/?view=player
```

This shows the read-only player interface. Both DM and player views share the
same browser localStorage, so changes in the DM view appear instantly in the
player view (open them in separate tabs/windows).

For remote multiplayer sessions, see
[Online Mode Setup](ONLINE_MODE_SETUP.md).

## Configuring Online Mode (Optional)

Online mode uses Firebase for real-time sync between DM and remote players. It
requires environment variables:

```bash
# Copy the example env file
cp .env.example .env

# Add your Firebase project credentials to .env:
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

The build **succeeds without** these variables — online mode simply disables
itself at runtime. See [Online Mode Quick Start](ONLINE_MODE_QUICK_START.md) for
the full Firebase setup walkthrough (~15 minutes).

## Deploying to Production

```bash
# When ready to release to users
git checkout prod
git merge main
git push origin prod
```

Pushing to `prod` triggers the deploy workflow (build + GitHub Pages deploy).
The site updates at https://valforte.github.io/Initiative-Tracker/ within ~2 minutes.

For other deployment options (self-hosting, Docker, custom domains), see
[DEPLOYMENT.md](DEPLOYMENT.md).

## Branch Strategy

- **`main`** — active development. Push here for daily work. CI runs on every push.
- **`prod`** — production release. Pushing here triggers deployment to GitHub Pages.

## Troubleshooting

**Tests failing?**
```bash
pnpm test:watch  # Run in watch mode to see what's failing
```

**Type errors?**
```bash
pnpm run type-check  # See all type errors
```

**Build failing?**
```bash
pnpm build  # Try building locally first — the error output is more detailed
```

**Lint errors?**
```bash
pnpm lint:fix  # Auto-fix what can be fixed
pnpm format    # Ensure Prettier formatting
```

**`pnpm install` fails with "packages field missing or empty"?**
- Do **not** delete `pnpm-workspace.yaml` — it's required by pnpm 10
- Run `pnpm install` to regenerate the lockfile

**Site not updating after deploy?**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Wait 2-3 minutes for the GitHub Pages CDN to propagate

## Need More Info?

- **Deployment options**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Full git workflow**: See [GIT_WORKFLOW.md](GIT_WORKFLOW.md)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Online mode**: See [ONLINE_MODE_QUICK_START.md](ONLINE_MODE_QUICK_START.md)
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md)
