import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
    console.log('Healthcheck endpoint hit');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
