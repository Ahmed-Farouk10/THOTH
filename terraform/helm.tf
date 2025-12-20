# ============================================================================
# HELM CHART DEPLOYMENT
# ============================================================================

# Get LabRole for IRSA annotations
data "aws_iam_role" "lab_role_helm" {
  name = "LabRole"
}

# Deploy the Cloud5 Platform Umbrella Chart (Optional - set var.deploy_helm = true to enable)
# Recommended: Deploy manually using deploy.ps1 script to avoid token expiry issues
resource "helm_release" "cloud5_platform" {
  count = var.deploy_helm ? 1 : 0  # Conditional deployment
  
  name             = "cloud5"
  chart            = "../helm/cloud5-platform"
  namespace        = "cloud5-prod"
  create_namespace = true
  timeout          = 600  # 10 minutes
  cleanup_on_fail  = true

  # Wait for infrastructure to be ready
  depends_on = [
    aws_eks_cluster.main,
    aws_eks_node_group.main,
    aws_db_instance.main,
    aws_s3_bucket.service_storage
  ]

  values = [
    yamlencode({
      postgresql = {
        enabled = false
      }
      global = {
        database = {
          host     = aws_db_instance.main.address
          password = random_password.db_password.result
        }
      }
      "document-reader" = {
        env = [
          { name = "S3_BUCKET_NAME", value = aws_s3_bucket.service_storage["document-reader"].id }
        ]
        serviceAccount = {
          annotations = {
            "eks.amazonaws.com/role-arn" = data.aws_iam_role.lab_role_helm.arn
          }
        }
      }
      "quiz-service" = {
        env = [
          { name = "S3_BUCKET_NAME", value = aws_s3_bucket.service_storage["quiz-service"].id }
        ]
        serviceAccount = {
          annotations = {
            "eks.amazonaws.com/role-arn" = data.aws_iam_role.lab_role_helm.arn
          }
        }
      }
      "chat-service" = {
        env = [
          { name = "S3_BUCKET_NAME", value = aws_s3_bucket.service_storage["chat-service"].id }
        ]
        serviceAccount = {
          annotations = {
            "eks.amazonaws.com/role-arn" = data.aws_iam_role.lab_role_helm.arn
          }
        }
      }
      "tts-service" = {
        env = [
          { name = "S3_BUCKET_NAME", value = aws_s3_bucket.service_storage["tts-service"].id }
        ]
        serviceAccount = {
          annotations = {
            "eks.amazonaws.com/role-arn" = data.aws_iam_role.lab_role_helm.arn
          }
        }
      }
      "stt-service" = {
        env = [
          { name = "S3_BUCKET_NAME", value = aws_s3_bucket.service_storage["stt-service"].id }
        ]
        serviceAccount = {
          annotations = {
            "eks.amazonaws.com/role-arn" = data.aws_iam_role.lab_role_helm.arn
          }
        }
      }
    })
  ]

}
