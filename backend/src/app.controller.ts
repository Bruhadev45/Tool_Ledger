import { Controller, Get, Logger } from '@nestjs/common';

/**
 * Root Application Controller
 *
 * Provides health check and API information endpoints.
 * These endpoints are public and don't require authentication.
 */
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  /**
   * Get API information
   *
   * Returns basic API metadata and available endpoint paths.
   */
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

  /**
   * Health check endpoint
   *
   * Used by deployment platforms (Railway) to verify the service is running.
   * Returns current status and timestamp.
   */
  @Get('health')
  getHealth() {
    this.logger.log('Health check endpoint hit');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
