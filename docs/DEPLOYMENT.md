# Deployment Guide

This guide covers the deployment options for the PF2e Combat Tracker.

## Quick Reference

| Method | Complexity | Best For |
|---|---|---|
| GitHub Pages (default) | Zero config | Public deployments via the `prod` branch |
| Static file hosting | Low | Self-hosting on any web server |
| Docker | Medium | Containerized deployments |
| Local `pnpm preview` | Zero config | Testing the production build locally |

---

## Option 1: GitHub Pages (Default, Automated)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`)
that automatically builds and deploys to GitHub Pages when you push to the
`prod` branch.

### One-time GitHub Pages setup

1. Go to your repo on GitHub → **Settings** → **Pages** (left sidebar)
2. Under "Build and deployment":
   - **Source**: Select "GitHub Actions" (not "Deploy from a branch")
3. Save

### Deploying

```bash
git checkout prod
git merge main
git push origin prod
```

The deploy workflow will:
1. Install dependencies with pnpm
2. Build the production bundle (`vue-tsc -b && vite build`)
3. Upload `./dist` to GitHub Pages
4. Go live at `https://<username>.github.io/Initiative-Tracker/` within ~2 minutes

### Custom domain (optional)

1. In GitHub → Settings → Pages → Custom domain, enter your domain
2. Add a `CNAME` record pointing to `<username>.github.io`
3. The `vite.config.ts` `base` path may need adjusting if serving from a root domain

### Firebase credentials for production

The deploy workflow injects Firebase credentials from GitHub Secrets
(`VITE_FIREBASE_*`). If these secrets are not set, the build still succeeds —
online mode silently disables itself at runtime. To enable online mode in
production:

1. Go to GitHub → Settings → Secrets and variables → Actions
2. Add each `VITE_FIREBASE_*` variable (see `.env.example` for the full list)
3. Re-deploy by pushing to `prod` again

---

## Option 2: Static File Hosting

Since the tracker is a static SPA (no server-side runtime), the `./dist`
output can be hosted on any web server.

### Build

```bash
pnpm install
pnpm build
# Output is in ./dist/
```

### Important: Base path

`vite.config.ts` sets `base: '/Initiative-Tracker/'` for GitHub Pages. If you're
hosting at a different path (e.g., root domain or subdomain), update the
`base` in `vite.config.ts`:

```ts
// For root domain deployment:
base: '/'

// For a subpath:
base: '/my-tracker/'
```

### Nginx example

```nginx
server {
    listen 80;
    server_name tracker.example.com;
    root /var/www/initiative-tracker/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

The `try_files` fallback to `/index.html` is required for client-side routing
(if used in future). For now, a single `index.html` entry is used.

### Apache example

```apache
<VirtualHost *:80>
    ServerName tracker.example.com
    DocumentRoot /var/www/initiative-tracker/dist

    <Directory /var/www/initiative-tracker/dist>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Netlify / Vercel / Cloudflare Pages

1. Connect your GitHub repo
2. Build command: `pnpm build`
3. Publish directory: `dist`
4. Set `VITE_FIREBASE_*` environment variables if using online mode
5. If not deploying under `/Initiative-Tracker/`, update `base` in `vite.config.ts`

---

## Option 3: Docker

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t initiative-tracker .
docker run -p 8080:80 initiative-tracker
# Open http://localhost:8080/Initiative-Tracker/
```

If serving from root, set `base: '/'` in `vite.config.ts` before building, and
adjust the nginx config to not require the subpath.

---

## Option 4: Local Preview

For testing the production build locally:

```bash
pnpm build
pnpm preview
# Opens at http://localhost:4173/Initiative-Tracker/
```

---

## Updating Monster Data

Monster stat blocks are scraped from [Archives of Nethys](https://2e.aonprd.com)
and committed as JSON files in `src/data/pathfinder/`. The scraper is
`scripts/parse-aon-monsters.mjs`.

```bash
# Update only default-enabled sources
pnpm update-monsters

# Update a specific source
node scripts/parse-aon-monsters.mjs --source monster-core

# Force re-fetch all monsters in a source (ignores cached rich data)
node scripts/parse-aon-monsters.mjs --source monster-core --force

# Update all sources
node scripts/parse-aon-monsters.mjs --all

# Apply elite/weak adjustments
node scripts/parse-aon-monsters.mjs --source monster-core --elite
```

The scraper:
- Throttles at 1 request/second (configurable via `--delay <ms>`)
- Retries on 429/5xx with exponential backoff (max 3 retries)
- Validates every entry against a Zod schema before writing
- Preserves existing `enabledByDefault` flags
- Skips monsters that already have rich data (use `--force` to re-fetch)
- Is resumable — if interrupted, re-running picks up where it left off

After updating, commit the JSON files:

```bash
git add src/data/pathfinder/
git commit -m "chore: update monster data from AoN"
```

---

## Environment Variables

| Variable | Required? | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Optional | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional | Firebase auth domain |
| `VITE_FIREBASE_DATABASE_URL` | Optional | Firebase Realtime DB URL |
| `VITE_FIREBASE_PROJECT_ID` | Optional | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Optional | Firebase app ID |

All are optional. The build succeeds without them — online mode disables
itself at runtime if credentials are missing.

See `.env.example` for the full list. Copy to `.env` for local dev:

```bash
cp .env.example .env
```

---

## CI/CD Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs on every push to `main` and
on every PR:

```
pnpm install → pnpm test → pnpm run type-check → pnpm build
```

All four steps must pass. To reproduce CI locally in the same order:

```bash
pnpm test && pnpm run type-check && pnpm build
```

The deploy workflow (`.github/workflows/deploy.yml`) runs only on pushes to
`prod` and performs the build + GitHub Pages deployment.
