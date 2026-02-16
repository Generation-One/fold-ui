# How to Deploy (Frontend)

## Overview

The frontend (`ui/`) is deployed as a Docker image to GitHub Container Registry (GHCR). Pushing a version tag triggers GitHub Actions, which builds the image and publishes it automatically.

**Image**: `ghcr.io/generation-one/fold-ui`
**Repository**: `Generation-One/fold-ui`

## Version Rules

- Versions follow **semver**: `X.Y.Z` or `X.Y.Z-prerelease` (e.g. `0.2.41`, `0.3.0-beta.1`).
- Tags use the `v` prefix: `v0.2.41`.
- Frontend and backend versions are **independent**. They do not need to match.
- Version bumps update `package.json`.

## Deploying a New Version

### Quick method (script)

```powershell
cd ui
.\version.ps1 0.2.42 -Tag
git push origin main
git push origin v0.2.42
```

The `-Tag` flag updates `package.json`, commits the change, and creates an annotated git tag. Pushing the tag triggers CI.

### Manual method

```powershell
cd ui

# 1. Update package.json version field
# 2. Commit
git add package.json
git commit -m "chore: bump version to 0.2.42"

# 3. Tag and push
git tag -a "v0.2.42" -m "Release v0.2.42"
git push origin main
git push origin v0.2.42
```

## What CI Does

The workflow (`.github/workflows/docker-publish.yml`) triggers only on version tags (`v*.*.*`). It:

1. Builds the Docker image for both `linux/amd64` and `linux/arm64`.
2. Uses GitHub Actions cache (`type=gha`) for layer caching across runs.
3. Pushes to GHCR with tags: the version (`0.2.42`), major.minor (`0.2`), major (`0`), and `latest`.

## Local Builds

```powershell
# Build Docker image
.\version.ps1 0.2.42 -Build

# Full release: version + build + tag + push image to GHCR
.\version.ps1 0.2.42 -All
```

## GHCR Permissions

The workflow uses `GITHUB_TOKEN` with `packages: write` permission. The GHCR package (`ghcr.io/generation-one/fold-ui`) must grant the `Generation-One/fold-ui` repository write access under its package settings. Without this, the push step will fail with `permission_denied: write_package`.
