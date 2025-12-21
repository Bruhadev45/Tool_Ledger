import { Controller, Get, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
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
  getHealth() {
    this.logger.log('Health check endpoint hit');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
