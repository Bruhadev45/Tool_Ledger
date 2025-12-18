import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from './storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('files')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get('*')
  async serveFile(@Param('0') filePath: string, @Res() res: Response) {
    try {
      // Security: prevent directory traversal
      const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.join(process.cwd(), 'uploads', safePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new NotFoundException('File not found');
      }

      // Check if it's a file (not a directory)
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        throw new NotFoundException('File not found');
      }

      // Determine content type
      const ext = path.extname(fullPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
      };
      const contentType = contentTypes[ext] || 'application/octet-stream';

      // Set headers and send file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
      res.sendFile(fullPath);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('File not found');
    }
  }
}
