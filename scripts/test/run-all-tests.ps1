# Run All Tests
#
# Runs the complete test suite for both server and client.
# Reports results with pass/fail counts.
#
# Usage:
#   .\scripts\test\run-all-tests.ps1
#
# Options:
#   -Coverage    Generate coverage reports
#   -ServerOnly  Run server tests only
#   -ClientOnly  Run client tests only

param(
    [switch]$Coverage,
    [switch]$ServerOnly,
    [switch]$ClientOnly
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "=== Algo Trading V2 — Full Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

$serverFailed = $false
$clientFailed = $false

# Server tests
if (-not $ClientOnly) {
    Write-Host "--- Server Tests ---" -ForegroundColor Yellow
    Write-Host ""

    if ($Coverage) {
        Set-Location server; npx jest --coverage; Set-Location ..
    } else {
        Set-Location server; npx jest; Set-Location ..
    }

    if ($LASTEXITCODE -ne 0) {
        $serverFailed = $true
        Write-Host "Server tests: FAILED" -ForegroundColor Red
    } else {
        Write-Host "Server tests: PASSED" -ForegroundColor Green
    }
    Write-Host ""
}

# Client tests
if (-not $ServerOnly) {
    Write-Host "--- Client Tests ---" -ForegroundColor Yellow
    Write-Host ""

    if ($Coverage) {
        Set-Location client; npx jest --coverage; Set-Location ..
    } else {
        Set-Location client; npx jest; Set-Location ..
    }

    if ($LASTEXITCODE -ne 0) {
        $clientFailed = $true
        Write-Host "Client tests: FAILED" -ForegroundColor Red
    } else {
        Write-Host "Client tests: PASSED" -ForegroundColor Green
    }
    Write-Host ""
}

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
if (-not $ClientOnly) {
    $serverStatus = if ($serverFailed) { "FAILED" } else { "PASSED" }
    $serverColor = if ($serverFailed) { "Red" } else { "Green" }
    Write-Host "  Server: $serverStatus" -ForegroundColor $serverColor
}
if (-not $ServerOnly) {
    $clientStatus = if ($clientFailed) { "FAILED" } else { "PASSED" }
    $clientColor = if ($clientFailed) { "Red" } else { "Green" }
    Write-Host "  Client: $clientStatus" -ForegroundColor $clientColor
}
Write-Host ""

if ($serverFailed -or $clientFailed) {
    Write-Host "Some tests failed." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}
