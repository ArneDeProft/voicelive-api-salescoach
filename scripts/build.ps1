#!/usr/bin/env pwsh

Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
Remove-Item -Path "frontend/static" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend/static" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend/node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend/package-lock.json" -Force -ErrorAction SilentlyContinue

Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Blue
Set-Location frontend
npm install --legacy-peer-deps

Write-Host "🔨 Building React app..." -ForegroundColor Green
npm run build

Write-Host "📋 Copying build to backend static folder..." -ForegroundColor Cyan
Set-Location ..
New-Item -ItemType Directory -Force -Path "backend/static" | Out-Null
Copy-Item -Path "frontend/static/*" -Destination "backend/static/" -Recurse -Force

Write-Host "✅ Build complete! Run 'cd backend && python src/app.py' to start the server." -ForegroundColor Green