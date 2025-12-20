#!/usr/bin/env pwsh
# Tag and Push All Services to ECR
# Assumes you're already logged into ECR

$ErrorActionPreference = "Stop"

$AWS_ACCOUNT_ID = "945489595584"
$AWS_REGION = "us-east-1"
$ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

Write-Host "=== Tag and Push to ECR ===" -ForegroundColor Cyan
Write-Host "ECR Registry: $ECR_REGISTRY" -ForegroundColor Green
Write-Host ""

# Verify images exist locally
$services = @("document-reader", "quiz-service", "chat-service", "tts-service", "stt-service", "user-service", "aggregator", "notification-service")

Write-Host "Checking local images..." -ForegroundColor Yellow
$missing = @()
foreach ($service in $services) {
    $image = docker images -q $service:latest
    if (-not $image) {
        $missing += $service
    }
}

if ($missing.Count -gt 0) {
    Write-Host "❌ Missing images:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" }
    exit 1
}

Write-Host "✅ All 8 images found locally" -ForegroundColor Green
Write-Host ""

# Tag and push each service
$counter = 1
$total = $services.Count
$success = @()
$failed = @()

foreach ($service in $services) {
    Write-Host "[$counter/$total] Processing $service..." -ForegroundColor Yellow
    
    $ecrTag = "${ECR_REGISTRY}/${service}:latest"
    
    # Tag for ECR
    Write-Host "    Tagging..." -ForegroundColor Cyan
    docker tag "${service}:latest" $ecrTag
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tag failed for $service" -ForegroundColor Red
        $failed += $service
        $counter++
        continue
    }
    
    # Push to ECR
    Write-Host "    Pushing to ECR..." -ForegroundColor Cyan
    docker push $ecrTag
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed for $service" -ForegroundColor Red
        $failed += $service
    }
    else {
        Write-Host "✅ $service pushed successfully"  -ForegroundColor Green
        $success += $service
    }
    
    Write-Host ""
    $counter++
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Push Summary:" -ForegroundColor Cyan
Write-Host "  Success: $($success.Count)/$total" -ForegroundColor $(if ($success.Count -eq $total) { "Green" } else { "Yellow" })
Write-Host "  Failed: $($failed.Count)/$total" -ForegroundColor $(if ($failed.Count -gt 0) { "Red" } else { "Green" })

if ($success.Count -gt 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed:" -ForegroundColor Green
    $success | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Failed to push:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ All images pushed to ECR!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
