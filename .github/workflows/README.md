# THOTH CI/CD Workflows

GitHub Actions workflows for automated testing, building, and deployment of the THOTH platform to AWS Docker Swarm.

## 📋 Workflows Overview

### 1. **CI - Pull Request Checks** (`ci-pr-check.yml`)

**Trigger:** Pull requests to `main` or `develop` branches

**Purpose:** Validate code changes before merging

**Steps:**

- ✅ Build all 10 services (9 microservices + nginx)
- ✅ Run health checks with test dependencies (PostgreSQL, Kafka)
- ✅ Lint Dockerfiles with Hadolint
- ✅ Security scan with Trivy
- ✅ Comment PR with build status

**Services tested:**

- aggregator
- user-service
- document-service
- notification-service
- chat-service
- quiz-service
- tts-service
- stt-service
- frontend
- nginx

---

### 2. **CD - Deploy to Dev** (`cd-dev.yml`)

**Trigger:** Push to `develop` branch

**Purpose:** Continuous deployment to development environment

**Steps:**

1. Build Docker images
2. Push to Amazon ECR with tags: `dev-latest`, `dev-<commit-sha>`
3. Deploy to dev Swarm cluster via SSH
4. Run health checks
5. Send notification

**Environment:** `dev`

**Image Tags:** `dev-latest`, `dev-<sha>`

---

### 3. **CD - Deploy to Staging** (`cd-staging.yml`)

**Trigger:** Push to `staging` branch

**Purpose:** Pre-production validation with full testing

**Steps:**

1. Run security vulnerability scan (fail on HIGH/CRITICAL)
2. Build and push images to ECR
3. Deploy to staging Swarm cluster
4. Wait 60s for service stabilization
5. Run comprehensive health checks
6. Execute smoke tests against all service endpoints
7. Send notification

**Environment:** `staging`

**Image Tags:** `staging-latest`, `staging-<sha>`

---

### 4. **CD - Deploy to Production** (`cd-production.yml`)

**Trigger:**

- Release published
- Manual workflow dispatch

**Purpose:** Blue-green production deployment with rollback capability

**Steps:**

1. **Manual Approval** - Requires approval via GitHub Environments
2. **Security Scan** - Comprehensive vulnerability check
3. **Build & Sign** - Push to ECR and sign with Cosign
4. **Backup** - Save current stack configuration
5. **Blue-Green Deploy** - Deploy new version alongside current
6. **Health Check** - Verify new stack health (120s)
7. **Smoke Tests** - Production critical path validation
8. **Traffic Switch** - Route traffic to new version
9. **Monitor** - Watch for 5 minutes post-deployment
10. **Rollback** - Automatic if any step fails

**Environment:** `production`

**Image Tags:** `latest`, `<version>`, `prod-<sha>`

---

## 🔐 Required Secrets

Configure in `Settings > Secrets and variables > Actions`:

```
AWS_ROLE_ARN             # IAM role ARN for OIDC
SSH_PRIVATE_KEY          # SSH key for Swarm manager access
```

## 🚀 Usage

### Development Flow

```bash
# Create PR → CI runs automatically
# Merge → Deploys to dev automatically
```

### Production Deployment

```bash
# Create release tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# Requires manual approval in GitHub UI
# Blue-green deployment with automatic rollback
```

---

## 📊 Workflow Diagram

```
Pull Request → CI Check → Merge → Dev → Staging → Production
                  │                         │          │
                  └─ Tests                  └─ Tests   └─ Manual Approval
                     Security Scan             Smoke      Blue-Green
                                                         Auto Rollback
```

For detailed setup instructions, see [DEPLOYMENT.md](../../DEPLOYMENT.md)
