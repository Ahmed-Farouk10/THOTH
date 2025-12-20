# ============================================================================
# OUTPUTS
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
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

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN (for IRSA)"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "s3_buckets" {
  description = "S3 bucket names by service"
  value = {
    for service in local.services :
    service => aws_s3_bucket.service_storage[service].id
  }
}

output "rds_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "iam_role_arns" {
  description = "IAM role ARNs by service (for IRSA)"
  value = {
    for service in local.services :
    service => aws_iam_role.service_roles[service].arn
  }
}

output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}

output "ecr_repositories" {
  description = "ECR repository URLs for Docker push"
  value = {
    for k, v in aws_ecr_repository.services : k => v.repository_url
  }
}
