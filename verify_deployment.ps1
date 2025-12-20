# ============================================================================
# KUBERNETES DEPLOYMENT VERIFICATION
# ============================================================================
# Use this script to verify the Kubernetes deployment after deploying manually
# Run: .\verify_deployment.ps1

$ErrorActionPreference = "Stop"

$NAMESPACE = "cloud5-prod"

Write-Host "=== Cloud5 Deployment Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check kubectl access
Write-Host "[1/6] Checking cluster access..." -ForegroundColor Yellow
try {
    $nodes = kubectl get nodes --no-headers 2>&1
    if ($LASTEXITCODE -ne 0) { throw $nodes }
    $nodeCount = ($nodes | Measure-Object -Line).Lines
    Write-Host "✅ Connected to cluster - $nodeCount nodes found" -ForegroundColor Green
}
catch {
    Write-Host "❌ Cannot access cluster!" -ForegroundColor Red
    Write-Host "Run: aws eks update-kubeconfig --region us-east-1 --name cloud5-cluster-prod" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check namespace
Write-Host "[2/6] Checking namespace..." -ForegroundColor Yellow
$ns = kubectl get namespace $NAMESPACE --no-headers 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Namespace '$NAMESPACE' exists" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Namespace '$NAMESPACE' not found - Helm not deployed yet" -ForegroundColor Yellow
}
Write-Host ""

# Check Helm release
Write-Host "[3/6] Checking Helm release..." -ForegroundColor Yellow
$release = helm list -n $NAMESPACE --no-headers 2>&1
if ($LASTEXITCODE -eq 0 -and $release) {
    Write-Host "✅ Helm release 'cloud5' found" -ForegroundColor Green
    helm status cloud5 -n $NAMESPACE
}
else {
    Write-Host "⚠️  Helm release not found - run .\deploy.ps1 to deploy" -ForegroundColor Yellow
}
Write-Host ""

# Check pods
Write-Host "[4/6] Checking pods..." -ForegroundColor Yellow
$pods = kubectl get pods -n $NAMESPACE --no-headers 2>&1
if ($LASTEXITCODE -eq 0 -and $pods) {
    $totalPods = ($pods | Measure-Object -Line).Lines
    $runningPods = ($pods | Select-String "Running").Count
    
    Write-Host "Pods: $runningPods/$totalPods running" -ForegroundColor Cyan
    kubectl get pods -n $NAMESPACE
    
    if ($runningPods -eq $totalPods) {
        Write-Host "✅ All pods running!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Some pods not ready yet" -ForegroundColor Yellow
        Write-Host "Monitor with: kubectl get pods -n $NAMESPACE -w" -ForegroundColor Cyan
    }
}
else {
    Write-Host "⚠️  No pods found" -ForegroundColor Yellow
}
Write-Host ""

# Check services
Write-Host "[5/6] Checking services..." -ForegroundColor Yellow
$services = kubectl get svc -n $NAMESPACE --no-headers 2>&1
if ($LASTEXITCODE -eq 0 -and $services) {
    kubectl get svc -n $NAMESPACE
    
    # Find aggregator external IP
    $aggregator = kubectl get svc -n $NAMESPACE aggregator -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null
    if ($aggregator) {
        Write-Host ""
        Write-Host "✅ Aggregator URL: http://$aggregator" -ForegroundColor Green
        Write-Host "   Test with: curl http://$aggregator/health" -ForegroundColor Cyan
    }
    else {
        Write-Host "⚠️  Aggregator LoadBalancer pending..." -ForegroundColor Yellow
    }
}
else {
    Write-Host "⚠️  No services found" -ForegroundColor Yellow
}
Write-Host ""

# Check Terraform outputs
Write-Host "[6/6] Checking Terraform outputs..." -ForegroundColor Yellow
Push-Location terraform
try {
    $rdsEndpoint = terraform output -raw rds_endpoint 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  RDS Endpoint: $rdsEndpoint" -ForegroundColor Cyan
    }
    
    $vpcId = terraform output -raw vpc_id 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  VPC ID: $vpcId" -ForegroundColor Cyan
    }
    
    $eksCluster = terraform output -raw eks_cluster_name 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  EKS Cluster: $eksCluster" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "⚠️  Could not read Terraform outputs" -ForegroundColor Yellow
}
finally {
    Pop-Location
}
Write-Host ""

Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
