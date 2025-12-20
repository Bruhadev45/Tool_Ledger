import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, InvoiceStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getUserDashboard(userId: string, organizationId: string) {
    const [credentialCount, invoices, monthlySpend, vendorSpend] = await Promise.all([
      // Credential count
      this.prisma.credential.count({
        where: {
          organizationId,
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  userId,
                  revokedAt: null,
                },
              },
            },
          ],
        },
      }),

      // Recent invoices
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          uploadedById: userId,
          status: InvoiceStatus.APPROVED,
        },
        orderBy: { billingDate: 'desc' },
        take: 10,
      }),

      // Monthly spend (last 12 months)
      this.getMonthlySpend(organizationId, userId),

      // Vendor-wise spend
      this.getVendorSpend(organizationId, userId),
    ]);

    return {
      credentialCount,
      invoices,
      monthlySpend,
      vendorSpend,
    };
  }

  async getAdminDashboard(organizationId: string, isGlobalAdmin = true) {
    // For global admins, show data across ALL organizations
    // For org-specific admins, filter by organizationId
    const whereOrg = isGlobalAdmin ? {} : { organizationId };
    
    const [
      credentialCount,
      totalSpend,
      userSpend,
      teamSpend,
      vendorSpend,
      pendingInvoices,
      approvedInvoices,
      rejectedInvoices,
      monthlySpend,
      totalUsers,
      totalTeams,
      totalOrganizations,
    ] = await Promise.all([
      // Total credentials (all orgs for global admin)
      this.prisma.credential.count({
        where: whereOrg,
      }),

      // Total spend (all orgs for global admin)
      this.prisma.invoice.aggregate({
        where: {
          ...whereOrg,
          status: InvoiceStatus.APPROVED,
        },
        _sum: {
          amount: true,
        },
      }),

      // Spend by user (all orgs for global admin)
      this.prisma.invoice.groupBy({
        by: ['uploadedById'],
        where: {
          ...whereOrg,
          status: InvoiceStatus.APPROVED,
        },
        _sum: {
          amount: true,
        },
      }),

      // Spend by team (using tags/categories)
      this.prisma.invoice.groupBy({
        by: ['category'],
        where: {
          ...whereOrg,
          status: InvoiceStatus.APPROVED,
          category: { not: null },
        },
        _sum: {
          amount: true,
        },
      }),

      // Vendor-wise spend (all orgs for global admin)
      this.prisma.invoice.groupBy({
        by: ['provider'],
        where: {
          ...whereOrg,
          status: InvoiceStatus.APPROVED,
        },
        _sum: {
          amount: true,
        },
      }),

      // Pending invoices (all orgs for global admin)
      this.prisma.invoice.count({
        where: {
          ...whereOrg,
          status: InvoiceStatus.PENDING,
        },
      }),

      // Approved invoices (all orgs for global admin)
      this.prisma.invoice.count({
        where: {
          ...whereOrg,
          status: InvoiceStatus.APPROVED,
        },
      }),

      // Rejected invoices (all orgs for global admin)
      this.prisma.invoice.count({
        where: {
          ...whereOrg,
          status: InvoiceStatus.REJECTED,
        },
      }),

      // Monthly spend (all orgs for global admin)
      this.getMonthlySpend(isGlobalAdmin ? undefined : organizationId),
      
      // Total users (all orgs for global admin)
      this.prisma.user.count({
        where: whereOrg,
      }),
      
      // Total teams (all orgs for global admin)
      this.prisma.team.count({
        where: whereOrg,
      }),
      
      // Total organizations (only for global admin)
      isGlobalAdmin ? this.prisma.organization.count() : Promise.resolve(1),
    ]);

    return {
      credentialCount,
      totalSpend: totalSpend._sum.amount || 0,
      userSpend,
      teamSpend,
      vendorSpend,
      pendingInvoices,
      approvedInvoices,
      rejectedInvoices,
      monthlySpend,
      totalUsers,
      totalTeams,
      totalOrganizations,
      isGlobalAdmin,
    };
  }

  async getAccountantDashboard(organizationId: string) {
    const [adminSpend, departmentSpend, monthlyTrends, totalSpend, adminComparison] =
      await Promise.all([
        // Admin-wise monthly spends
        this.getAdminMonthlySpend(organizationId),

        // Department-wise categorization
        this.prisma.invoice.groupBy({
          by: ['category'],
          where: {
            organizationId,
            status: InvoiceStatus.APPROVED,
            category: { not: null },
          },
          _sum: {
            amount: true,
          },
          _count: {
            id: true,
          },
        }),

        // Month-over-month trends
        this.getMonthlyTrends(organizationId),

        // Total organization spend
        this.prisma.invoice.aggregate({
          where: {
            organizationId,
            status: InvoiceStatus.APPROVED,
          },
          _sum: {
            amount: true,
          },
        }),

        // Admin comparison data
        this.getAdminComparisonData(organizationId),
      ]);

    return {
      adminSpend,
      departmentSpend,
      monthlyTrends,
      totalSpend: totalSpend._sum.amount || 0,
      adminComparison,
    };
  }

  private async getMonthlySpend(organizationId?: string, userId?: string) {
    const where: any = {
      status: InvoiceStatus.APPROVED,
    };

    // Only filter by organizationId if provided (for non-global admins)
    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (userId) {
      where.uploadedById = userId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        amount: true,
        billingDate: true,
      },
    });

    // Group by month
    const monthlyData: Record<string, number> = {};
    invoices.forEach((invoice) => {
      const month = invoice.billingDate.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[month] = (monthlyData[month] || 0) + Number(invoice.amount);
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
  }

  private async getVendorSpend(organizationId: string, userId?: string) {
    const where: any = {
      organizationId,
      status: InvoiceStatus.APPROVED,
    };

    if (userId) {
      where.uploadedById = userId;
    }

    const result = await this.prisma.invoice.groupBy({
      by: ['provider'],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    return result.map((item) => ({
      vendor: item.provider,
      amount: Number(item._sum.amount || 0),
      count: item._count.id,
    }));
  }

  private async getAdminMonthlySpend(organizationId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: InvoiceStatus.APPROVED,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Group by admin and month
    const adminMonthly: Record<string, Record<string, number>> = {};
    invoices.forEach((invoice) => {
      if (invoice.uploadedBy.role === UserRole.ADMIN) {
        const adminId = invoice.uploadedBy.id;
        const month = invoice.billingDate.toISOString().substring(0, 7);
        if (!adminMonthly[adminId]) {
          adminMonthly[adminId] = {};
        }
        adminMonthly[adminId][month] = (adminMonthly[adminId][month] || 0) + Number(invoice.amount);
      }
    });

    return adminMonthly;
  }

  private async getMonthlyTrends(organizationId: string) {
    return this.getMonthlySpend(organizationId);
  }

  private async getAdminComparisonData(organizationId: string) {
    // Get all admins and their monthly spending for comparison
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const adminMonthlyData: any[] = [];

    for (const admin of admins) {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          organizationId,
          status: InvoiceStatus.APPROVED,
          uploadedById: admin.id,
        },
        select: {
          amount: true,
          billingDate: true,
        },
      });

      const monthlyData: Record<string, number> = {};
      invoices.forEach((invoice) => {
        const month = invoice.billingDate.toISOString().substring(0, 7);
        monthlyData[month] = (monthlyData[month] || 0) + Number(invoice.amount);
      });

      adminMonthlyData.push({
        adminId: admin.id,
        adminName: `${admin.firstName} ${admin.lastName}`,
        adminEmail: admin.email,
        monthlySpend: Object.entries(monthlyData)
          .map(([month, amount]) => ({ month, amount }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12),
        totalSpend: Object.values(monthlyData).reduce((sum, val) => sum + val, 0),
      });
    }

    return adminMonthlyData;
  }
}
