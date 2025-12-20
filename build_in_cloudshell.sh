#!/bin/bash
# CloudShell Build & Push Script
# Upload this file and cloud-source.tar.gz to AWS CloudShell

set -e

AWS_ACCOUNT_ID="945489595584"
AWS_REGION="us-east-1"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "=== Setup: Extracting Source Code ==="
mkdir -p cloud-build
tar -xzf cloud-source.tar.gz -C cloud-build
cd cloud-build

echo "=== Step 1: Login to ECR ==="
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

echo "=== Step 2: Build and Push Services ==="

# Function to build and push a service
build_and_push() {
  service_name=$1
  context_dir=$2
  
  echo "------------------------------------------------"
  echo "Processing $service_name..."
  echo "------------------------------------------------"
  
  # Build
  docker build -t $service_name -f "${context_dir}/Dockerfile" .
  
  # Tag
  docker tag "${service_name}:latest" "${ECR_REGISTRY}/${service_name}:latest"
  
  # Push
  docker push "${ECR_REGISTRY}/${service_name}:latest"
  echo "✅ $service_name done!"
}

# List of services to build
build_and_push "document-reader" "documentreader"
build_and_push "quiz-service" "platform/quiz-service"
build_and_push "chat-service" "platform/chat-service"
build_and_push "tts-service" "tts-service"
build_and_push "stt-service" "stt-service"
build_and_push "user-service" "user-service"
build_and_push "aggregator" "aggregator"
build_and_push "notification-service" "notification-service"

echo "=================================="
echo "🎉 All services built and pushed successfully!"
echo "=================================="
