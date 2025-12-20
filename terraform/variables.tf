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

variable "deploy_helm" {
  description = "Whether to deploy Helm chart automatically via Terraform (set to false for manual deployment)"
  type        = bool
  default     = false  # Default to manual deployment to avoid token expiry issues
}
