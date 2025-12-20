#!/bin/bash
# CloudShell Script: Load and Push Images to ECR
# Run this in AWS CloudShell after uploading all-images.tar

set -e

AWS_ACCOUNT_ID="945489595584"
AWS_REGION="us-east-1"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "=== Loading Docker Images from Tar ==="
docker load -i all-images.tar

echo ""
echo "=== Tagging and Pushing to ECR ==="

services=(
  "document-reader"
  "quiz-service"
  "chat-service"
  "tts-service"
  "stt-service"
  "user-service"
  "aggregator"
  "notification-service"
)

counter=1
total=${#services[@]}

for service in "${services[@]}"; do
  echo "[$counter/$total] Processing $service..."
  
  # Tag for ECR
  docker tag "${service}:latest" "${ECR_REGISTRY}/${service}:latest"
  
  # Push to ECR
  echo "  Pushing to ECR..."
  docker push "${ECR_REGISTRY}/${service}:latest"
  
  echo "✅ $service pushed successfully"
  echo ""
  
  counter=$((counter + 1))
done

echo "=================================="
echo "✅ All images pushed to ECR!"
echo "=================================="
