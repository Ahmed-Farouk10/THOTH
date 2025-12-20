#!/usr/bin/env pwsh
# Deploy Cloud5 Platform to AWS EKS
# This script configures kubectl and deploys the Helm chart

$ErrorActionPreference = "Stop"

$AWS_REGION = "us-east-1"
$CLUSTER_NAME = "cloud5-cluster-prod"
$NAMESPACE = "cloud5-prod"

Write-Host "=== Cloud5 Platform Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Configure kubectl
Write-Host "[1/5] Configuring kubectl for EKS cluster..." -ForegroundColor Yellow
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ kubectl configuration failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ kubectl configured successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Verify cluster access
Write-Host "[2/5] Verifying cluster access..." -ForegroundColor Yellow
$nodes = kubectl get nodes --no-headers 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot access cluster!" -ForegroundColor Red
    Write-Host $nodes
    exit 1
}

$nodeCount = ($nodes | Measure-Object -Line).Lines
Write-Host "✅ Cluster accessible - $nodeCount nodes found" -ForegroundColor Green
Write-Host ""

# Step 3: Build Helm dependencies
Write-Host "[3/5] Building Helm chart dependencies..." -ForegroundColor Yellow
Push-Location helm\cloud5-platform
helm dependency build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Helm dependency build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ Helm dependencies built" -ForegroundColor Green
Write-Host ""

# Step 4: Get RDS endpoint from Terraform
Write-Host "[4/5] Retrieving RDS endpoint..." -ForegroundColor Yellow
Push-Location terraform
$rdsEndpoint = terraform output -raw rds_endpoint 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not retrieve RDS endpoint from Terraform outputs" -ForegroundColor Yellow
    Write-Host "    Helm will use value from values.yaml" -ForegroundColor Yellow
    $rdsEndpoint = $null
}
else {
    Write-Host "✅ RDS Endpoint: $rdsEndpoint" -ForegroundColor Green
}
Pop-Location
Write-Host ""

# Step 5: Deploy Helm chart
Write-Host "[5/5] Deploying Cloud5 platform via Helm..." -ForegroundColor Yellow

$helmArgs = @(
    "install", "cloud5",
    ".\helm\cloud5-platform",
    "--namespace", $NAMESPACE,
    "--create-namespace",
    "--timeout", "20m",
    "--wait"
)

# Add RDS override if available
if ($rdsEndpoint) {
    $helmArgs += "--set"
    $helmArgs += "global.database.host=$rdsEndpoint"
}

helm @helmArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Helm deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Debugging commands:" -ForegroundColor Yellow
    Write-Host "  kubectl get pods -n $NAMESPACE"
    Write-Host "  kubectl describe pod <pod-name> -n $NAMESPACE"
    Write-Host "  kubectl logs <pod-name> -n $NAMESPACE"
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Show deployment status
Write-Host "Checking deployment status..." -ForegroundColor Yellow
kubectl get pods -n $NAMESPACE
Write-Host ""

Write-Host "Getting services..." -ForegroundColor Yellow
kubectl get svc -n $NAMESPACE
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Monitor pods: kubectl get pods -n $NAMESPACE -w"
Write-Host "2. Get aggregator URL: kubectl get svc -n $NAMESPACE aggregator"
Write-Host "3. Access application at: http://<EXTERNAL-IP>"
Write-Host ""
Write-Host "To delete: helm uninstall cloud5 -n $NAMESPACE" -ForegroundColor Yellow
