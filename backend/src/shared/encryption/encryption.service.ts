import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly logger = new Logger(EncryptionService.name);

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
    if (!encryptedData || typeof encryptedData !== 'string') {
      this.logger.error('Decryption failed: Invalid input data');
      throw new Error('Invalid encrypted data: data is null or not a string');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      this.logger.error(`Decryption failed: Invalid format. Expected 3 parts, got ${parts.length}`);
      throw new Error('Invalid encrypted data format: expected format iv:authTag:encrypted');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    // Validate hex strings
    if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(authTagHex) || !/^[0-9a-f]+$/i.test(encrypted)) {
      this.logger.error('Decryption failed: Invalid hex format in encrypted data');
      throw new Error('Invalid encrypted data: contains non-hexadecimal characters');
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Validate buffer lengths
      if (iv.length !== 16) {
        this.logger.error(`Decryption failed: Invalid IV length. Expected 16 bytes, got ${iv.length}`);
        throw new Error('Invalid encrypted data: IV must be 16 bytes');
      }

      if (authTag.length !== 16) {
        this.logger.error(`Decryption failed: Invalid auth tag length. Expected 16 bytes, got ${authTag.length}`);
        throw new Error('Invalid encrypted data: Auth tag must be 16 bytes');
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      // Check if it's an authentication error (wrong key)
      if (error.message?.includes('Unsupported state') || error.message?.includes('unable to authenticate')) {
        this.logger.error(
          'Decryption failed: Authentication error. This usually means the ENCRYPTION_KEY is different from the one used to encrypt the data.',
        );
        throw new Error(
          'Decryption failed: Invalid encryption key. The data was encrypted with a different key. Ensure ENCRYPTION_KEY matches the key used during encryption.',
        );
      }

      // Log other errors
      this.logger.error(`Decryption failed: ${error.message}`, error.stack);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
