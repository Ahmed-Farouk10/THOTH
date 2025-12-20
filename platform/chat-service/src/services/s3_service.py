import logging
import os
import tempfile

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Service:
    """
    S3 Service with IAM Role (IRSA) authentication for production.
    
    Chat service MUST use its own bucket (chat-service-storage-prod) if needed.
    In production, uses IAM roles (no credentials).
    In development, uses LocalStack with test credentials.
    """
    def __init__(self):
        # CRITICAL: Bucket name MUST be service-specific (chat-service bucket if S3 is used)
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        if not self.bucket_name:
            raise ValueError(
                "S3_BUCKET_NAME environment variable is required. "
                "Chat service must use 'chat-service-storage-prod' bucket if S3 storage is needed"
            )
        
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        
        if self.environment == "production":
            # Production: Use IAM role (IRSA), NO credentials
            self.s3_client = boto3.client("s3", region_name=self.region)
            logger.info(
                f"Chat S3 client initialized for PRODUCTION (IRSA) - "
                f"Bucket: {self.bucket_name}, Region: {self.region}"
            )
        else:
            # Development: LocalStack
            self.endpoint_url = os.getenv("S3_ENDPOINT_URL", "http://localstack:4566")
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
                region_name=self.region,
            )
            logger.info(
                f"Chat S3 client initialized for DEVELOPMENT (LocalStack) - "
                f"Bucket: {self.bucket_name}, Endpoint: {self.endpoint_url}"
            )

    def upload_file(self, content: bytes, s3_key: str, content_type: str | None = None) -> str:
        """Upload file bytes to THIS service's bucket only (chat-service bucket)"""
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        try:
            self.s3_client.put_object(Bucket=self.bucket_name, Key=s3_key, Body=content, **extra_args)
            s3_url = f"s3://{self.bucket_name}/{s3_key}"
            logger.info(f"Uploaded file to {s3_url}")
            return s3_url
        except ClientError as e:
            logger.error(f"Error uploading to S3 bucket '{self.bucket_name}': {e}")
            raise

    def download_file(self, s3_url: str) -> bytes:
        """Download file bytes from S3 URL (must be from THIS service's bucket)"""
        bucket, key = self._parse_s3_url(s3_url)
        
        # Security check: Ensure we're only accessing our own bucket
        if bucket != self.bucket_name:
            error_msg = (
                f"SECURITY VIOLATION: Chat service attempted to access bucket '{bucket}' "
                f"but is only authorized for '{self.bucket_name}'"
            )
            logger.error(error_msg)
            raise PermissionError(error_msg)
        
        try:
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def download_to_temp_file(self, s3_url: str) -> str:
        """Download to a temp file and return path."""
        content = self.download_file(s3_url)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
            tmp.write(content)
            temp_path = tmp.name
        logger.info(f"Downloaded to temp file: {temp_path}")
        return temp_path

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate presigned GET URL."""
        if s3_key.startswith("s3://"):
            bucket, key = self._parse_s3_url(s3_key)
            # Security check
            if bucket != self.bucket_name:
                raise PermissionError(
                    f"Cannot generate URL for bucket '{bucket}' - only authorized for '{self.bucket_name}'"
                )
        else:
            key = s3_key
            
        try:
            url = self.s3_client.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket_name, "Key": key}, ExpiresIn=expiration
            )
            # Replace internal Docker hostname with localhost (development only)
            if self.environment != "production" and url and "localstack:" in url:
                url = url.replace("localstack:", "localhost:")
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return ""

    def _parse_s3_url(self, s3_url: str):
        """Helper to extract bucket and key from s3:// URL"""
        if s3_url.startswith("s3://"):
            parts = s3_url[5:].split("/", 1)
            if len(parts) == 2:
                return parts[0], parts[1]
        raise ValueError(f"Invalid S3 URL format: {s3_url}")


# Global instance - will raise ValueError if S3_BUCKET_NAME not set
s3_service = S3Service()
