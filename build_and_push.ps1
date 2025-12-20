#!/usr/bin/env pwsh
# Build and Push All Services to AWS ECR
# This script builds Docker images for all microservices and pushes them to ECR

$ErrorActionPreference = "Stop"

# Configuration
$AWS_REGION = "us-east-1"
$AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

Write-Host "=== Cloud5 Docker Build & Push ===" -ForegroundColor Cyan
Write-Host "AWS Account: $AWS_ACCOUNT_ID" -ForegroundColor Green
Write-Host "ECR Registry: $ECR_REGISTRY" -ForegroundColor Green
Write-Host ""

# Login to ECR
Write-Host "[1/9] Logging into AWS ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ECR login failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Successfully logged into ECR" -ForegroundColor Green
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
    
    # Build the Docker image
    docker build -t $serviceName $context
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed for $serviceName" -ForegroundColor Red
        exit 1
    }
    
    # Tag for ECR
    docker tag "${serviceName}:latest" $imageTag
    
    # Push to ECR
    Write-Host "    Pushing to ECR..." -ForegroundColor Cyan
    docker push $imageTag
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed for $serviceName" -ForegroundColor Red
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
Write-Host "1. aws eks update-kubeconfig --region $AWS_REGION --name cloud5-cluster-prod"
Write-Host "2. cd helm"
Write-Host "3. helm dependency build cloud5-platform"
Write-Host "4. helm install cloud5 cloud5-platform -n cloud5-prod --create-namespace --timeout 15m"
