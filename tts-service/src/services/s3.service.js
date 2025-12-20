const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const logger = require("../utils/logger");

/**
 * S3 Service with IAM Role (IRSA) authentication for production.
 * 
 * TTS service MUST use its own bucket (tts-service-storage-prod).
 * In production, uses IAM roles (no credentials).
 * In development, uses LocalStack with test credentials.
 */

// CRITICAL: Bucket name MUST be service-specific
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error(
    "S3_BUCKET_NAME environment variable is required. " +
    "TTS service must use 'tts-service-storage-prod' bucket"
  );
}

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

let s3ClientConfig;

if (ENVIRONMENT === 'production') {
  // Production: Use IAM role (IRSA), NO credentials
  // Kubernetes ServiceAccount with eks.amazonaws.com/role-arn annotation
  // provides temporary credentials automatically
  s3ClientConfig = {
    region: AWS_REGION,
  };
  logger.info(`TTS S3 client initialized for PRODUCTION (IRSA) - Bucket: ${BUCKET_NAME}, Region: ${AWS_REGION}`);
} else {
  // Development: LocalStack
  const S3_ENDPOINT = process.env.S3_ENDPOINT_URL || process.env.S3_ENDPOINT || 'http://localstack:4566';
  s3ClientConfig = {
    region: AWS_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
    forcePathStyle: true, // Required for LocalStack
  };
  logger.info(`TTS S3 client initialized for DEVELOPMENT (LocalStack) - Bucket: ${BUCKET_NAME}, Endpoint: ${S3_ENDPOINT}`);
}

const s3Client = new S3Client(s3ClientConfig);

/**
 * Upload audio file to S3 (TTS service's own bucket only)
 */
async function uploadAudio(audioBuffer, key) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    });

    await s3Client.send(command);
    const s3Url = `s3://${BUCKET_NAME}/${key}`;
    logger.info(`Uploaded audio to ${s3Url}`);
    return s3Url;
  } catch (error) {
    logger.error(`Error uploading to S3 bucket '${BUCKET_NAME}':`, error);
    throw error;
  }
}

/**
 * Generate presigned URL for audio file (from TTS bucket only)
 */
async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    // Replace internal Docker hostname with localhost (development only)
    if (ENVIRONMENT !== 'production' && url.includes('localstack:')) {
      return url.replace('localstack:', 'localhost:');
    }

    return url;
  } catch (error) {
    logger.error('Error generating presigned URL:', error);
    throw error;
  }
}

module.exports = {
  uploadAudio,
  generatePresignedUrl,
};
