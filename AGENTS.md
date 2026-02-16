# Fold UI -- Agent Deployment Guide

React web interface for the [Fold](https://github.com/Generation-One/fold) semantic memory server. Required for human operators to manage projects, users, providers, and monitor indexing jobs.

### Related Projects

- **[Fold Server](https://github.com/Generation-One/fold)** -- The backend. You need a running Fold server before deploying this UI.
- **[Engram](https://github.com/Generation-One/engram)** -- Learning agent for AI memory. Gives agents structured, tiered memory on top of Fold. Fold handles long-term semantic search; Engram handles what the agent actively remembers and forgets.

---

## Prerequisites

Before deploying the UI, you need:

1. **A running Fold server** -- see the server's [AGENTS.md](https://github.com/Generation-One/fold/blob/main/AGENTS.md) for setup
2. **An API token** from the Fold server (obtained during bootstrap)
3. **Docker** (recommended) or Node.js 18+ (for local development)

Check these yourself before asking your human:

```bash
# Is the Fold server running?
curl -sf http://localhost:8765/health && echo "Fold server OK" || echo "Fold server not reachable"

# Is Docker available?
docker --version && echo "Docker OK" || echo "Docker not installed"
```

---

## Quick Start (Docker -- Recommended)

```bash
docker run -d --name fold-ui --restart unless-stopped \
  -p 80:80 \
  -e VITE_API_URL=http://localhost:8765 \
  ghcr.io/generation-one/fold-ui:latest
```

Or add to a docker-compose.yml:

```yaml
services:
  fold-ui:
    image: ghcr.io/generation-one/fold-ui:latest
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://localhost:8765
    restart: unless-stopped
```

- The UI serves on port 80 inside the container (map to any host port).
- `VITE_API_URL` is injected at container startup (runtime, not build time).
- If the UI and API share a domain behind a reverse proxy, leave `VITE_API_URL` empty for same-origin requests.

### Verify

```bash
curl -sf http://localhost/ | head -5
```

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8765
npm run dev
```

Opens at http://localhost:5173. The Vite dev server proxies `/api` and `/auth` to `localhost:8765` automatically.

---

## Reverse Proxy / Web Exposure

The Fold API and UI can share a single domain using Traefik, nginx, or Caddy. The UI uses HashRouter (`/#/path`) so all client-side navigation goes through `/index.html`.

Routing rules:
- Static assets (`/`, `/index.html`, `/assets/*`, `/config.js`) go to the UI container
- Everything else (`/health`, `/auth/*`, `/projects/*`, `/mcp`, `/providers/*`, etc.) goes to the Fold API

The entire stack is secured by API token, so public exposure is safe. See the [deployment skill](https://github.com/Generation-One/fold/blob/main/skills/deploying-fold/SKILL.md) in the server repo for full Traefik configuration.

---

## Authentication

The UI needs an API token to communicate with the Fold server.

1. Open the UI in a browser
2. Navigate to **Settings**
3. Enter the API token from the Fold server bootstrap
4. Click **Save Token**

The token is stored in localStorage and automatically restored on page reload.

**Note:** This is a browser-based action. If you are an autonomous agent without browser access, inform your human that they need to complete this step.

---

## Verification Checklist

After deploying, verify:

- [ ] UI loads in browser at the configured URL
- [ ] Settings page accepts the API token
- [ ] Dashboard shows system status (confirms API connectivity)
- [ ] Projects page lists projects (confirms auth is working)

---

## Reporting Issues

If you encounter bugs or deployment problems, file an issue on the correct repository:

- **UI issues** (display, browser, frontend): https://github.com/Generation-One/fold-ui/issues
- **Backend issues** (server, API, providers, indexing): https://github.com/Generation-One/fold/issues

Include what you tried, what happened, relevant logs, and your environment. PRs with fixes are welcome.

---

## Platform-Specific Guides

| Platform | Guide |
|----------|-------|
| **Claude Code** | [agents/CLAUDECODE.md](./agents/CLAUDECODE.md) |
| **OpenClaw** | [agents/OPENCLAW.md](./agents/OPENCLAW.md) |
