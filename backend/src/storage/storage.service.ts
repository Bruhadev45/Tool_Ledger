import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private useS3: boolean;
  private localStoragePath: string;

  constructor(private configService: ConfigService) {
    const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const bucket = this.configService.get<string>('S3_BUCKET_NAME');

    if (awsAccessKey && awsSecretKey && bucket) {
      this.useS3 = true;
      this.bucketName = bucket;
      this.s3Client = new S3Client({
        region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      });
    } else {
      // Fallback to local storage
      this.useS3 = false;
      this.localStoragePath = path.join(process.cwd(), 'uploads');
      // Ensure uploads directory exists
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    pathPrefix: string,
  ): Promise<{ url: string; key: string }> {
    if (this.useS3) {
      const key = `${pathPrefix}/${Date.now()}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      return {
        url: key, // Store key, generate signed URL on demand
        key,
      };
    } else {
      // Local file storage fallback
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(this.localStoragePath, pathPrefix, fileName);
      const dirPath = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Write file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Return relative path as key
      const key = `${pathPrefix}/${fileName}`;

      return {
        url: key,
        key,
      };
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.useS3) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      // For local storage, return a URL that can be served by the StorageController
      const filePath = path.join(this.localStoragePath, key);
      if (fs.existsSync(filePath)) {
        // Return a URL without /api prefix since the baseURL already includes it
        // The StorageController is at /api/files, so we return /files/{key}
        return `/files/${key}`;
      }
      throw new Error(`File not found: ${key}`);
    }
  }

  /**
   * Delete a file from storage
   *
   * Removes a file from S3 or local storage.
   *
   * @param key - The file key/path to delete
   */
  async deleteFile(key: string): Promise<void> {
    if (this.useS3) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } else {
      // Local file deletion
      const filePath = path.join(this.localStoragePath, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}
