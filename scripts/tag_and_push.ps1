# Tag and push Docker images with version numbers
# Usage: .\tag_and_push.ps1 [version] [registry_url]
# Example: .\tag_and_push.ps1 v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com

param(
    [string]$Version = "latest",
    [string]$RegistryUrl = ""
)

if ([string]::IsNullOrEmpty($RegistryUrl)) {
    Write-Host "Usage: .\tag_and_push.ps1 -Version [version] -RegistryUrl [registry_url]" -ForegroundColor Yellow
    Write-Host "Example: .\tag_and_push.ps1 -Version v1.0.0 -RegistryUrl 123456789012.dkr.ecr.us-east-1.amazonaws.com" -ForegroundColor Yellow
    exit 1
}

$services = @(
    "user-service",
    "aggregator",
    "document-service",
    "document-worker",
    "quiz-service",
    "quiz-worker",
    "chat-service",
    "chat-worker",
    "notification-service",
    "tts-service",
    "stt-service"
)

Write-Host "`nTagging and pushing images with version: $Version" -ForegroundColor Cyan
Write-Host "Registry: $RegistryUrl" -ForegroundColor Cyan
Write-Host ""

foreach ($service in $services) {
    $localImage = "cloud-${service}"
    $remoteImage = "${RegistryUrl}/${service}:${Version}"
    $latestImage = "${RegistryUrl}/${service}:latest"
    
    Write-Host "Processing $service..." -ForegroundColor Yellow
    
    # Tag with version
    docker tag $localImage $remoteImage
    Write-Host "  ✅ Tagged: $remoteImage" -ForegroundColor Green
    
    # Also tag as latest
    docker tag $localImage $latestImage
    Write-Host "  ✅ Tagged: $latestImage" -ForegroundColor Green
    
    # Push version tag
    docker push $remoteImage
    Write-Host "  ✅ Pushed: $remoteImage" -ForegroundColor Green
    
    # Push latest tag
    docker push $latestImage
    Write-Host "  ✅ Pushed: $latestImage" -ForegroundColor Green
    
    Write-Host ""
}

Write-Host "✅ All images tagged and pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Images available at:" -ForegroundColor Cyan
foreach ($service in $services) {
    Write-Host "  - ${RegistryUrl}/${service}:${Version}" -ForegroundColor White
    Write-Host "  - ${RegistryUrl}/${service}:latest" -ForegroundColor White
}

