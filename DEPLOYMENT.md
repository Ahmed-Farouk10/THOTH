# THOTH Docker Swarm Deployment Guide

This guide covers deploying the THOTH platform to AWS using Docker Swarm orchestration.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [AWS Infrastructure Setup](#aws-infrastructure-setup)
4. [Docker Swarm Cluster Setup](#docker-swarm-cluster-setup)
5. [Deployment Process](#deployment-process)
6. [Operations Guide](#operations-guide)
7. [Monitoring & Logging](#monitoring--logging)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Production Stack Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Load Balancer                │
│                  (SSL/TLS Termination)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼────┐                    ┌────▼────┐
    │  Nginx  │                    │Frontend │
    │ Gateway │                    │  (x3)   │
    │  (x2)   │                    └─────────┘
    └────┬────┘
         │
    ┌────▼──────────────────────────────────────────────┐
    │         Microservices (Docker Swarm)              │
    ├───────────────────────────────────────────────────┤
    │ • User Service (x3)                               │
    │ • Aggregator (x3)                                 │
    │ • Document Service (x3) + Worker (x5)             │
    │ • Notification Service (x3)                       │
    │ • Quiz Service (x3) + Worker (x4)                 │
    │ • Chat Service (x3) + Worker (x4)                 │
    │ • TTS Service (x3)                                │
    │ • STT Service (x3)                                │
    └───────────────┬───────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼────┐         ┌─────▼─────┐
    │   RDS   │         │    MSK    │
    │PostgreSQL│         │  Kafka    │
    │  (x5)   │         │  (3-AZ)   │
    └─────────┘         └───────────┘
         │
    ┌────▼────┐         ┌───────────┐
    │DocumentDB│         │    S3     │
    │ MongoDB │         │ Documents │
    └─────────┘         └───────────┘
```

### Docker Swarm Cluster

- **Manager Nodes**: 3 (t3.medium) - Quorum for high availability
- **Worker Nodes**: 6-20 (t3.large) - Auto-scaling for workload
- **Overlay Networks**: Internal service mesh
- **Secrets Management**: Docker secrets + AWS Secrets Manager

---

## ✅ Prerequisites

### Local Development Machine

- Docker Engine 20.10+
- Docker Compose V2
- AWS CLI v2
- Terraform 1.5+
- Git
- jq (for JSON parsing)

### AWS Requirements

- AWS Account with appropriate permissions
- IAM role for EC2 instances
- VPC with public/private subnets
- Route53 hosted zone (for domain)
- ACM certificate (for HTTPS)

### Access & Credentials

- AWS Access Key & Secret Key
- SSH key pair for EC2 instances
- API keys for:
  - Groq (6 keys for load balancing)
  - Google Gemini API
  - AWS SES (for email notifications)

---

## 🌐 AWS Infrastructure Setup

### 1. Initialize Terraform

```bash
cd terraform/environments/prod
terraform init
```

### 2. Configure Variables

Create `terraform.tfvars`:

```hcl
aws_region          = "us-east-1"
environment         = "prod"
vpc_cidr            = "10.0.0.0/16"
availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]

# EC2 Swarm Cluster
swarm_manager_count = 3
swarm_worker_count  = 6
manager_instance_type = "t3.medium"
worker_instance_type  = "t3.large"

# RDS Databases
rds_instance_class    = "db.t3.medium"
rds_allocated_storage = 100
rds_multi_az          = true

# MSK Kafka
msk_instance_type     = "kafka.t3.small"
msk_broker_count      = 3

# DocumentDB
docdb_instance_class  = "db.t3.medium"
docdb_cluster_size    = 3

# S3 Buckets
s3_documents_bucket   = "thoth-documents-prod"

# Domain
domain_name           = "thoth.yourdomain.com"
acm_certificate_arn   = "arn:aws:acm:us-east-1:xxx:certificate/xxx"
```

### 3. Deploy Infrastructure

```bash
# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Save outputs
terraform output -json > ../../../.terraform-outputs.json
```

### 4. Store Secrets in AWS Secrets Manager

```bash
# JWT Secret
aws secretsmanager create-secret \
    --name thoth/prod/jwt_secret \
    --secret-string "your-jwt-secret-key"

# Database Passwords
aws secretsmanager create-secret \
    --name thoth/prod/user_db_password \
    --secret-string "$(openssl rand -base64 32)"

# API Keys
aws secretsmanager create-secret \
    --name thoth/prod/groq_api_key_1 \
    --secret-string "gsk_xxxxx"

# Repeat for all secrets listed in docker-compose.prod.yml
```

---

## 🐳 Docker Swarm Cluster Setup

### 1. SSH into Manager Node 1

```bash
# Get manager IP from Terraform outputs
MANAGER_IP=$(terraform output -json | jq -r '.swarm_manager_ips.value[0]')
ssh -i ~/.ssh/your-key.pem ec2-user@$MANAGER_IP
```

### 2. Initialize Swarm

```bash
# On Manager 1
docker swarm init --advertise-addr $(hostname -i)

# Get join tokens
MANAGER_TOKEN=$(docker swarm join-token manager -q)
WORKER_TOKEN=$(docker swarm join-token worker -q)
MANAGER_IP=$(hostname -i)
```

### 3. Join Other Managers

```bash
# On Manager 2 and 3
docker swarm join --token $MANAGER_TOKEN $MANAGER_IP:2377
```

### 4. Join Worker Nodes

```bash
# On all worker nodes
docker swarm join --token $WORKER_TOKEN $MANAGER_IP:2377
```

### 5. Label Nodes

```bash
# Label nodes for Kafka (on managers)
docker node update --label-add kafka=true manager-1
docker node update --label-add kafka=true manager-2
docker node update --label-add kafka=true manager-3

# Label high-compute workers
docker node update --label-add compute=high worker-1
docker node update --label-add compute=high worker-2
docker node update --label-add compute=high worker-3
```

### 6. Verify Cluster

```bash
docker node ls
```

Expected output:
```
ID                    HOSTNAME   STATUS   AVAILABILITY   MANAGER STATUS
xxx *                 manager-1  Ready    Active         Leader
xxx                   manager-2  Ready    Active         Reachable
xxx                   manager-3  Ready    Active         Reachable
xxx                   worker-1   Ready    Active
xxx                   worker-2   Ready    Active
...
```

---

## 🚀 Deployment Process

### Method 1: Using Deployment Script (Recommended)

#### On Linux/macOS:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy to production
./scripts/deploy-swarm.sh prod v1.0.0
```

#### On Windows (PowerShell):

```powershell
.\scripts\deploy-swarm.ps1 -Environment prod -ImageTag v1.0.0
```

### Method 2: Manual Deployment

#### 1. Load Environment Variables

```bash
# Copy template
cp .env.prod.template .env.prod

# Edit with actual values
nano .env.prod

# Load variables
set -a
source .env.prod
set +a
```

#### 2. Create Docker Secrets

```bash
# Sync all secrets from AWS Secrets Manager
aws secretsmanager get-secret-value \
    --secret-id thoth/prod/jwt_secret \
    --query 'SecretString' \
    --output text | \
    docker secret create jwt_secret -

# Repeat for all secrets...
```

#### 3. Create Docker Configs

```bash
docker config create nginx_config nginx/nginx.conf
```

#### 4. Deploy Stack

```bash
docker stack deploy \
    --compose-file docker-compose.prod.yml \
    --with-registry-auth \
    thoth
```

#### 5. Verify Deployment

```bash
# Check services
docker stack services thoth

# Check specific service
docker service ps thoth_user-service

# View logs
docker service logs thoth_user-service --follow
```

---

## 🔧 Operations Guide

### Scaling Services

```bash
# Scale document workers for high load
./scripts/scale-service.sh document-worker 10

# Scale down during low traffic
./scripts/scale-service.sh document-worker 3

# Manual scaling
docker service scale thoth_document-worker=10
```

### Rolling Updates

```bash
# Update user service image
docker service update \
    --image ${ECR_REGISTRY}/thoth-user-service:v1.1.0 \
    --update-parallelism 1 \
    --update-delay 10s \
    thoth_user-service
```

### Rollback

```bash
# Using script
./scripts/rollback-swarm.sh user-service

# Manual rollback
docker service rollback thoth_user-service
```

### Health Checks

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check specific service health
docker service ps thoth_user-service

# View service inspect
docker service inspect thoth_user-service --pretty
```

### Managing Secrets

```bash
# Update a secret (requires service restart)
# 1. Create new version
echo "new-secret-value" | docker secret create jwt_secret_v2 -

# 2. Update service to use new secret
docker service update \
    --secret-rm jwt_secret \
    --secret-add source=jwt_secret_v2,target=jwt_secret \
    thoth_user-service

# 3. Remove old secret after all services updated
docker secret rm jwt_secret
docker secret rename jwt_secret_v2 jwt_secret
```

### Draining Nodes (for Maintenance)

```bash
# Drain a node (move workloads to other nodes)
docker node update --availability drain worker-3

# Bring back online
docker node update --availability active worker-3
```

---

## 📊 Monitoring & Logging

### CloudWatch Integration

All services automatically send logs to CloudWatch Logs:

```bash
# View logs in CloudWatch
aws logs tail /aws/ecs/thoth/user-service --follow
```

### Prometheus & Grafana (Optional)

Deploy monitoring stack:

```bash
docker stack deploy -c docker-compose.monitoring.yml monitoring
```

Access Grafana: `http://<manager-ip>:3000`

### Service Metrics

```bash
# View service stats
docker stats $(docker ps --format '{{.Names}}')

# View specific service
docker service ps thoth_document-worker --format "table {{.Name}}\t{{.Node}}\t{{.CurrentState}}"
```

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check service logs
docker service logs thoth_user-service --tail 100

# Inspect service
docker service inspect thoth_user-service

# Check task state
docker service ps thoth_user-service --no-trunc
```

### Connection Issues Between Services

```bash
# Test network connectivity
docker exec $(docker ps -q -f name=thoth_user-service) ping kafka

# Check overlay network
docker network inspect thoth_platform-network
```

### Database Connection Failures

```bash
# Check RDS connectivity from EC2
telnet user-db.xxxxx.us-east-1.rds.amazonaws.com 5432

# Verify security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### High Memory/CPU Usage

```bash
# Check resource usage
docker stats --no-stream

# Scale up if needed
./scripts/scale-service.sh document-worker 8
```

### Secrets Not Loading

```bash
# Verify secret exists
docker secret ls

# Check service has access
docker service inspect thoth_user-service --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}'
```

---

## 📚 Additional Resources

- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [AWS EC2 Best Practices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-best-practices.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

---

## 🔐 Security Best Practices

1. **Secrets Management**: Never commit secrets to Git. Always use AWS Secrets Manager or Docker secrets.
2. **Network Isolation**: Use private subnets for databases and services.
3. **IAM Roles**: Use EC2 instance profiles instead of hardcoded credentials.
4. **Image Scanning**: Scan Docker images for vulnerabilities before deployment.
5. **SSL/TLS**: Always use HTTPS in production (configured on ALB).
6. **Database Encryption**: Enable encryption at rest for RDS and DocumentDB.

---

## 📝 Deployment Checklist

- [ ] AWS infrastructure provisioned (Terraform)
- [ ] Docker Swarm cluster initialized (3 managers + workers)
- [ ] Secrets stored in AWS Secrets Manager
- [ ] Docker secrets created in Swarm
- [ ] Docker configs created (Nginx)
- [ ] Node labels applied
- [ ] Environment variables configured
- [ ] Images pushed to ECR
- [ ] Stack deployed successfully
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backups scheduled (RDS, DocumentDB)
- [ ] DNS records updated (Route53)
- [ ] SSL certificate configured (ALB)
