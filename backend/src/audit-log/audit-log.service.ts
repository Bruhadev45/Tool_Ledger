import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    userId: string;
    organizationId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: string;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }

  async findAll(organizationId: string, filters?: {
    userId?: string;
    resourceType?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
  }) {
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
