# ==============================================================================
# Terraform Main Configuration for THOTH Production
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # TODO: Uncomment after first apply to enable remote state
  # backend "s3" {
  #   bucket         = "thoth-terraform-state-prod"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "thoth-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "THOTH"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ==============================================================================
# VPC Module
# ==============================================================================

module "vpc" {
  source = "../../modules/vpc"
  
  environment        = var.environment
  vpc_cidr          = var.vpc_cidr
  availability_zones = var.availability_zones
  project_name      = "thoth"
}

# ==============================================================================
# Security Groups Module
# ==============================================================================

module "security_groups" {
  source = "../../modules/security-groups"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  vpc_cidr    = var.vpc_cidr
}

# ==============================================================================
# EC2 Swarm Cluster Module
# ==============================================================================

module "swarm_cluster" {
  source = "../../modules/swarm-cluster"
  
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  private_subnet_ids    = module.vpc.private_subnet_ids
  
  manager_count         = var.swarm_manager_count
  worker_count          = var.swarm_worker_count
  manager_instance_type = var.manager_instance_type
  worker_instance_type  = var.worker_instance_type
  
  ssh_public_key        = var.ssh_public_key
  
  swarm_security_group_id = module.security_groups.swarm_security_group_id
}

# ==============================================================================
# RDS Databases Module
# ==============================================================================

module "rds" {
  source = "../../modules/rds"
  
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_allocated_storage
  multi_az                = var.rds_multi_az
  
  rds_security_group_id   = module.security_groups.rds_security_group_id
}

# ==============================================================================
# DocumentDB Module
# ==============================================================================

module "documentdb" {
  source = "../../modules/documentdb"
  
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  
  instance_class         = var.docdb_instance_class
  cluster_size           = var.docdb_cluster_size
  
  docdb_security_group_id = module.security_groups.docdb_security_group_id
}

# ==============================================================================
# MSK Kafka Module
# ==============================================================================

module "msk" {
  source = "../../modules/msk"
  
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  
  instance_type         = var.msk_instance_type
  broker_count          = var.msk_broker_count
  
  msk_security_group_id = module.security_groups.msk_security_group_id
}

# ==============================================================================
# S3 Module
# ==============================================================================

module "s3" {
  source = "../../modules/s3"
  
  environment = var.environment
  bucket_name = var.s3_documents_bucket
}

# ==============================================================================
# ECR Repositories Module
# ==============================================================================

module "ecr" {
  source = "../../modules/ecr"
  
  environment = var.environment
  
  services = [
    "aggregator",
    "user-service",
    "document-service",
    "notification-service",
    "chat-service",
    "quiz-service",
    "tts-service",
    "stt-service",
    "frontend"
  ]
}

# ==============================================================================
# Application Load Balancer Module
# ==============================================================================

module "alb" {
  source = "../../modules/alb"
  
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnet_ids
  
  alb_security_group_id = module.security_groups.alb_security_group_id
  
  # TODO: Uncomment when you have a domain and certificate
  # certificate_arn      = var.acm_certificate_arn
  # domain_name          = var.domain_name
}

# ==============================================================================
# IAM Roles Module
# ==============================================================================

module "iam" {
  source = "../../modules/iam"
  
  environment    = var.environment
  ecr_arns       = module.ecr.repository_arns
  s3_bucket_arn  = module.s3.bucket_arn
  
  # GitHub OIDC for GitHub Actions
  github_repo    = var.github_repo
}

# ==============================================================================
# Outputs
# ==============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "swarm_manager_ips" {
  description = "Swarm manager private IPs"
  value       = module.swarm_cluster.manager_private_ips
}

output "swarm_worker_ips" {
  description = "Swarm worker private IPs"
  value       = module.swarm_cluster.worker_private_ips
}

output "rds_endpoints" {
  description = "RDS database endpoints"
  value       = module.rds.db_endpoints
  sensitive   = true
}

output "documentdb_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = module.documentdb.cluster_endpoint
  sensitive   = true
}

output "msk_bootstrap_servers" {
  description = "MSK Kafka bootstrap servers"
  value       = module.msk.bootstrap_servers
}

output "s3_bucket_name" {
  description = "S3 documents bucket name"
  value       = module.s3.bucket_name
}

output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.dns_name
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions"
  value       = module.iam.github_actions_role_arn
}

output "ec2_instance_role_arn" {
  description = "IAM role ARN for EC2 instances"
  value       = module.iam.ec2_instance_role_arn
}
