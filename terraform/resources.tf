locals {
  services = ["document-reader", "quiz-service", "chat-service", "tts-service", "stt-service", "shared-assets"]
}

data "aws_caller_identity" "current" {}

# --- S3 BUCKETS ---
resource "aws_s3_bucket" "service_storage" {
  for_each = toset(local.services)
  bucket   = "cloud5-${each.value}-storage-${var.environment}-${data.aws_caller_identity.current.account_id}"
  
  tags = {
    Name    = "${each.value}-storage"
    Service = each.value
  }
}

resource "aws_s3_bucket_public_access_block" "service_storage" {
  for_each = toset(local.services)
  bucket   = aws_s3_bucket.service_storage[each.value].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- IAM: SKIP CREATION, USE LAB ROLE ---
# In Lab environment, we cannot create new roles. 
# We rely on the NodeGroup's LabRole for permissions.

# --- RDS DATABASE ---
resource "aws_db_subnet_group" "main" {
  name       = "cloud5-db-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.database[*].id
  
  tags = { Name = "cloud5-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "cloud5-rds-sg-${var.environment}"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "PostgreSQL from EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_pods.id] 
  }
  
  tags = { Name = "cloud5-rds-sg" }
}

resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_secret" {
  name = "cloud5-db-password-${var.environment}"
  
  tags = { Name = "cloud5-db-password" }
}

resource "aws_secretsmanager_secret_version" "db_secret_val" {
  secret_id     = aws_secretsmanager_secret.db_secret.id
  secret_string = jsonencode({
    username = "postgres"
    password = random_password.db_password.result
  })
}

resource "aws_db_instance" "main" {
  identifier           = "cloud5-postgres-${var.environment}"
  engine               = "postgres"
  engine_version       = "15" # FIXED: Changed from 15.4 to 15 for AWS Academy
  instance_class       = "db.t3.medium"
  allocated_storage    = 20
  db_name              = "cloud5_db"
  username             = "postgres"
  password             = random_password.db_password.result
  skip_final_snapshot  = true
  publicly_accessible  = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  tags = { Name = "cloud5-postgres-${var.environment}" }
}

# --- ECR REPOSITORIES ---
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
  
  name         = each.value
  force_delete = true
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name    = each.value
    Service = each.value
  }
}
