# ============================================================================
# Cloud5 Platform - AWS Infrastructure (Terraform)
# Complete infrastructure with storage isolation
# ============================================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "Cloud5"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================================================
# VARIABLES
# ============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ============================================================================
# VPC CONFIGURATION
# ============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "cloud5-vpc-${var.environment}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "cloud5-igw-${var.environment}"
  }
}

# Public Subnets (for ALB)
resource "aws_subnet" "public" {
  count = 2
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "cloud5-public-${count.index + 1}-${var.environment}"
    Tier = "Public"
  }
}

# Private Subnets (for ECS containers)
resource "aws_subnet" "private" {
  count = 2
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "cloud5-private-${count.index + 1}-${var.environment}"
    Tier = "Private"
  }
}

# Database Subnets (for RDS)
resource "aws_subnet" "database" {
  count = 2
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "cloud5-database-${count.index + 1}-${var.environment}"
    Tier = "Database"
  }
}

# Kafka Subnets
resource "aws_subnet" "kafka" {
  count = 2
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 30)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "cloud5-kafka-${count.index + 1}-${var.environment}"
    Tier = "Kafka"
  }
}

# NAT Gateways (one per AZ for HA)
resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"
  
  tags = {
    Name = "cloud5-nat-eip-${count.index + 1}-${var.environment}"
  }
}

resource "aws_nat_gateway" "main" {
  count = 2
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = {
    Name = "cloud5-nat-${count.index + 1}-${var.environment}"
  }
  
  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "cloud5-public-rt-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = {
    Name = "cloud5-private-rt-${count.index + 1}-${var.environment}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ============================================================================
# S3 BUCKETS - STORAGE ISOLATION (CRITICAL REQUIREMENT)
# ============================================================================

locals {
  services = [
    "document-reader",
    "quiz-service",
    "chat-service",
    "tts-service",
    "stt-service"
  ]
}

# KMS Keys (one per service for encryption)
resource "aws_kms_key" "service_keys" {
  for_each = toset(local.services)
  
  description             = "KMS key for ${each.value} S3 bucket"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = {
    Name    = "cloud5-${each.value}-kms-${var.environment}"
    Service = each.value
  }
}

resource "aws_kms_alias" "service_key_aliases" {
  for_each = toset(local.services)
  
  name          = "alias/cloud5-${each.value}-${var.environment}"
  target_key_id = aws_kms_key.service_keys[each.value].key_id
}

# S3 Buckets (one per service)
resource "aws_s3_bucket" "service_storage" {
  for_each = toset(local.services)
  
  bucket = "${each.value}-storage-${var.environment}"
  
  tags = {
    Name    = "${each.value}-storage-${var.environment}"
    Service = each.value
  }
}

# Enable versioning (except for TTS/STT - temporary files)
resource "aws_s3_bucket_versioning" "service_storage" {
  for_each = toset([
    "document-reader",
    "quiz-service",
    "chat-service"
  ])
  
  bucket = aws_s3_bucket.service_storage[each.value].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption (all buckets)
resource "aws_s3_bucket_server_side_encryption_configuration" "service_storage" {
  for_each = toset(local.services)
  
  bucket = aws_s3_bucket.service_storage[each.value].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.service_keys[each.value].arn
    }
  }
}

# Block public access (all buckets)
resource "aws_s3_bucket_public_access_block" "service_storage" {
  for_each = toset(local.services)
  
  bucket = aws_s3_bucket.service_storage[each.value].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policies (TTS/STT: delete after 7 days)
resource "aws_s3_bucket_lifecycle_configuration" "tts_stt_cleanup" {
  for_each = toset(["tts-service", "stt-service"])
  
  bucket = aws_s3_bucket.service_storage[each.value].id
  
  rule {
    id     = "delete-old-audio"
    status = "Enabled"
    
    expiration {
      days = 7
    }
  }
}

# Lifecycle policy (Document: archive to Glacier after 90 days)
resource "aws_s3_bucket_lifecycle_configuration" "document_archive" {
  bucket = aws_s3_bucket.service_storage["document-reader"].id
  
  rule {
    id     = "archive-old-documents"
    status = "Enabled"
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# Bucket Policies - ENFORCE STORAGE ISOLATION
resource "aws_s3_bucket_policy" "service_storage" {
  for_each = toset(local.services)
  
  bucket = aws_s3_bucket.service_storage[each.value].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowServiceRoleOnly"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.service_roles[each.value].arn
        }
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
      },
      {
        Sid    = "DenyAllOthers"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.service_storage[each.value].arn,
          "${aws_s3_bucket.service_storage[each.value].arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = aws_iam_role.service_roles[each.value].arn
          }
        }
      }
    ]
  })
}

# ============================================================================
# IAM ROLES AND POLICIES
# ============================================================================

# ECS Task Execution Role (for pulling images, writing logs)
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "cloud5-ecs-task-execution-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Service-specific IAM Roles for IRSA (IAM Roles for Service Accounts)
resource "aws_iam_role" "service_roles" {
  for_each = toset(local.services)
  
  name = "cloud5-${each.value}-role-${var.environment}"
  
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
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:cloud5:${each.value}"
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  
  tags = {
    Service = each.value
  }
  
  depends_on = [aws_iam_openid_connect_provider.eks]
}

