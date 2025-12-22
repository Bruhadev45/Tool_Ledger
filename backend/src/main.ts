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

  // Add root healthcheck route BEFORE setting global prefix (for Railway healthcheck)
  // This ensures Railway can check / and get a 200 OK response
  app.getHttpAdapter().get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'ToolLedger API',
      timestamp: new Date().toISOString(),
    });
  });

  // Set global API prefix: All routes will be prefixed with /api
  app.setGlobalPrefix('api');

  // Start the server on configured port
  // Railway provides PORT env var, ensure we use it
  const numericPort = typeof port === 'string' ? parseInt(port, 10) : port;
  if (isNaN(numericPort)) {
    throw new Error(`Invalid port: ${port}`);
  }

  await app.listen(numericPort, '0.0.0.0');

  // Log server startup information
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Server running on port ${numericPort}`);
  logger.log(`📡 API Base URL: /api`);
  logger.log(`🌐 CORS Allowed Origin: ${frontendUrl || 'Not configured'}`);
  logger.log(`✅ Healthcheck available at: / and /api/health`);

  // Check database connection after startup
  try {
    const { PrismaService } = await import('./prisma/prisma.service');
    const prismaService = app.get(PrismaService);
    if (prismaService && typeof (prismaService as any).isConnected === 'function') {
      const isConnected = await (prismaService as any).isConnected();
      if (isConnected) {
        logger.log(`✅ Database connection: Verified`);
      } else {
        logger.warn(`⚠️  Database connection: Not connected`);
      }
    }
  } catch (error: any) {
    logger.warn(`⚠️  Could not verify database connection: ${error?.message || error}`);
  }
}

// Start the application
bootstrap();
