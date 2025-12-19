import boto3
from botocore.exceptions import ClientError
import os
import logging
import tempfile

logger = logging.getLogger(__name__)


class S3Service:
    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET_NAME", "document-reader-storage-dev")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        
        s3_kwargs = {
            'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID', 'test'),
            'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
            'region_name': self.region
        }
        
        if self.endpoint_url:
            s3_kwargs['endpoint_url'] = self.endpoint_url
        
        self.s3_client = boto3.client('s3', **s3_kwargs)
    
    def upload_file(self, content: bytes, s3_key: str, content_type: str = None) -> str:
        """Upload file to S3 and return URL"""
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
            # Return pseudo-S3 URL for internal use
            return f"s3://{self.bucket_name}/{s3_key}"
            
        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            raise

    def download_file(self, s3_url: str) -> bytes:
        """Download file from S3 URL"""
        try:
            bucket, key = self._parse_s3_url(s3_url)
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def download_to_temp_file(self, s3_url: str) -> str:
        """Download to temp file and return path"""
        try:
            content = self.download_file(s3_url)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            return temp_path
        except Exception as e:
            logger.error(f"Error creating temp file: {e}")
            raise

    def delete_file(self, s3_key: str) -> bool:
        """Delete a file from S3"""
        try:
            # Handle full URL or just key
            if s3_key.startswith("s3://"):
                _, key = self._parse_s3_url(s3_key)
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
                _, key = self._parse_s3_url(s3_key)
            else:
                key = s3_key

            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            
            # Replace internal Docker hostname with localhost for browser access
            # LocalStack uses 'localstack' as hostname inside Docker network
            # but browsers need 'localhost' to access it
            if response and 'localstack:' in response:
                response = response.replace('localstack:', 'localhost:')
            
            return response
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            return ""

    def _parse_s3_url(self, s3_url: str):
        """Helper to extract bucket and key from s3:// URL"""
        if s3_url.startswith("s3://"):
            parts = s3_url[5:].split('/', 1)
            return parts[0], parts[1]
        raise ValueError(f"Invalid S3 URL format: {s3_url}")


s3_service = S3Service()
