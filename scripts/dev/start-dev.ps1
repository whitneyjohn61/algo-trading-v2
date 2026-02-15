# Start Development Servers
#
# Starts both the server and client in development mode.
# Uses concurrently to run both processes in parallel.
#
# Usage:
#   .\scripts\dev\start-dev.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Algo Trading V2 — Development Startup ===" -ForegroundColor Cyan
Write-Host ""

# Check if port 5000 is in use (server)
$serverPort = netstat -ano | Select-String ":5000\s"
if ($serverPort) {
    Write-Host "WARNING: Port 5000 is already in use." -ForegroundColor Yellow
    Write-Host "Kill the existing process or skip server startup." -ForegroundColor Yellow
    Write-Host ""
}

# Check if port 3000 is in use (client)
$clientPort = netstat -ano | Select-String ":3000\s"
if ($clientPort) {
    Write-Host "WARNING: Port 3000 is already in use." -ForegroundColor Yellow
    Write-Host "Kill the existing process or skip client startup." -ForegroundColor Yellow
    Write-Host ""
}

# Start from project root
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "Starting server (port 5000) and client (port 3000)..." -ForegroundColor Green
Write-Host ""

npm run dev
