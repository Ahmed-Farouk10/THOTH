# Deploy Cloud5 Platform to Kubernetes (PowerShell)
# Usage: .\deploy.ps1 [namespace] [release-name]

param(
    [string]$Namespace = "cloud5-prod",
    [string]$ReleaseName = "cloud5"
)

Write-Host "Deploying Cloud5 Platform" -ForegroundColor Green
Write-Host "Namespace: $Namespace"
Write-Host "Release: $ReleaseName"
Write-Host ""

# Create namespace if it doesn't exist
Write-Host "Creating namespace..." -ForegroundColor Yellow
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

# Update Helm dependencies
Write-Host "Updating Helm dependencies..." -ForegroundColor Yellow
Push-Location helm/cloud5-platform
helm dependency update
Pop-Location

# Install/Upgrade the platform
Write-Host "Installing Cloud5 platform..." -ForegroundColor Yellow
helm upgrade --install $ReleaseName ./helm/cloud5-platform `
  --namespace $Namespace `
  --timeout 15m `
  --wait `
  --atomic `
  --create-namespace

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Check deployment status:"
Write-Host "  kubectl get pods -n $Namespace"
Write-Host "  kubectl get svc -n $Namespace"
Write-Host ""
Write-Host "Get Aggregator LoadBalancer URL:"
Write-Host "  kubectl get svc aggregator -n $Namespace"
