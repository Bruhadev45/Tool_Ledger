/**
 * Main Application Bootstrap
 *
 * Initializes the NestJS application with security middleware, CORS,
 * validation pipes, and global configuration. This is the entry point
 * for the backend API server.
 *
 * @module Main
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Import compression using require for CommonJS compatibility
const compression = require('compression');

/**
 * Bootstrap function to initialize and start the NestJS application
 *
 * Configures:
 * - Security headers (Helmet)
 * - Response compression
 * - CORS settings
 * - Global validation pipes
 * - API route prefix
 */
async function bootstrap() {
  // Create NestJS application instance
  const app = await NestFactory.create(AppModule);

  // Get configuration service for environment variables
  const configService = app.get(ConfigService);

  // Security middleware: Helmet sets various HTTP headers for security
  app.use(helmet());

  // Compression middleware: Reduces response size for better performance
  app.use(compression());

  // CORS configuration: Allow requests from frontend origin
  // Fixed for Railway deployment: uses FRONTEND_URL env var and PORT from Railway
  // For local development, allow localhost:3000 if FRONTEND_URL is not set
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3000';
  // Use PORT from env (Railway sets this), or ConfigService, or default to 3001 for local dev
  const port = process.env.PORT || configService.get('PORT') || 3001;

  app.enableCors({
    origin: frontendUrl,
    credentials: true, // Allow cookies and authorization headers
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // Global validation pipe: Automatically validates all incoming requests
  // Uses class-validator decorators from DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types automatically
      },
      exceptionFactory: (errors) => {
        // Custom error formatting for validation failures
        const messages = errors.map((error) => {
          const constraints = error.constraints || {};
          return Object.values(constraints).join(', ');
        });
        return new BadRequestException({
          message: 'Validation failed',
          errors: messages,
        });
      },
    }),
  );

  // Set global API prefix: All routes will be prefixed with /api
  app.setGlobalPrefix('api');

  // Root endpoint: Provides API information and available endpoints
  app
    .getHttpAdapter()
    .get(
      '/',
      (req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
        res.status(200).json({
          message: 'ToolLedger API',
          version: '2.0.0',
          info: 'All API endpoints are prefixed with /api',
          endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            analytics: '/api/analytics',
            credentials: '/api/credentials',
            invoices: '/api/invoices',
          },
        });
      },
    );

  // Start the server on configured port
  // Railway provides PORT env var, default to 8080 if not set
  await app.listen(port);

  // Log server startup information
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Server running on port ${port}`);
  logger.log(`📡 API Base URL: /api`);
  logger.log(`🌐 CORS Allowed Origin: ${frontendUrl || 'Not configured'}`);
}

// Start the application
bootstrap();
