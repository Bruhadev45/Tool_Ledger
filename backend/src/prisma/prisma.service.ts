import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.error('Failed to connect to Prisma on startup:', error);
      // Don't throw here to allow the app to start and respond to healthchecks
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
