# ============================================================================
# S3 BUCKETS - STORAGE ISOLATION
# ============================================================================

locals {
  services = ["document-reader", "quiz-service", "chat-service", "tts-service", "stt-service", "shared-assets"]
}

# Get AWS account ID
data "aws_caller_identity" "current" {}

# S3 Buckets (one per service)
resource "aws_s3_bucket" "service_storage" {
  for_each = toset(local.services)
  bucket   = "cloud5-${each.value}-storage-${var.environment}-${data.aws_caller_identity.current.account_id}"
  
  tags = {
    Name    = "${each.value}-storage"
    Service = each.value
  }
}

# Block public access (all buckets)
resource "aws_s3_bucket_public_access_block" "service_storage" {
  for_each = toset(local.services)
  bucket   = aws_s3_bucket.service_storage[each.value].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================================================
# IAM ROLES FOR SERVICE ACCOUNTS (IRSA)
# ============================================================================

resource "aws_iam_role" "service_roles" {
  for_each = toset(local.services)
  name     = "cloud5-${each.value}-role"
  
  # IRSA: Trust policy for Kubernetes ServiceAccount
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:cloud5-prod:${each.value}-sa"
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  
  tags = { Service = each.value }
}

# S3 Access Policies (service can ONLY access its own bucket)
resource "aws_iam_role_policy" "s3_access" {
  for_each = toset(local.services)
  name     = "S3Access"
  role     = aws_iam_role.service_roles[each.value].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.service_storage[each.value].arn,
          "${aws_s3_bucket.service_storage[each.value].arn}/*"
        ]
      }
    ]
  })
}

# ============================================================================
# RDS DATABASE
# ============================================================================

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "cloud5-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id
  tags       = { Name = "cloud5-db-subnet-group" }
}

# Security Group for RDS (FIX: References eks_pods, not ecs_tasks)
resource "aws_security_group" "rds" {
  name        = "cloud5-rds-sg"
  description = "Security group for RDS database"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "PostgreSQL from EKS Pods"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_pods.id] # ✅ BUG FIX HERE
  }
  
  tags = { Name = "cloud5-rds-sg" }
}

# RDS Instance (Single PostgreSQL with multiple databases)
resource "aws_db_instance" "main" {
  identifier     = "cloud5-postgres-${var.environment}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"
  
  allocated_storage = 100
  storage_type      = "gp3"
  storage_encrypted = true
  
  db_name  = "postgres"
  username = "postgres"
  password = random_password.db_password.result
  
  multi_az               = false # Set true for production HA
  skip_final_snapshot    = true   # Set false for production
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  
  tags = { Name = "cloud5-postgres-${var.environment}" }
}

# Random password for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "cloud5/${var.environment}/db/password"
  tags = { Name = "cloud5-db-password" }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ============================================================================
# ECR REPOSITORIES (Where we push our Docker Images)
# ============================================================================

resource "aws_ecr_repository" "services" {
  for_each = toset([
    "document-reader",
    "quiz-service",
    "chat-service",
    "tts-service",
    "stt-service",
    "user-service",
    "aggregator",
    "notification-service"
  ])

  name                 = each.value
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name    = each.value
    Service = each.value
  }
}
