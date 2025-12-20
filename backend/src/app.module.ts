/**
 * Application Root Module
 *
 * Main NestJS module that imports and configures all feature modules,
 * global modules (Config, Throttler), and shared modules (Prisma, Encryption).
 * This is the root of the dependency injection container.
 *
 * @module AppModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CredentialsModule } from './credentials/credentials.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { TeamsModule } from './teams/teams.module';
import { EncryptionModule } from './shared/encryption/encryption.module';
import { EmailModule } from './email/email.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    // Global configuration module: Loads environment variables from .env files
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Check .env.local first, then .env
    }),
    // Rate limiting: Prevents abuse by limiting requests per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window: 1 minute
        limit: 100, // Maximum 100 requests per minute per IP
      },
    ]),
    // Shared modules: Available throughout the application
    PrismaModule, // Database ORM and connection management
    EncryptionModule, // AES-256 encryption service for sensitive data

    // Feature modules: Business logic and API endpoints
    AuthModule, // Authentication, MFA, password management
    UsersModule, // User management and RBAC
    OrganizationsModule, // Multi-tenant organization management
    CredentialsModule, // Credential storage and sharing
    InvoicesModule, // Invoice upload, approval, and tracking
    AnalyticsModule, // Analytics and reporting endpoints
    CommentsModule, // Comments on invoices and credentials
    NotificationsModule, // User notifications
    AuditLogModule, // Audit trail logging
    AiAssistantModule, // AI-powered invoice parsing and insights
    TeamsModule, // Team management for credential sharing
    EmailModule, // Email notification service
  ],
})
export class AppModule {}
