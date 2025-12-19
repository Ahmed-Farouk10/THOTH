const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const logger = require("../utils/logger");

// Configure S3 Client
const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
};

// Support LocalStack endpoint
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true; // Required for LocalStack
}

const s3Client = new S3Client(s3Config);
const bucketName = process.env.S3_BUCKET || "document-reader-storage-dev";

const uploadToS3 = async (buffer, filename, contentType) => {
  try {
    const key = filename.startsWith("audio/") ? filename : `audio/${Date.now()}-${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    
    // Return S3 URI format for consistency
    const s3Uri = process.env.S3_ENDPOINT 
      ? `${process.env.S3_ENDPOINT}/${bucketName}/${key}`
      : `s3://${bucketName}/${key}`;
    
    logger.info(`File uploaded to S3: ${s3Uri}`);
    return s3Uri;
  } catch (error) {
    logger.error("S3 upload error:", error);
    throw error;
  }
};

const getFromS3 = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
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

const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    logger.info(`File deleted from S3: ${key}`);
  } catch (error) {
    logger.error("S3 delete error:", error);
    throw error;
  }
};

const downloadFromS3 = async (s3Uri) => {
  try {
    // Parse S3 URI (s3://bucket/key or http://localstack:4566/bucket/key)
    let bucket, key;
    
    if (s3Uri.startsWith("s3://")) {
      const parts = s3Uri.replace("s3://", "").split("/");
      bucket = parts[0];
      key = parts.slice(1).join("/");
    } else if (s3Uri.includes("localstack") || s3Uri.includes("s3")) {
      // Handle LocalStack URL format: http://localstack:4566/bucket/key
      try {
        const url = new URL(s3Uri);
        const pathParts = url.pathname.split("/").filter(p => p);
        bucket = pathParts[0];
        key = pathParts.slice(1).join("/");
      } catch (urlError) {
        // Fallback: assume it's just a key
        bucket = bucketName;
        key = s3Uri.replace(/^.*\/audio\//, "audio/");
      }
    } else {
      // Assume it's just a key
      bucket = bucketName;
      key = s3Uri;
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
