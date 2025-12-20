const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const logger = require("../utils/logger");

/**
 * S3 Service with IAM Role (IRSA) authentication for production.
 * 
 * STT service MUST use its own bucket (stt-service-storage-prod).
 * In production, uses IAM roles (no credentials).
 * In development, uses LocalStack with test credentials.
 */

// CRITICAL: Bucket name MUST be service-specific
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error(
    "S3_BUCKET_NAME environment variable is required. " +
    "STT service must use 'stt-service-storage-prod' bucket"
  );
}

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

let s3Config;

if (ENVIRONMENT === 'production') {
  // Production: Use IAM role (IRSA), NO credentials
  s3Config = {
    region: AWS_REGION,
  };
  logger.info(`STT S3 client initialized for PRODUCTION (IRSA) - Bucket: ${BUCKET_NAME}, Region: ${AWS_REGION}`);
} else {
  // Development: LocalStack
  const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localstack:4566';
  s3Config = {
    region: AWS_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
    forcePathStyle: true, // Required for LocalStack
  };
  logger.info(`STT S3 client initialized for DEVELOPMENT (LocalStack) - Bucket: ${BUCKET_NAME}, Endpoint: ${S3_ENDPOINT}`);
}

const s3Client = new S3Client(s3Config);

/**
 * Upload audio file to S3 (STT service's own bucket only)
 */
const uploadToS3 = async (buffer, filename, contentType) => {
  try {
    const key = filename.startsWith("audio/") ? filename : `audio/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const s3Uri = `s3://${BUCKET_NAME}/${key}`;
    logger.info(`Uploaded audio to ${s3Uri}`);
    return s3Uri;
  } catch (error) {
    logger.error(`Error uploading to S3 bucket '${BUCKET_NAME}':`, error);
    throw error;
  }
};

/**
 * Get file from S3 (STT bucket only)
 */
const getFromS3 = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    logger.error("S3 get error:", error);
    throw error;
  }
};

/**
 * Delete file from S3
 */
const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    logger.info(`Deleted file from S3: ${key}`);
  } catch (error) {
    logger.error("S3 delete error:", error);
    throw error;
  }
};

/**
 * Download file from S3 URL (must be from STT bucket only)
 */
const downloadFromS3 = async (s3Uri) => {
  try {
    // Parse S3 URI
    let bucket, key;

    if (s3Uri.startsWith("s3://")) {
      const parts = s3Uri.replace("s3://", "").split("/");
      bucket = parts[0];
      key = parts.slice(1).join("/");
    } else {
      // Assume it's just a key
      bucket = BUCKET_NAME;
      key = s3Uri;
    }

    // Security check: Ensure we're only accessing our own bucket
    if (bucket !== BUCKET_NAME) {
      const error = new Error(
        `SECURITY VIOLATION: STT service attempted to access bucket '${bucket}' ` +
        `but is only authorized for '${BUCKET_NAME}'`
      );
      logger.error(error.message);
      throw error;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    logger.info(`Downloaded from S3: ${bucket}/${key} (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    logger.error("S3 download error:", error);
    throw error;
  }
};

module.exports = { uploadToS3, getFromS3, deleteFromS3, downloadFromS3 };
