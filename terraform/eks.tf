# ============================================================================
# EKS CLUSTER (Using LabRole)
# ============================================================================

# 1. Get the Existing LabRole
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

# 2. EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "cloud5-cluster-${var.environment}"
  role_arn = data.aws_iam_role.lab_role.arn  # CHANGED: Use LabRole
  version  = "1.29"  # Incremental upgrade from 1.28

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  tags = { Name = "cloud5-cluster-${var.environment}" }
}

resource "aws_security_group" "eks_cluster" {
  name        = "cloud5-eks-cluster-sg-${var.environment}"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 3. EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "cloud5-node-group-${var.environment}"
  node_role_arn   = data.aws_iam_role.lab_role.arn # CHANGED: Use LabRole
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }

  instance_types = ["t3.medium"]
  disk_size      = 50

  tags = { Name = "cloud5-node-group-${var.environment}" }
}

# 4. Security Group for Pods
resource "aws_security_group" "eks_pods" {
  name        = "cloud5-eks-pods-sg-${var.environment}"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# NOTE: AWS Academy Student Lab does not allow creating OIDC providers or EBS CSI driver
# IRSA functionality is limited - services will use node IAM role (LabRole) permissions
