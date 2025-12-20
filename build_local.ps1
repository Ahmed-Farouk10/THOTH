#!/usr/bin/env pwsh
# Build All Services Locally (No ECR Push)
# This builds all Docker images locally without attempting to push to ECR

$ErrorActionPreference = "Stop"

Write-Host "=== Cloud5 Local Docker Build ===" -ForegroundColor Cyan
Write-Host "Building all 8 microservices..." -ForegroundColor Green
Write-Host ""

# Verify Docker is running
Write-Host "[1/9] Checking Docker..." -ForegroundColor Yellow
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker Desktop is not running!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Define services and their Docker contexts
$services = @{
    "document-reader"      = ".\documentreader"
    "quiz-service"         = ".\platform\quiz-service"
    "chat-service"         = ".\platform\chat-service"
    "tts-service"          = ".\tts-service"
    "stt-service"          = ".\stt-service"
    "user-service"         = ".\user-service"
    "aggregator"           = ".\aggregator"
    "notification-service" = ".\notification-service"
}

$counter = 2
$total = $services.Count + 1
$success = @()
$failed = @()

foreach ($service in $services.GetEnumerator()) {
    $serviceName = $service.Key
    $context = $service.Value
    
    Write-Host "[$counter/$total] Building ${serviceName}..." -ForegroundColor Yellow
    Write-Host "    Service directory: $context" -ForegroundColor Cyan
    
    # Build from parent context with -f flag (Dockerfiles expect ./shared)
    docker build -t $serviceName -f "${context}/Dockerfile" .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed for $serviceName" -ForegroundColor Red
        $failed += $serviceName
    }
    else {
        Write-Host "✅ $serviceName built successfully" -ForegroundColor Green
        $success += $serviceName
    }
    
    Write-Host ""
    $counter++
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Build Summary:" -ForegroundColor Cyan
Write-Host "  Success: $($success.Count)/$($services.Count)" -ForegroundColor Green
Write-Host "  Failed: $($failed.Count)/$($services.Count)" -ForegroundColor $(if ($failed.Count -gt 0) { "Red" } else { "Green" })

if ($success.Count -gt 0) {
    Write-Host ""
    Write-Host "✅ Successfully built:" -ForegroundColor Green
    $success | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Failed to build:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ All images built successfully!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Tag and push to ECR (solving login issue separately)" -ForegroundColor Yellow
