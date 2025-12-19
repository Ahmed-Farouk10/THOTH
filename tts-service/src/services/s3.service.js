const AWS = require("aws-sdk");
const logger = require("../utils/logger");

// Configure AWS
const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
};

// Support LocalStack endpoint
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.s3ForcePathStyle = true; // Required for LocalStack
}

AWS.config.update(s3Config);

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET || "document-reader-storage-dev";

const uploadToS3 = async (buffer, filename, contentType = "audio/mpeg") => {
  try {
    const key = filename.startsWith("audio/") ? filename : `audio/${Date.now()}-${filename}`;
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    // Don't set ACL for LocalStack compatibility
    if (!process.env.S3_ENDPOINT) {
      params.ACL = "public-read";
    }

    const result = await s3.upload(params).promise();
    
    // Return S3 URI format for consistency
    const s3Uri = result.Location || `s3://${bucketName}/${key}`;
    logger.info(`File uploaded to S3: ${s3Uri}`);
    return s3Uri;
  } catch (error) {
    logger.error("S3 upload error:", error);
    throw error;
  }
};

const getFromS3 = async (key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const result = await s3.getObject(params).promise();
    return result.Body;
  } catch (error) {
    logger.error("S3 get error:", error);
    throw error;
  }
};

const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    logger.info(`File deleted from S3: ${key}`);
  } catch (error) {
    logger.error("S3 delete error:", error);
    throw error;
  }
};

module.exports = { uploadToS3, getFromS3, deleteFromS3 };
