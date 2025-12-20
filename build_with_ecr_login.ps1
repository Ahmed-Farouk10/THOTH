#!/usr/bin/env pwsh
# Complete ECR Login and Build Script
# This handles ECR authentication and then builds/pushes all images

$ErrorActionPreference = "Stop"

$AWS_REGION = "us-east-1"
$AWS_ACCOUNT_ID = "945489595584"
$ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

Write-Host "=== ECR Login & Build ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get ECR login password using AWS Tools for PowerShell
Write-Host "[1/2] Logging into AWS ECR..." -ForegroundColor Yellow

try {
    # Use AWS Tools for PowerShell instead of AWS CLI
    (Get-ECRLoginCommand -Region $AWS_REGION).Password | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker login failed"
    }
    
    Write-Host "✅ Successfully logged into ECR" -ForegroundColor Green
}
catch {
    Write-Host "❌ ECR login failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure AWS Tools for PowerShell is installed:" -ForegroundColor Yellow
    Write-Host "  Install-Module -Name AWS.Tools.ECR -Force" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "And AWS credentials are set:" -ForegroundColor Yellow
    Write-Host '  Set-AWSCredential -AccessKey $env:AWS_ACCESS_KEY_ID -SecretKey $env:AWS_SECRET_ACCESS_KEY -SessionToken $env:AWS_SESSION_TOKEN -StoreAs default' -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Step 2: Run the build and push script
Write-Host "[2/2] Starting build and push..." -ForegroundColor Yellow
.\build_and_push_simple.ps1
