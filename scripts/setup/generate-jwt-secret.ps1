# Generate JWT Secret
#
# Generates a cryptographically strong random string for use as JWT_SECRET.
#
# Usage:
#   .\scripts\setup\generate-jwt-secret.ps1

$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = [Convert]::ToBase64String($bytes)

Write-Host ""
Write-Host "=== JWT Secret Generator ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated secret:" -ForegroundColor Green
Write-Host "  $secret" -ForegroundColor Yellow
Write-Host ""
Write-Host "Add this to your server/.env file:" -ForegroundColor Green
Write-Host "  JWT_SECRET=$secret" -ForegroundColor Yellow
Write-Host ""
