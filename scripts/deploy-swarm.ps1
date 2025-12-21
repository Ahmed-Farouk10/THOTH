# ==============================================================================
# Deploy THOTH Stack to Docker Swarm (PowerShell)
# Usage: .\deploy-swarm.ps1 -Environment prod -ImageTag v1.2.3
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

# Configuration
$StackName = "thoth"
$ComposeFile = "docker-compose.prod.yml"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║        THOTH Docker Swarm Deployment Script               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Environment: " -NoNewline -ForegroundColor Yellow
Write-Host $Environment
Write-Host "Image Tag: " -NoNewline -ForegroundColor Yellow
Write-Host $ImageTag
Write-Host "Stack Name: " -NoNewline -ForegroundColor Yellow
Write-Host $StackName
Write-Host ""

# Load environment variables
$EnvFile = ".env.$Environment"
if (Test-Path $EnvFile) {
    Write-Host "✓ Loading environment variables from $EnvFile" -ForegroundColor Green
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
} else {
    Write-Host "✗ Environment file $EnvFile not found!" -ForegroundColor Red
    Write-Host "  Create it from .env.$Environment.template"
    exit 1
}

# Set IMAGE_TAG
[Environment]::SetEnvironmentVariable("IMAGE_TAG", $ImageTag, "Process")

# Check if Swarm is initialized
$swarmInfo = docker info --format '{{.Swarm.LocalNodeState}}'
if ($swarmInfo -ne "active") {
    Write-Host "✗ Docker Swarm is not initialized!" -ForegroundColor Red
    Write-Host "  Run: docker swarm init"
    exit 1
}

Write-Host "✓ Docker Swarm is active" -ForegroundColor Green

# Create/Update secrets from AWS Secrets Manager
Write-Host ""
Write-Host "Syncing secrets from AWS Secrets Manager..." -ForegroundColor Yellow

$Secrets = @(
    "jwt_secret",
    "aws_access_key",
    "aws_secret_key",
    "user_db_password",
    "document_db_password",
    "notification_db_password",
    "quiz_db_password",
    "chat_db_password",
    "groq_api_key_1",
    "groq_api_key_2",
    "groq_api_key_3",
    "groq_api_key_4",
    "groq_api_key_5",
    "groq_api_key_6",
    "google_api_key",
    "chat_google_api_key"
)

foreach ($secret in $Secrets) {
    $exists = docker secret inspect $secret 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⊙ Secret $secret already exists (skipping)" -ForegroundColor Yellow
    } else {
        Write-Host "+ Creating secret: $secret" -ForegroundColor Green
        $secretValue = aws secretsmanager get-secret-value `
            --secret-id "thoth/$Environment/$secret" `
            --query 'SecretString' `
            --output text
        $secretValue | docker secret create $secret -
    }
}

# Create/Update Nginx config
Write-Host ""
Write-Host "Updating Nginx configuration..." -ForegroundColor Yellow
$configExists = docker config inspect nginx_config 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "⊙ Config nginx_config already exists" -ForegroundColor Yellow
    Write-Host "  To update, remove with: docker config rm nginx_config"
} else {
    Write-Host "+ Creating config: nginx_config" -ForegroundColor Green
    docker config create nginx_config nginx/nginx.conf
}

# Label nodes
Write-Host ""
Write-Host "Checking node labels..." -ForegroundColor Yellow

$managerNodes = docker node ls --filter "role=manager" -q
foreach ($node in $managerNodes) {
    docker node update --label-add kafka=true $node 2>$null
}

$workerNodes = docker node ls --filter "role=worker" -q | Select-Object -First 3
foreach ($node in $workerNodes) {
    docker node update --label-add compute=high $node 2>$null
}

Write-Host "✓ Node labels configured" -ForegroundColor Green

# Deploy the stack
Write-Host ""
Write-Host "Deploying stack: $StackName..." -ForegroundColor Yellow
docker stack deploy --compose-file $ComposeFile --with-registry-auth $StackName

Write-Host ""
Write-Host "✓ Stack deployment initiated" -ForegroundColor Green

# Wait for services to start
Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Show stack status
Write-Host ""
Write-Host "Stack Services:" -ForegroundColor Yellow
docker stack services $StackName

Write-Host ""
Write-Host "Service Logs (recent):" -ForegroundColor Yellow
Write-Host "  View logs: docker service logs ${StackName}_<service-name>"
Write-Host "  Example: docker service logs ${StackName}_user-service"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deployment Complete!                                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Monitor deployment: " -NoNewline -ForegroundColor Yellow
Write-Host "docker stack ps $StackName"
Write-Host "View services: " -NoNewline -ForegroundColor Yellow
Write-Host "docker stack services $StackName"
Write-Host "Remove stack: " -NoNewline -ForegroundColor Yellow
Write-Host "docker stack rm $StackName"
Write-Host ""
