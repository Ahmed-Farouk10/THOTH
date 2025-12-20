import boto3
from botocore.exceptions import ClientError
import os
import logging
import tempfile

logger = logging.getLogger(__name__)


class S3Service:
    """
    S3 Service with IAM Role (IRSA) authentication for production.
    
    Each service MUST set S3_BUCKET_NAME to its own bucket.
    In production, uses IAM roles (no credentials).
    In development, uses LocalStack with test credentials.
    """
    def __init__(self):
        # CRITICAL: Bucket name MUST be service-specific
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        if not self.bucket_name:
            raise ValueError(
                "S3_BUCKET_NAME environment variable is required. "
                "Each service must use its own bucket (e.g., 'document-reader-storage-prod')"
            )
        
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        
        if self.environment == "production":
            # Production: Use IAM role (IRSA), NO credentials
            # Kubernetes ServiceAccount with eks.amazonaws.com/role-arn annotation
            # provides temporary credentials automatically
            self.s3_client = boto3.client('s3', region_name=self.region)
            logger.info(
                f"S3 client initialized for PRODUCTION (IRSA) - "
                f"Bucket: {self.bucket_name}, Region: {self.region}"
            )
        else:
            # Development: LocalStack
            self.endpoint_url = os.getenv("S3_ENDPOINT_URL", "http://localstack:4566")
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'test'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
                region_name=self.region
            )
            logger.info(
                f"S3 client initialized for DEVELOPMENT (LocalStack) - "
                f"Bucket: {self.bucket_name}, Endpoint: {self.endpoint_url}"
            )
    
    def upload_file(self, content: bytes, s3_key: str, content_type: str = None) -> str:
        """Upload file to THIS service's bucket only"""
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=content,
                **extra_args
            )
            
            s3_url = f"s3://{self.bucket_name}/{s3_key}"
            logger.info(f"Uploaded file to {s3_url}")
            return s3_url
            
        except ClientError as e:
            logger.error(f"Error uploading to S3 bucket '{self.bucket_name}': {e}")
            raise

    def download_file(self, s3_url: str) -> bytes:
        """Download file from S3 URL (must be from THIS service's bucket)"""
        try:
            bucket, key = self._parse_s3_url(s3_url)
            
            # Security check: Ensure we're only accessing our own bucket
            if bucket != self.bucket_name:
                error_msg = (
                    f"SECURITY VIOLATION: Attempted to access bucket '{bucket}' "
                    f"but this service is only authorized for '{self.bucket_name}'"
                )
                logger.error(error_msg)
                raise PermissionError(error_msg)
            
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
            
        except ClientError as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def download_to_temp_file(self, s3_url: str) -> str:
        """Download to temp file and return path"""
        try:
            content = self.download_file(s3_url)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            logger.info(f"Downloaded to temp file: {temp_path}")
            return temp_path
        except Exception as e:
            logger.error(f"Error creating temp file: {e}")
            raise

    def delete_file(self, s3_key: str) -> bool:
        """Delete a file from S3"""
        try:
            # Handle full URL or just key
            if s3_key.startswith("s3://"):
                bucket, key = self._parse_s3_url(s3_key)
                # Security check
                if bucket != self.bucket_name:
                    raise PermissionError(
                        f"Cannot delete from bucket '{bucket}' - only authorized for '{self.bucket_name}'"
                    )
            else:
                key = s3_key
                
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Deleted S3 object: {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting S3 file {s3_key}: {e}")
            raise

    def generate_presigned_url(self, s3_key: str, expiration=3600) -> str:
        """Generate a presigned URL for GET access"""
        try:
            # Handle full URL or just key
            if s3_key.startswith("s3://"):
                bucket, key = self._parse_s3_url(s3_key)
                # Security check
                if bucket != self.bucket_name:
                    raise PermissionError(
                        f"Cannot generate URL for bucket '{bucket}' - only authorized for '{self.bucket_name}'"
                    )
            else:
                key = s3_key

            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            
            # Replace internal Docker hostname with localhost for browser access (development only)
            if self.environment != "production" and response and 'localstack:' in response:
                response = response.replace('localstack:', 'localhost:')
            
            return response
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            return ""

    def _parse_s3_url(self, s3_url: str):
        """Helper to extract bucket and key from s3:// URL"""
        if s3_url.startswith("s3://"):
            parts = s3_url[5:].split('/', 1)
            if len(parts) == 2:
                return parts[0], parts[1]
        raise ValueError(f"Invalid S3 URL format: {s3_url}")


# Global instance - will raise ValueError if S3_BUCKET_NAME not set
s3_service = S3Service()
