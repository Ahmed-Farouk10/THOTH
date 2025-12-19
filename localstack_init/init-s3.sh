#!/bin/bash
# LocalStack S3 Bucket Initialization Script
# This creates the necessary S3 buckets when LocalStack starts

echo "Initializing S3 buckets for Thoth Platform..."

# Create the main documents bucket (shared by all services)
awslocal s3 mb s3://documents 2>/dev/null || echo "Bucket 'documents' already exists"

# List buckets to confirm
echo "Available S3 buckets:"
awslocal s3 ls

echo "S3 initialization complete!"
