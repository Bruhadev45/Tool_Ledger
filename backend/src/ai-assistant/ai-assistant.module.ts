/**
 * AI Assistant Module
 *
 * Provides AI-powered insights and question answering capabilities.
 * Integrates with OpenAI for intelligent analysis of credentials, invoices, and spending.
 *
 * @module AiAssistantModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { EncryptionModule } from '../shared/encryption/encryption.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AnalyticsModule,
    CredentialsModule, // Import to access CredentialsService for proper credential fetching
    EncryptionModule, // Import to decrypt credentials for AI context
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
