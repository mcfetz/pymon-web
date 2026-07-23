# pymon-web

Web frontend for the **pymon** monitoring system.

Built with Svelte 5 + Vite. Proxies all `/api` requests to `pymon-server` on port 5000.

## Quick Start

```bash
cd pymon-web
npm install
npm run dev
```

Frontend starts on `http://localhost:5174`.

Default login: `admin` / `admin`

## Development

```bash
# Dev server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Configuration

API proxy is configured in `vite.config.js` — all `/api` requests are forwarded to
`http://localhost:5000`. Change the target there if the backend runs on a different host or port.

## Features

- **Alarms** — severity filter (warning / critical / info), stacking, acknowledge, snooze, blackouts
- **Metrics** — time-series query with group / agent / plugin / metric filters and charting
- **Config** — full CRUD for agents, groups, rules, executors, notifications, blackouts, plugins
- **Plugins** — in-browser code editor with syntax check (ruff) and live save
- **Account** — change username and password
- **PWA** — installable, web push notifications, dark/light mode

## Tech Stack

| | |
|-|-|
| Framework | Svelte 5 (runes) |
| Build tool | Vite |
| Styling | Tailwind CSS + glassmorphism design |
| Icons | lucide-svelte |
| Code editor | CodeMirror (via CodeEditor component) |
