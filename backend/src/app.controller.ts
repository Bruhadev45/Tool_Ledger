import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  getRoot() {
    return {
      message: 'ToolLedger API',
      version: '2.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        analytics: '/api/analytics',
        credentials: '/api/credentials',
        invoices: '/api/invoices',
      },
    };
  }

  @Get('health')
  async getHealth() {
    this.logger.log('Health check endpoint hit');

    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'unknown' as 'connected' | 'disconnected' | 'unknown',
      databaseError: null as string | null,
    };

    // Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      healthStatus.database = 'connected';
      this.logger.log('Database connection: OK');
    } catch (error: any) {
      healthStatus.database = 'disconnected';
      healthStatus.databaseError = error?.message || 'Database connection failed';
      this.logger.error('Database connection check failed:', error?.message);
    }

    return healthStatus;
  }
}
