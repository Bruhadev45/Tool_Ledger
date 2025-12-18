import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required');
    }
    
    // Handle base64 encoded keys (common practice)
    let keyBuffer: Buffer;
    try {
      // Try to decode as base64 first
      keyBuffer = Buffer.from(encryptionKey, 'base64');
      if (keyBuffer.length !== 32) {
        // If base64 decode doesn't give 32 bytes, try UTF-8
        keyBuffer = Buffer.from(encryptionKey, 'utf8');
      }
    } catch {
      // If base64 decode fails, use UTF-8
      keyBuffer = Buffer.from(encryptionKey, 'utf8');
    }
    
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (or 44 characters base64 encoded)');
    }
    
    this.key = keyBuffer;
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