# S3 Access Policies (service can ONLY access its own bucket)
resource "aws_iam_role_policy" "s3_access" {
  for_each = toset(local.services)
  
  name = "S3Access"
  role = aws_iam_role.service_roles[each.value].id
  
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
      },
      {
        Effect = "Deny"
        Action = "s3:*"
        NotResource = [
          aws_s3_bucket.service_storage[each.value].arn,
          "${aws_s3_bucket.service_storage[each.value].arn}/*"
        ]
      }
    ]
  })
}

# KMS Decrypt Policies
resource "aws_iam_role_policy" "kms_decrypt" {
  for_each = toset(local.services)
  
  name = "KMSDecrypt"
  role = aws_iam_role.service_roles[each.value].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = aws_kms_key.service_keys[each.value].arn
    }]
  })
}

# CloudWatch Logs Policies
resource "aws_iam_role_policy" "cloudwatch_logs" {
  for_each = toset(local.services)
  
  name = "CloudWatchLogs"
  role = aws_iam_role.service_roles[each.value].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}

# ============================================================================
# RDS DATABASES - SEPARATE INSTANCE PER SERVICE
# ============================================================================

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "cloud5-db-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.database[*].id
  
  tags = {
    Name = "cloud5-db-subnet-group-${var.environment}"
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "cloud5-rds-sg-${var.environment}"
  description = "Security group for RDS databases"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "PostgreSQL from EKS Pods"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_pods.id]  # FIX: Changed from ecs_tasks to eks_pods
  }
  
  tags = {
    Name = "cloud5-rds-sg-${var.environment}"
  }
}

# RDS Instances (one per service requiring SQL database)
locals {
  rds_services = {
    "user" = {
      db_name  = "user_management"
      username = "platformadmin"
    }
    "document" = {
      db_name  = "document_reader_db"
      username = "postgres"
    }
    "quiz" = {
      db_name  = "quiz_db"
      username = "postgres"
    }
    "chat" = {
      db_name  = "chat_db"
      username = "postgres"
    }
  }
}

resource "aws_db_instance" "services" {
  for_each = local.rds_services
  
  identifier = "cloud5-${each.key}-db-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = each.value.db_name
  username = each.value.username
  password = random_password.db_passwords[each.key].result
  
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "cloud5-${each.key}-db-final-${var.environment}"
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  tags = {
    Name    = "cloud5-${each.key}-db-${var.environment}"
    Service = each.key
  }
}

# Random passwords for databases
resource "random_password" "db_passwords" {
  for_each = local.rds_services
  
  length  = 32
  special = true
}

# Store passwords in Secrets Manager
resource "aws_secretsmanager_secret" "db_passwords" {
  for_each = local.rds_services
  
  name = "cloud5/${var.environment}/db/${each.key}/password"
  
  tags = {
    Service = each.key
  }
}

resource "aws_secretsmanager_secret_version" "db_passwords" {
  for_each = local.rds_services
  
  secret_id     = aws_secretsmanager_secret.db_passwords[each.key].id
  secret_string = random_password.db_passwords[each.key].result
}

# ============================================================================
# EKS CLUSTER (Kubernetes)
# ============================================================================

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster" {
  name = "cloud5-eks-cluster-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "cloud5-cluster-${var.environment}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]

  tags = {
    Name = "cloud5-cluster-${var.environment}"
  }
}

# Security Group for EKS Cluster
resource "aws_security_group" "eks_cluster" {
  name        = "cloud5-eks-cluster-sg-${var.environment}"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloud5-eks-cluster-sg-${var.environment}"
  }
}

# EKS Node Group IAM Role
resource "aws_iam_role" "eks_nodes" {
  name = "cloud5-eks-node-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "cloud5-node-group-${var.environment}"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }

  instance_types = ["t3.medium"]
  capacity_type  = "ON_DEMAND"

  labels = {
    Environment = var.environment
    Managed     = "terraform"
  }

  tags = {
    Name = "cloud5-node-group-${var.environment}"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]
}

# OIDC Provider for IRSA (IAM Roles for Service Accounts)
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = {
    Name = "cloud5-eks-oidc-${var.environment}"
  }
}

# EBS CSI Driver IAM Role
resource "aws_iam_role" "ebs_csi_driver" {
  name = "cloud5-ebs-csi-driver-role-${var.environment}"

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
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ebs_csi_driver" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = aws_iam_role.ebs_csi_driver.name
}

# EKS Add-on: EBS CSI Driver
resource "aws_eks_addon" "ebs_csi_driver" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = aws_iam_role.ebs_csi_driver.arn

  depends_on = [aws_eks_node_group.main]
}

# Security Group for Pods
resource "aws_security_group" "eks_pods" {
  name        = "cloud5-eks-pods-sg-${var.environment}"
  description = "Security group for EKS pods"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloud5-eks-pods-sg-${var.environment}"
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "s3_buckets" {
  description = "S3 bucket names by service"
  value = {
    for service in local.services :
    service => aws_s3_bucket.service_storage[service].id
  }
}

output "rds_endpoints" {
  description = "RDS database endpoints"
  value = {
    for service, instance in aws_db_instance.services :
    service => instance.endpoint
  }
  sensitive = true
}

output "iam_role_arns" {
  description = "IAM role ARNs by service (for IRSA)"
  value = {
    for service in local.services :
    service => aws_iam_role.service_roles[service].arn
  }
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.main.endpoint
  sensitive   = true
}

output "eks_cluster_certificate_authority" {
  description = "EKS cluster certificate authority data"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN (for IRSA)"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "eks_oidc_provider_url" {
  description = "EKS OIDC provider URL"
  value       = aws_iam_openid_connect_provider.eks.url
}

output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}
