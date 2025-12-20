# Cloud5 Platform - AWS Deployment Guide

## 🎯 Quick Start (3 Commands)

If AWS credentials are fresh and infrastructure is deployed:

```powershell
# 1. Build and push Docker images (15-20 minutes)
.\build_and_push.ps1

# 2. Deploy to Kubernetes (10-15 minutes)
.\deploy.ps1

# 3. Verify
kubectl get pods -n cloud5-prod -w
```

---

## 📋 Prerequisites

✅ AWS Academy credentials configured  
✅ Terraform infrastructure deployed (`terraform apply` completed)  
✅ Docker Desktop running  
✅ `kubectl` and `helm` installed  

---

## 🚀 Step-by-Step Deployment

### Step 1: Refresh AWS Credentials

AWS Academy tokens expire frequently. Always start

 here:

```powershell
# Get fresh credentials from AWS Academy Learner Lab
$env:AWS_ACCESS_KEY_ID="ASIA..."
$env:AWS_SECRET_ACCESS_KEY="..."
$env:AWS_SESSION_TOKEN="..."

# Verify
aws sts get-caller-identity
```

### Step 2: Build and Push Docker Images

This builds all 8 microservices and pushes them to ECR:

```powershell
.\build_and_push.ps1
```

**What it does:**
- Logs into ECR
- Builds: document-reader, quiz-service, chat-service, tts-service, stt-service, user-service, aggregator, notification-service
- Tags and pushes to ECR (e.g., `945489595584.dkr.ecr.us-east-1.amazonaws.com/document-reader:latest`)

**Duration:** 15-20 minutes (depends on your CPU)

### Step 3: Deploy to Kubernetes

```powershell
.\deploy.ps1
```

**What it does:**
- Configures `kubectl` to talk to your EKS cluster
- Builds Helm chart dependencies (Kafka, PostgreSQL)
- Deploys the `cloud5-platform` umbrella chart
- Waits for all pods to become ready

**Duration:** 10-15 minutes (Kafka takes the longest)

### Step 4: Verify Deployment

```powershell
# Watch pods start
kubectl get pods -n cloud5-prod -w

# Get services (find LoadBalancer URL)
kubectl get svc -n cloud5-prod

# Test the application
$ALB_URL = (kubectl get svc -n cloud5-prod aggregator -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl "http://$ALB_URL/health"
```

---

## 🛑 Troubleshooting

### ❌ "Cannot connect to Docker daemon"
**Solution:** Start Docker Desktop

### ❌ "Error: UPGRADE FAILED: context deadline exceeded"
**Cause:** Pods didn't start within timeout (20 minutes)

**Debug:**
```powershell
kubectl get pods -n cloud5-prod
kubectl describe pod <pod-name> -n cloud5-prod
kubectl logs <pod-name> -n cloud5-prod
```

**Common Issues:**
- **ImagePullBackOff:** Docker images not in ECR → Run `.\build_and_push.ps1`
- **CrashLoopBackOff:** Check logs → Usually DB connection or environment variable issue

### ❌ "The server has asked for the client to provide credentials"
**Cause:** AWS session token expired

**Solution:** Refresh credentials (Step 1)

### ❌ Kafka pods stuck in "Pending"
**Cause:** Not enough cluster resources

**Solution:**
```powershell
# Check node resources
kubectl top nodes

# Scale down Kafka if needed (edit values.yaml)
# kafka.combined.replicaCount: 1
```

---

## 🧹 Cleanup

**Delete Application (Keep Infrastructure):**
```powershell
helm uninstall cloud5 -n cloud5-prod
```

**Delete Everything (Including EKS, RDS, VPC):**
```powershell
# 1. Delete Helm release first
helm uninstall cloud5 -n cloud5-prod

# 2. Wait for LoadBalancer deletion (important!)
kubectl get svc -n cloud5-prod

# 3. Destroy infrastructure
cd terraform
terraform destroy -auto-approve
```

**Cost:** Estimate ~$300/month if left running

---

## 📊 Verification Checklist

- [ ] All 8 service pods in `Running` state
- [ ] Kafka pod(s) in `Running` state  
- [ ] PostgreSQL pod in `Running` state
- [ ] Aggregator service has `EXTERNAL-IP` assigned
- [ ] `/health` endpoint returns HTTP 200
- [ ] Can upload a document via `/api/documents` (test with Postman)

---

## 🎓 For Your Report

**Deployment Architecture:**
- **Infrastructure:** Terraform (VPC, EKS, RDS, S3, IAM)
- **Orchestration:** Kubernetes (v1.29)
- **Packaging:** Helm (Umbrella chart)
- **CI/CD Ready:** PowerShell scripts for automation

**Key Achievements:**
✅ Production-grade security (IRSA, private subnets, VPC Flow Logs)  
✅ Storage isolation (6 S3 buckets, service-specific IAM policies)  
✅ Scalability (HPA configured, auto-scaling nodes)  
✅ Cost-optimized (Combined Kafka KRaft mode, single RDS instance)  

---

## 📞 Help

If stuck, check:
1. **Pod logs:** `kubectl logs <pod-name> -n cloud5-prod`
2. **Helm status:** `helm status cloud5 -n cloud5-prod`
3. **Terraform outputs:** `cd terraform && terraform output`
