#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Version management for Fold UI

.EXAMPLE
    .\version.ps1 0.2.0           # Update version only
    .\version.ps1 0.2.0 -Build    # Update + build Docker
    .\version.ps1 0.2.0 -All      # Update + build + tag + push
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Version,
    [switch]$Build,
    [switch]$Tag,
    [switch]$Push,
    [switch]$All
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$') {
    Write-Error "Invalid version format. Use semver: X.Y.Z or X.Y.Z-prerelease"
    exit 1
}

Write-Host "`n=== Fold UI Version: $Version ===" -ForegroundColor Cyan

# Update package.json
Write-Host "Updating package.json..." -ForegroundColor Green
$packagePath = Join-Path $ROOT "package.json"
$packageJson = Get-Content $packagePath -Raw | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content $packagePath
Write-Host "  version = `"$Version`""

# Build
if ($Build -or $All) {
    Write-Host "`nBuilding Docker image..." -ForegroundColor Yellow
    docker buildx build --platform linux/amd64 `
        -t "ghcr.io/generation-one/fold-ui:$Version" `
        -t "ghcr.io/generation-one/fold-ui:latest" `
        $ROOT
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host "Build complete!" -ForegroundColor Green
}

# Push
if ($Push -or $All) {
    Write-Host "`nPushing to GHCR..." -ForegroundColor Yellow
    docker push "ghcr.io/generation-one/fold-ui:$Version"
    docker push "ghcr.io/generation-one/fold-ui:latest"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Tag
if ($Tag -or $All) {
    Write-Host "`nGit commit and tag..." -ForegroundColor Yellow
    git -C $ROOT add package.json
    git -C $ROOT commit -m "chore: bump version to $Version"
    git -C $ROOT tag -a "v$Version" -m "Release v$Version"
    Write-Host "Created tag v$Version" -ForegroundColor Green
    Write-Host "Push with: git push origin v$Version" -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green
