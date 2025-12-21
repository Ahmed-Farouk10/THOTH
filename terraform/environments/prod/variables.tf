# ==============================================================================
# Terraform Variables for THOTH Production
# ==============================================================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ==============================================================================
# EC2 Swarm Cluster
# ==============================================================================

variable "swarm_manager_count" {
  description = "Number of Swarm manager nodes"
  type        = number
  default     = 3
}

variable "swarm_worker_count" {
  description = "Number of Swarm worker nodes"
  type        = number
  default     = 6
}

variable "manager_instance_type" {
  description = "Instance type for Swarm managers"
  type        = string
  default     = "t3.medium"
}

variable "worker_instance_type" {
  description = "Instance type for Swarm workers"
  type        = string
  default     = "t3.large"
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access"
  type        = string
  # TODO: Replace with your public key content
  default     = "ssh-rsa YOUR_PUBLIC_KEY_HERE"
}

# ==============================================================================
# RDS Databases
# ==============================================================================

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "rds_multi_az" {
  description = "Enable multi-AZ for RDS"
  type        = bool
  default     = true
}

# ==============================================================================
# DocumentDB
# ==============================================================================

variable "docdb_instance_class" {
  description = "DocumentDB instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "docdb_cluster_size" {
  description = "Number of DocumentDB instances"
  type        = number
  default     = 3
}

# ==============================================================================
# MSK Kafka
# ==============================================================================

variable "msk_instance_type" {
  description = "MSK broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "msk_broker_count" {
  description = "Number of MSK brokers"
  type        = number
  default     = 3
}

# ==============================================================================
# S3
# ==============================================================================

variable "s3_documents_bucket" {
  description = "S3 bucket name for documents"
  type        = string
  default     = "thoth-documents-prod"
}

# ==============================================================================
# Domain & SSL
# ==============================================================================

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (optional)"
  type        = string
  default     = ""
}

# ==============================================================================
# GitHub Integration
# ==============================================================================

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  # TODO: Replace with your repository
  default     = "YOUR_GITHUB_USERNAME/THOTH"
}
