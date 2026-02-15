# Test Docker Build
#
# Tests that the server and client build successfully in a Docker-like environment.
# Validates the build process without actually deploying.
#
# Usage:
#   .\scripts\deploy\test-docker-build.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Test Build (simulating deployment) ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

# Clean previous builds
Write-Host "1. Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "server\dist") { Remove-Item -Recurse -Force "server\dist" }
if (Test-Path "client\.next") { Remove-Item -Recurse -Force "client\.next" }
Write-Host "   Done." -ForegroundColor Green
Write-Host ""

# Type check
Write-Host "2. Running type checks..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Type check FAILED." -ForegroundColor Red
    exit 1
}
Write-Host "   Type check passed." -ForegroundColor Green
Write-Host ""

# Build server
Write-Host "3. Building server..." -ForegroundColor Yellow
npm run build:server
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Server build FAILED." -ForegroundColor Red
    exit 1
}
Write-Host "   Server build passed." -ForegroundColor Green
Write-Host ""

# Build client
Write-Host "4. Building client..." -ForegroundColor Yellow
npm run build:client
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Client build FAILED." -ForegroundColor Red
    exit 1
}
Write-Host "   Client build passed." -ForegroundColor Green
Write-Host ""

# Verify artifacts exist
Write-Host "5. Verifying build artifacts..." -ForegroundColor Yellow
if (Test-Path "server\dist\index.js") {
    Write-Host "   server/dist/index.js exists." -ForegroundColor Green
} else {
    Write-Host "   server/dist/index.js MISSING." -ForegroundColor Red
    exit 1
}

if (Test-Path "client\.next") {
    Write-Host "   client/.next exists." -ForegroundColor Green
} else {
    Write-Host "   client/.next MISSING." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== All build checks passed! ===" -ForegroundColor Green
Write-Host ""
