# Build and Push All Services to AWS ECR (Simplified Version)
# This version uses hardcoded account ID to avoid AWS CLI PATH issues

$ErrorActionPreference = "Stop"

# Configuration (Hardcoded for reliability)
$AWS_REGION = "us-east-1"
$AWS_ACCOUNT_ID = "945489595584"  # From Terraform outputs
$ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

Write-Host "=== Cloud5 Docker Build & Push ===" -ForegroundColor Cyan
Write-Host "AWS Account: $AWS_ACCOUNT_ID" -ForegroundColor Green
Write-Host "ECR Registry: $ECR_REGISTRY" -ForegroundColor Green
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
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Note about ECR login
Write-Host "⚠️  IMPORTANT: ECR Login Required" -ForegroundColor Yellow
Write-Host "If you haven't logged into ECR yet, run this command manually:" -ForegroundColor Cyan
Write-Host "aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to continue (assuming you're already logged in)..." -ForegroundColor Yellow
Read-Host
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

foreach ($service in $services.GetEnumerator()) {
    $serviceName = $service.Key
    $context = $service.Value
    $imageTag = "${ECR_REGISTRY}/${serviceName}:latest"
    
    Write-Host "[$counter/$total] Building ${serviceName}..." -ForegroundColor Yellow
    Write-Host "    Service directory: $context" -ForegroundColor Cyan
    
    # Build the Docker image from parent context with -f flag
    # Dockerfiles expect ./shared to be accessible, so we build from current directory
    docker build -t $serviceName -f "${context}/Dockerfile" .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed for $serviceName" -ForegroundColor Red
        Write-Host "Check the Dockerfile in: $context" -ForegroundColor Yellow
        exit 1
    }
    
    # Tag for ECR
    docker tag "${serviceName}:latest" $imageTag
    
    # Push to ECR
    Write-Host "    Pushing to ECR..." -ForegroundColor Cyan
    docker push $imageTag
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed for $serviceName" -ForegroundColor Red
        Write-Host "Make sure you're logged into ECR!" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ $serviceName successfully pushed to ECR" -ForegroundColor Green
    Write-Host ""
    
    $counter++
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ All services built and pushed!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. .\deploy.ps1  # Deploy to Kubernetes"
Write-Host "2. .\verify_deployment.ps1  # Verify everything works"
