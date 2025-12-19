import logging
import os

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

    def download_file(self, s3_url: str) -> bytes:
        """Download file bytes from S3 URL."""
        bucket, key = self._parse_s3_url(s3_url)
        try:
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def _parse_s3_url(self, s3_url: str):
        if s3_url.startswith("s3://"):
            parts = s3_url[5:].split("/", 1)
            if len(parts) == 2:
                return parts[0], parts[1]
        raise ValueError(f"Invalid S3 URL format: {s3_url}")


s3_service = S3Service()

