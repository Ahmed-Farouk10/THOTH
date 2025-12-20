# ============================================================================
# HELM CHART DEPLOYMENT
# ============================================================================

# Get LabRole for IRSA annotations
data "aws_iam_role" "lab_role_helm" {
  name = "LabRole"
}

# Deploy the Cloud5 Platform Umbrella Chart
resource "helm_release" "cloud5_platform" {
  name             = "cloud5"
  chart            = "../helm/cloud5-platform"
  namespace        = "cloud5-prod"
  create_namespace = true
  timeout          = 600
  wait             = true

  # Wait for infrastructure to be ready
  depends_on = [
    aws_eks_cluster.main,
    aws_eks_node_group.main,
    aws_db_instance.main,
    aws_s3_bucket.service_storage
  ]

  # Disable Helm-managed PostgreSQL (use RDS instead)
  set {
    name  = "postgresql.enabled"
    value = "false"
  }

  # Database connection (RDS)
  set {
    name  = "global.database.host"
    value = aws_db_instance.main.address
  }
  
  set {
    name  = "global.database.password"
    value = random_password.db_password.result
  }

  # S3 Bucket Names for each service
  set {
    name  = "document-reader.env[0].name"
    value = "S3_BUCKET_NAME"
  }
  set {
    name  = "document-reader.env[0].value"
    value = aws_s3_bucket.service_storage["document-reader"].id
  }
  
  set {
    name  = "quiz-service.env[0].name"
    value = "S3_BUCKET_NAME"
  }
  set {
    name  = "quiz-service.env[0].value"
    value = aws_s3_bucket.service_storage["quiz-service"].id
  }
  
  set {
    name  = "chat-service.env[0].name"
    value = "S3_BUCKET_NAME"
  }
  set {
    name  = "chat-service.env[0].value"
    value = aws_s3_bucket.service_storage["chat-service"].id
  }
  
  set {
    name  = "tts-service.env[0].name"
    value = "S3_BUCKET_NAME"
  }
  set {
    name  = "tts-service.env[0].value"
    value = aws_s3_bucket.service_storage["tts-service"].id
  }
  
  set {
    name  = "stt-service.env[0].name"
    value = "S3_BUCKET_NAME"
  }
  set {
    name  = "stt-service.env[0].value"
    value = aws_s3_bucket.service_storage["stt-service"].id
  }

  # IRSA (IAM Roles for Service Accounts) Annotations - Using LabRole for AWS Academy
  set {
    name  = "document-reader.serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn"
    value = data.aws_iam_role.lab_role_helm.arn
  }
  
  set {
    name  = "quiz-service.serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn"
    value = data.aws_iam_role.lab_role_helm.arn
  }
  
  set {
    name  = "chat-service.serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn"
    value = data.aws_iam_role.lab_role_helm.arn
  }
  
  set {
    name  = "tts-service.serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn"
    value = data.aws_iam_role.lab_role_helm.arn
  }
  
  set {
    name  = "stt-service.serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn"
    value = data.aws_iam_role.lab_role_helm.arn
  }
}
