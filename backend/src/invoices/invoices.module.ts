import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesParserService } from './invoices-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditLogModule, StorageModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesParserService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
