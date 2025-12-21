/**
 * Invoices Service
 *
 * Handles invoice management including creation, file upload, approval workflow,
 * and linking to credentials. Supports multi-tenant isolation and role-based access.
 * All invoices are stored in USD currency.
 *
 * @module InvoicesService
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { InvoiceStatus, UserRole } from '@prisma/client';
import { CreateInvoiceDto, UpdateInvoiceDto, ApproveInvoiceDto } from './dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  /**
   * Create a new invoice
   *
   * Creates an invoice with optional PDF file upload. Validates amount, dates,
   * and handles file storage. Supports linking to credentials for tracking
   * which credentials are associated with billing.
   *
   * @param userId - ID of the user creating the invoice
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param userRole - Role of the user (to check if they can select organization)
   * @param createDto - Invoice data (number, amount, provider, dates, category, credential IDs, organizationId)
   * @param file - Optional PDF file to upload
   * @returns Created invoice object with file information
   * @throws BadRequestException if validation fails or file upload fails
   */
  async create(
    userId: string,
    organizationId: string,
    userRole: UserRole,
    createDto: CreateInvoiceDto,
    file?: Express.Multer.File,
  ) {
    // Use provided organizationId or default to user's organization
    let targetOrganizationId = organizationId;

    // Only admins can create invoices for other organizations
    if (createDto.organizationId) {
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admins can create invoices for other organizations');
      }
      // Verify the organization exists
      const org = await this.prisma.organization.findUnique({
        where: { id: createDto.organizationId },
      });
      if (!org) {
        throw new BadRequestException('Organization not found');
      }
      targetOrganizationId = createDto.organizationId;
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    // Upload invoice PDF file if provided
    if (file) {
      try {
        // Upload to storage service (S3 or local storage)
        const uploadResult = await this.storageService.uploadFile(
          file,
          `invoices/${targetOrganizationId}`, // Organize by organization ID
        );

        fileUrl = uploadResult.url;
        fileName = file.originalname;
        fileSize = file.size;
      } catch (error: unknown) {
        // Re-throw the error so the invoice creation fails if file upload fails
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(
          `Failed to upload file "${file.originalname}": ${errorMessage}. Please try again or contact support.`,
        );
      }
    }

    // Validate and normalize amount (must be positive number)
    const amount =
      typeof createDto.amount === 'number'
        ? createDto.amount
        : parseFloat(String(createDto.amount));

    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a valid number greater than 0');
    }

    // Validate and parse billing date (required)
    const billingDate = new Date(createDto.billingDate);
    if (isNaN(billingDate.getTime())) {
      throw new BadRequestException('Invalid billing date format. Please use YYYY-MM-DD format.');
    }

    // Validate and parse due date (optional)
    let dueDate: Date | null = null;
    if (createDto.dueDate) {
      dueDate = new Date(createDto.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid due date format. Please use YYYY-MM-DD format.');
      }
    }

    // Prepare invoice data for database insertion
    const invoiceData = {
      invoiceNumber: createDto.invoiceNumber.trim(),
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places for currency precision
      currency: 'USD', // All invoices are stored in USD
      provider: createDto.provider.trim(),
      billingDate,
      dueDate,
      category: createDto.category?.trim() || null,
      fileUrl,
      fileName,
      fileSize,
      organizationId: targetOrganizationId,
      uploadedById: userId,
      status: InvoiceStatus.PENDING, // New invoices start as pending (require admin approval)
      // Create links to associated credentials if provided
      credentialLinks: createDto.credentialIds
        ? {
            create: createDto.credentialIds.map((credId) => ({
              credentialId: credId,
            })),
          }
        : undefined,
    };

    return this.prisma.invoice.create({
      data: invoiceData,
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        credentialLinks: {
          include: {
            credential: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(
    organizationId: string,
    userRole: UserRole,
    filters?: {
      status?: InvoiceStatus;
      provider?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    // Admins can see all invoices across all organizations
    // Accountants can only see approved invoices from their organization uploaded by admins
    const where: any = userRole === UserRole.ADMIN ? {} : { organizationId };

    // Accountants can only see approved invoices uploaded by admins
    if (userRole === UserRole.ACCOUNTANT) {
      where.status = InvoiceStatus.APPROVED;
      // Get admin user IDs first
      const adminUsers = await this.prisma.user.findMany({
        where: {
          organizationId,
          role: UserRole.ADMIN,
          isActive: true,
        },
        select: { id: true },
      });
      const adminIds = adminUsers.map((u) => u.id);
      // Filter to only show invoices uploaded by admins
      where.uploadedById = { in: adminIds };
    }

    if (filters) {
      if (filters.status) where.status = filters.status;
      if (filters.provider) where.provider = filters.provider;
      if (filters.startDate || filters.endDate) {
        where.billingDate = {};
        if (filters.startDate) where.billingDate.gte = filters.startDate;
        if (filters.endDate) where.billingDate.lte = filters.endDate;
      }
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
        credentialLinks: {
          include: {
            credential: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { billingDate: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string, userRole: UserRole) {
    // Admins can see invoices from any organization
    const whereClause: any = { id };
    if (userRole !== UserRole.ADMIN) {
      whereClause.organizationId = organizationId;
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: whereClause,
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
        credentialLinks: {
          include: {
            credential: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Accountants can only see approved invoices
    if (userRole === UserRole.ACCOUNTANT && invoice.status !== InvoiceStatus.APPROVED) {
      throw new ForbiddenException('You can only view approved invoices');
    }

    return invoice;
  }

  async getSignedUrl(id: string, organizationId: string, userRole: UserRole) {
    const invoice = await this.findOne(id, organizationId, userRole);

    if (!invoice.fileUrl) {
      throw new BadRequestException('Invoice file not found');
    }

    // Accountants can only download approved invoices
    // Admins can download any invoice (including pending) for review and approval
    if (userRole === UserRole.ACCOUNTANT && invoice.status !== InvoiceStatus.APPROVED) {
      throw new ForbiddenException('You can only download approved invoices');
    }

    // Admins and owners can always access the file
    return this.storageService.getSignedUrl(invoice.fileUrl);
  }

  async approve(id: string, userId: string, organizationId: string, approveDto: ApproveInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Invoice is not pending approval');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        approvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async reject(id: string, userId: string, organizationId: string, rejectionReason: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Invoice is not pending approval');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    updateDto: UpdateInvoiceDto,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only uploader or admin can update, and only if pending
    const isUploader = invoice.uploadedById === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isUploader && !isAdmin) {
      throw new ForbiddenException('You do not have permission to update this invoice');
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('You can only update pending invoices');
    }

    const updateData: any = {};
    if (updateDto.amount) updateData.amount = updateDto.amount;
    if (updateDto.provider) updateData.provider = updateDto.provider;
    if (updateDto.billingDate) updateData.billingDate = new Date(updateDto.billingDate);
    if (updateDto.dueDate !== undefined)
      updateData.dueDate = updateDto.dueDate ? new Date(updateDto.dueDate) : null;
    if (updateDto.category) updateData.category = updateDto.category;

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete an invoice
   *
   * Permanently removes an invoice. Only the uploader or admin can delete.
   * Admins can delete invoices from any organization.
   *
   * @param id - Invoice ID
   * @param userId - ID of the user requesting deletion
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param userRole - Role of the user
   * @returns Success message
   * @throws NotFoundException if invoice not found
   * @throws ForbiddenException if user doesn't have permission
   */
  async remove(id: string, userId: string, organizationId: string, userRole: UserRole) {
    // Admins can delete invoices from any organization
    const whereClause: any = { id };
    if (userRole !== UserRole.ADMIN) {
      whereClause.organizationId = organizationId;
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: whereClause,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only uploader or admin can delete
    const isUploader = invoice.uploadedById === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isUploader && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this invoice');
    }

    // Delete the file from storage if it exists
    if (invoice.fileUrl) {
      try {
        await this.storageService.deleteFile(invoice.fileUrl);
      } catch (error) {
        // Log but don't fail - file might already be deleted
        this.logger.warn('Failed to delete invoice file:', error);
      }
    }

    await this.prisma.invoice.delete({
      where: { id },
    });

    return { message: 'Invoice deleted successfully' };
  }
}
