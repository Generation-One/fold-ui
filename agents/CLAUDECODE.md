# Deploying Fold UI with Claude Code

You are a Claude Code agent helping a human deploy the Fold UI. Read [AGENTS.md](../AGENTS.md) first.

**Your approach:** Check things yourself first, then ask the human only when you need their action.

---

## Step-by-Step Setup

### 1. Confirm Fold Server is Running

Check yourself:

```bash
curl -sf http://localhost:8765/health && echo "OK" || echo "Fold server not running"
```

If not running, the server must be deployed first. See https://github.com/Generation-One/fold/blob/main/AGENTS.md

### 2. Check Docker

```bash
docker --version
```

If Docker is available, proceed with Docker deployment. Otherwise, use local development (step 5).

### 3. Deploy the UI Container

Tell the human:

> "I'll set up the Fold UI. Please run this command:"

```bash
docker run -d --name fold-ui --restart unless-stopped \
  -p 80:80 \
  -e VITE_API_URL=http://localhost:8765 \
  ghcr.io/generation-one/fold-ui:latest
```

If they already have a docker-compose.yml, you can write the fold-ui service into it instead.

### 4. Verify

Once started, check yourself:

```bash
curl -sf http://localhost/ | head -5
```

### 5. Local Development (Alternative)

If the human prefers local development:

```bash
npm install
cp .env.example .env
npm run dev
```

You **can** edit `.env` to set `VITE_API_URL=http://localhost:8765`.

### 6. Set API Token

This requires a browser. Tell the human:

> "Open http://localhost in your browser, go to Settings, paste your Fold API token, and click Save."

---

## What You Can Do

- Check if the Fold server is reachable
- Write `docker-compose.yml` with the UI service
- Edit `.env` and configure `VITE_API_URL`
- Run `npm install` and `npm run dev` for local development
- Verify the UI is serving via curl

## What You Cannot Do

- Start Docker containers
- Open a browser to set the API token

---

## Common Issues

| Problem | Check |
|---------|-------|
| Blank page | `VITE_API_URL` wrong or Fold server unreachable |
| CORS errors | UI and API on different domains without a reverse proxy |
| 401 errors | API token not set in Settings |
| Port 80 in use | Change the host port mapping: `-p 5174:80` |

---

## Reporting Issues

If you hit a bug or something does not work as documented, file an issue:

- **UI problems**: https://github.com/Generation-One/fold-ui/issues
- **Backend problems**: https://github.com/Generation-One/fold/issues

You can draft the issue and have the human submit it, or use `gh issue create` if the GitHub CLI is available.
