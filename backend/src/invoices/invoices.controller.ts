import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
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
    @CurrentUser() user: any,
    @Body() createDto: CreateInvoiceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.invoicesService.create(
      user.id,
      user.organizationId,
      createDto,
      file,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
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
    } catch (error: any) {
      return {
        error: error.message || 'Failed to parse invoice',
        details: error.stack,
      };
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.findOne(id, user.organizationId, user.role);
  }

  @Get(':id/download')
  getSignedUrl(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.getSignedUrl(id, user.organizationId, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, user.id, user.organizationId, user.role, updateDto);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() approveDto: ApproveInvoiceDto,
  ) {
    return this.invoicesService.approve(id, user.id, user.organizationId, approveDto);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.invoicesService.reject(id, user.id, user.organizationId, body.reason);
  }
}
