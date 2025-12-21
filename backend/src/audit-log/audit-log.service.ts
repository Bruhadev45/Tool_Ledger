import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    action: AuditAction;
    resourceType: string;
    resourceId?: string | null;
    userId: string;
    organizationId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any; // Json type accepts objects or JSON strings
  }) {
    // Build data object, omitting undefined fields
    const createData: any = {
      action: data.action,
      resourceType: data.resourceType,
      userId: data.userId,
      organizationId: data.organizationId,
    };

    // Only include optional fields if they have values
    if (data.resourceId !== undefined && data.resourceId !== null) {
      createData.resourceId = data.resourceId;
    }
    if (data.ipAddress) {
      createData.ipAddress = data.ipAddress;
    }
    if (data.userAgent) {
      createData.userAgent = data.userAgent;
    }
    if (data.metadata !== undefined) {
      createData.metadata = data.metadata;
    }

    return this.prisma.auditLog.create({
      data: createData,
    });
  }

  async findAll(
    organizationId: string,
    filters?: {
      userId?: string;
      resourceType?: string;
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { organizationId };

    if (filters) {
      if (filters.userId) where.userId = filters.userId;
      if (filters.resourceType) where.resourceType = filters.resourceType;
      if (filters.action) where.action = filters.action;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
