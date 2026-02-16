# Deploying Fold UI with OpenClaw

You are an OpenClaw agent with full system access. Read [AGENTS.md](../AGENTS.md) first.

---

## Autonomous Deployment

### 1. Verify Fold Server

```bash
curl -sf http://localhost:8765/health && echo "OK: Fold server" || echo "FAIL: Fold server not running"
```

If not running, deploy the server first. See https://github.com/Generation-One/fold/blob/main/AGENTS.md

### 2. Deploy UI

```bash
docker run -d --name fold-ui --restart unless-stopped \
  -p 80:80 \
  -e VITE_API_URL=http://localhost:8765 \
  ghcr.io/generation-one/fold-ui:latest
```

### 3. Verify

```bash
curl -sf http://localhost/ | head -5 && echo "OK: UI serving" || echo "FAIL: UI not responding"
```

---

## Combined Stack

If deploying alongside the Fold server, add to docker-compose.yml:

```yaml
  fold-ui:
    image: ghcr.io/generation-one/fold-ui:latest
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://fold:8765  # Docker service name
    depends_on:
      fold:
        condition: service_healthy
    restart: unless-stopped
```

For shared-domain deployments (API and UI on the same URL), leave `VITE_API_URL` empty and use a reverse proxy (Traefik recommended). See the [deployment skill](https://github.com/Generation-One/fold/blob/main/skills/deploying-fold/SKILL.md) in the server repo for Traefik config.

---

## Authentication Setup

The UI needs an API token set in its Settings page. This is a browser-based action -- inform your human:

> "Open the Fold UI in a browser, go to Settings, paste the API token, and click Save."

If you have browser automation (Playwright, Puppeteer), you can set the token programmatically via localStorage:

```javascript
localStorage.setItem('fold_token', '<TOKEN>');
location.reload();
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Blank page | `docker logs fold-ui` -- check nginx and VITE_API_URL |
| CORS errors | API and UI on different domains -- use a reverse proxy or set VITE_API_URL correctly |
| 401 errors | Token not set -- check browser localStorage |
| Port conflict | `ss -tlnp | grep :80` -- change port mapping if needed |

---

## Reporting Issues

If you hit a bug or something does not work as documented, file an issue directly:

```bash
# UI issues
gh issue create -R Generation-One/fold-ui --title "..." --body "..."

# Backend issues
gh issue create -R Generation-One/fold --title "..." --body "..."
```

Include what you tried, what happened, relevant logs, and environment details. PRs with fixes are welcome.

---

## Further Reading

- Server setup: https://github.com/Generation-One/fold/blob/main/AGENTS.md
- Full deployment with Traefik: https://github.com/Generation-One/fold/blob/main/skills/deploying-fold/SKILL.md
