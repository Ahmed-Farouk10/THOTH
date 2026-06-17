# THOTH Terraform Modules

This directory contains reusable Terraform modules for provisioning AWS infrastructure for the THOTH platform.

## 📁 Module Structure

```
terraform/
├── modules/              # Reusable modules
│   ├── vpc/             # VPC, subnets, NAT gateways
│   ├── security-groups/ # Security groups for all services
│   ├── swarm-cluster/   # EC2 instances for Docker Swarm
│   ├── rds/             # PostgreSQL databases (5 instances)
│   ├── documentdb/      # MongoDB-compatible DocumentDB
│   ├── msk/             # Managed Kafka (MSK)
│   ├── s3/              # S3 buckets for documents
│   ├── ecr/             # Container registries
│   ├── alb/             # Application Load Balancer
│   └── iam/             # IAM roles and policies
└── environments/         # Environment-specific configs
    ├── prod/            # Production
    ├── staging/         # Staging
    └── dev/             # Development
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install Terraform
brew install terraform  # macOS
# or
choco install terraform  # Windows

# Verify installation
terraform --version

# Configure AWS CLI
aws configure
```

### Initial Setup

1. **Copy terraform.tfvars template:**

   ```bash
   cd terraform/environments/prod
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit terraform.tfvars:**

   ```bash
   nano terraform.tfvars
   ```

   Fill in TODO values:

   - `ssh_public_key` - Your SSH public key
   - `github_repo` - Your GitHub repository
   - `domain_name` - Your domain (optional)

3. **Initialize Terraform:**

   ```bash
   terraform init
   ```

4. **Plan infrastructure:**

   ```bash
   terraform plan -out=tfplan
   ```

5. **Review and apply:**
   ```bash
   terraform apply tfplan
   ```

## ⚠️ Module Completion Status

**IMPORTANT:** The module source files are **placeholder templates** and need to be implemented.

### ✅ Ready

- Main configuration structure
- Variable definitions
- Output definitions

### 🚧 TODO (Need Implementation)

- [ ] `modules/vpc/` - VPC and networking
- [ ] `modules/security-groups/` - Security group rules
- [ ] `modules/swarm-cluster/` - EC2 Auto Scaling
- [ ] `modules/rds/` - RDS database setup
- [ ] `modules/documentdb/` - DocumentDB cluster
- [ ] `modules/msk/` - MSK Kafka cluster
- [ ] `modules/s3/` - S3 bucket configuration
- [ ] `modules/ecr/` - ECR repositories
- [ ] `modules/alb/` - Load balancer setup
- [ ] `modules/iam/` - IAM roles and OIDC

## 📝 What to Do When You Have AWS Access

### Step 1: Create Module Implementations

Each module needs these files:

```
modules/MODULE_NAME/
├── main.tf       # Main resource definitions
├── variables.tf  # Input variables
├── outputs.tf    # Output values
└── README.md     # Module documentation
```

### Step 2: Test in Dev Environment

```bash
# Start with dev environment (smaller, cheaper)
cd terraform/environments/dev

# Update variables for dev
cp ../prod/terraform.tfvars.example terraform.tfvars
# Edit: reduce instance counts, use smaller instance types

# Initialize and plan
terraform init
terraform plan

# Apply if plan looks good
terraform apply
```

### Step 3: Validate Infrastructure

```bash
# Save outputs
terraform output -json > ../../../.terraform-outputs.json

# Verify resources created
aws ec2 describe-instances --filters "Name=tag:Project,Values=THOTH"
aws rds describe-db-instances
aws msk list-clusters
```

### Step 4: Enable Remote State

After first successful apply:

1. **Create S3 bucket for state:**

   ```bash
   aws s3 mb s3://thoth-terraform-state-prod
   ```

2. **Create DynamoDB table for locking:**

   ```bash
   aws dynamodb create-table \
     --table-name thoth-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

3. **Uncomment backend in main.tf:**

   ```hcl
   backend "s3" {
     bucket         = "thoth-terraform-state-prod"
     key            = "prod/terraform.tfstate"
     region         = "us-east-1"
     encrypt        = true
     dynamodb_table = "thoth-terraform-locks"
   }
   ```

4. **Migrate state:**
   ```bash
   terraform init -migrate-state
   ```

## 🔒 Security Best Practices

1. **Never commit secrets:**
   - `.tfvars` files are gitignored
   - Use AWS Secrets Manager for sensitive values
2. **Use least privilege IAM:**

   - Separate roles for different services
   - Use instance profiles, not access keys

3. **Enable encryption:**

   - RDS encryption at rest
   - S3 bucket encryption
   - EBS volume encryption

4. **Network isolation:**
   - Databases in private subnets
   - NAT gateways for outbound traffic
   - Security groups with minimal access

## 💰 Cost Optimization

### Development Environment

```hcl
# terraform/environments/dev/terraform.tfvars
swarm_manager_count = 1      # vs 3 in prod
swarm_worker_count = 2       # vs 6 in prod
rds_multi_az = false         # vs true in prod
msk_broker_count = 1         # vs 3 in prod
docdb_cluster_size = 1       # vs 3 in prod
```

### Staging Environment

```hcl
# terraform/environments/staging/terraform.tfvars
swarm_manager_count = 1
swarm_worker_count = 3
rds_multi_az = false
msk_broker_count = 1
```

## 🧹 Cleanup

To destroy infrastructure:

```bash
cd terraform/environments/dev

# Plan destroy
terraform plan -destroy

# Destroy resources
terraform destroy

# Confirm when prompted
```

**⚠️ WARNING:** This will delete ALL resources. Ensure you have backups!

## 📚 Next Steps

1. **Implement module source code** - See module templates in `modules/`
2. **Test in dev** - Validate infrastructure works
3. **Deploy to staging** - Pre-production testing
4. **Production deployment** - After thorough validation

## 🆘 Getting Help

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Architecture Best Practices](https://aws.amazon.com/architecture/)
- [Terraform Module Development](https://developer.hashicorp.com/terraform/language/modules/develop)

---

**Note:** This Terraform configuration is ready for customization but requires module implementation before use.
