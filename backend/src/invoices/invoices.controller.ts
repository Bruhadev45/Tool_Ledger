import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicesService } from './invoices.service';
import { InvoicesParserService } from './invoices-parser.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';
import { CreateInvoiceDto, UpdateInvoiceDto, ApproveInvoiceDto } from './dto';
import { UserPayload } from '../shared/types/common.types';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private invoicesService: InvoicesService,
    private invoicesParserService: InvoicesParserService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @CurrentUser() user: UserPayload,
    @Body() createDto: CreateInvoiceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.invoicesService.create(user.id, user.organizationId, user.role, createDto, file);
  }

  @Get()
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('status') status?: InvoiceStatus,
    @Query('provider') provider?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.invoicesService.findAll(user.organizationId, user.role, {
      status,
      provider,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file provided' };
    }
    try {
      const result = await this.invoicesParserService.parseInvoiceFile(file);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse invoice';
      const errorStack = error instanceof Error ? error.stack : undefined;
      return {
        error: errorMessage,
        details: errorStack,
      };
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.invoicesService.findOne(id, user.organizationId, user.role);
  }

  @Get(':id/download')
  getSignedUrl(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.invoicesService.getSignedUrl(id, user.organizationId, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() updateDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, user.id, user.organizationId, user.role, updateDto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() approveDto: ApproveInvoiceDto,
  ) {
    return this.invoicesService.approve(id, user.id, user.organizationId, approveDto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() body: { reason: string },
  ) {
    return this.invoicesService.reject(id, user.id, user.organizationId, body.reason);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.invoicesService.remove(id, user.id, user.organizationId, user.role);
  }
}
