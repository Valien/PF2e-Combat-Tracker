# Multi-stage build: compile the SPA, then serve it with nginx.
# No pnpm, Node, or build tools needed on the host — just Docker.
#
#   docker build -t initiative-tracker .
#   docker run -p 8080:80 initiative-tracker
#
# Or with docker compose:
#   docker compose up --build
#
# Then open http://localhost:8080/
# Player view: http://localhost:8080/?view=player
#
# To allow other devices on your network (tablet, phone) to connect,
# use the host machine's LAN IP instead of localhost.

FROM node:20-slim AS build
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build with base path "/" so assets resolve at root (the pnpm script wraps
# vite build as "vue-tsc -b && vite build" — we already type-checked, so call
# vite directly with the base override to avoid the GitHub Pages subpath).
RUN pnpm exec vue-tsc -b && pnpm exec vite build --base=/

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
