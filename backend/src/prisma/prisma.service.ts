import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error('Failed to connect to Prisma on startup:', error);
      // Don't throw here to allow the app to start and respond to healthchecks
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
