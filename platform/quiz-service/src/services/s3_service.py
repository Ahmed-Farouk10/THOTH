import logging
import os
import tempfile

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Service:
    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET_NAME", "document-reader-storage-dev")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.region = os.getenv("AWS_REGION", "us-east-1")

        client_kwargs = {
            "aws_access_key_id": os.getenv("AWS_ACCESS_KEY_ID", "test"),
            "aws_secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
            "region_name": self.region,
        }
        if self.endpoint_url:
            client_kwargs["endpoint_url"] = self.endpoint_url

        self.s3_client = boto3.client("s3", **client_kwargs)

    def upload_file(self, content: bytes, s3_key: str, content_type: str | None = None) -> str:
        """Upload file bytes to S3 and return s3:// URL."""
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        try:
            self.s3_client.put_object(Bucket=self.bucket_name, Key=s3_key, Body=content, **extra_args)
            return f"s3://{self.bucket_name}/{s3_key}"
        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            raise

    def download_file(self, s3_url: str) -> bytes:
        """Download file bytes from S3 URL."""
        bucket, key = self._parse_s3_url(s3_url)
        try:
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def download_to_temp_file(self, s3_url: str) -> str:
        """Download to a temp file and return path."""
        content = self.download_file(s3_url)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
            tmp.write(content)
            return tmp.name

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate presigned GET URL for stored quiz JSON."""
        if s3_key.startswith("s3://"):
            _, key = self._parse_s3_url(s3_key)
        else:
            key = s3_key
        try:
            return self.s3_client.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket_name, "Key": key}, ExpiresIn=expiration
            )
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return ""

    def _parse_s3_url(self, s3_url: str):
        if s3_url.startswith("s3://"):
            parts = s3_url[5:].split("/", 1)
            if len(parts) == 2:
                return parts[0], parts[1]
        raise ValueError(f"Invalid S3 URL format: {s3_url}")


s3_service = S3Service()

