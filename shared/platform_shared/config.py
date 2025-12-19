"""
Centralized Configuration Management

This module uses Pydantic Settings to manage configuration across services.
Benefits:
- Type-safe configuration
- Environment variable support
- Validation on startup
- Default values
- .env file support

Why centralized?
- Consistency across services
- Single source of truth
- Easy to change defaults
- Validation prevents runtime errors
"""

from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import Optional, List
import os


class DatabaseSettings(BaseSettings):
    """
    Database connection settings.
    
    Loaded from environment variables:
    - DB_HOST: Database hostname
    - DB_PORT: Database port (default: 5432)
    - DB_NAME: Database name
    - DB_USER: Database username
    - DB_PASSWORD: Database password
    """
    host: str = Field(..., env="DB_HOST")
    port: int = Field(5432, env="DB_PORT")
    database: str = Field(..., env="DB_NAME")
    username: str = Field(..., env="DB_USER")
    password: str = Field(..., env="DB_PASSWORD")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def url(self) -> str:
        """Build PostgreSQL connection URL."""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


class KafkaSettings(BaseSettings):
    """
    Kafka broker configuration.
    
    Environment variables:
    - KAFKA_BROKERS: Comma-separated list of broker addresses
    - KAFKA_GROUP_ID: Consumer group ID (optional, set per service)
    """
    bootstrap_servers: str = Field(..., env="KAFKA_BROKERS")
    group_id: Optional[str] = Field(None, env="KAFKA_GROUP_ID")
    
    # Producer settings
    acks: str = Field("all", env="KAFKA_ACKS")  # all, 1, 0
    enable_idempotence: bool = Field(True, env="KAFKA_ENABLE_IDEMPOTENCE")
    compression_type: str = Field("snappy", env="KAFKA_COMPRESSION")
    retries: int = Field(2147483647, env="KAFKA_RETRIES")  # Practically unlimited
    
    # Consumer settings
    auto_commit: bool = Field(False, env="KAFKA_AUTO_COMMIT")
    max_poll_interval_ms: int = Field(300000, env="KAFKA_MAX_POLL_INTERVAL")  # 5 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def broker_list(self) -> List[str]:
        """Parse comma-separated broker list."""
        return [b.strip() for b in self.bootstrap_servers.split(",")]


class AWSSettings(BaseSettings):
    """
    AWS service configuration.
    
    Environment variables:
    - AWS_REGION: AWS region (default: us-east-1)
    - S3_BUCKET_PREFIX: Environment prefix for buckets (dev, staging, prod)
    """
    region: str = Field("us-east-1", env="AWS_REGION")
    s3_bucket_prefix: str = Field("dev", env="S3_BUCKET_PREFIX")
    
    # S3 bucket names (constructed from prefix)
    @property
    def document_bucket(self) -> str:
        return f"document-reader-storage-{self.s3_bucket_prefix}-1763832262"
    
    @property
    def quiz_bucket(self) -> str:
        return f"quiz-service-storage-{self.s3_bucket_prefix}-1763832262"
    
    @property
    def chat_bucket(self) -> str:
        return f"chat-service-storage-{self.s3_bucket_prefix}-1763832262"
    
    @property
    def tts_bucket(self) -> str:
        return f"tts-service-storage-{self.s3_bucket_prefix}-1763832262"
    
    @property
    def stt_bucket(self) -> str:
        return f"stt-service-storage-{self.s3_bucket_prefix}-1763832262"
    
    @property
    def shared_bucket(self) -> str:
        return f"shared-assets-{self.s3_bucket_prefix}-1763832262"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


class ServiceSettings(BaseSettings):
    """
    Service-specific settings.
    
    Each service should create an instance with its name:
    settings = ServiceSettings(service_name="user-service")
    
    Environment variables:
    - SERVICE_NAME: Name of the service
    - DEBUG: Enable debug mode (default: False)
    - LOG_LEVEL: Logging level (default: INFO)
    - USER_SERVICE_URL: URL of user service (for aggregator)
    """
    service_name: str
    debug: bool = Field(False, env="DEBUG")
    log_level: str = Field("INFO", env="LOG_LEVEL")
    user_service_url: Optional[str] = Field(None, env="USER_SERVICE_URL")
    
    # Nested settings
    database: Optional[DatabaseSettings] = None
    kafka: Optional[KafkaSettings] = None
    aws: Optional[AWSSettings] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Initialize nested settings if not provided
        if self.database is None:
            try:
                self.database = DatabaseSettings()
            except Exception:
                pass  # Database not required for all services
        if self.kafka is None:
            try:
                self.kafka = KafkaSettings()
            except Exception:
                pass  # Kafka not required for all services
        if self.aws is None:
            try:
                self.aws = AWSSettings()
            except Exception:
                pass  # AWS not required for all services

