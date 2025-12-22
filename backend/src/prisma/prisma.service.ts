import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000; // 5 seconds

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(
          `Attempting to connect to database (attempt ${attempt}/${this.maxRetries})...`,
        );
        await this.$connect();

        // Verify connection with a simple query
        await this.$queryRaw`SELECT 1`;

        this.logger.log('✅ Successfully connected to database');
        this.connectionRetries = 0;
        return;
      } catch (error: any) {
        this.connectionRetries = attempt;
        const errorMessage = error?.message || 'Unknown error';
        const errorCode = error?.code || 'UNKNOWN';

        this.logger.error(
          `❌ Database connection attempt ${attempt}/${this.maxRetries} failed: ${errorMessage} (Code: ${errorCode})`,
        );

        if (attempt < this.maxRetries) {
          this.logger.log(`Retrying in ${this.retryDelay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        } else {
          this.logger.error('❌ Failed to connect to database after all retry attempts');
          this.logger.error('Please check:');
          this.logger.error('  1. DATABASE_URL environment variable is set correctly');
          this.logger.error('  2. Database server is running and accessible');
          this.logger.error('  3. Network connectivity to database host');
          this.logger.error('  4. Database credentials are correct');
          // Don't throw here to allow the app to start and respond to healthchecks
        }
      }
    }
  }

  /**
   * Check if database is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reconnect to database
   */
  async reconnect() {
    try {
      await this.$disconnect();
      await this.connectWithRetry();
    } catch (error) {
      this.logger.error('Failed to reconnect to database:', error);
      throw error;
    }
  }
}
