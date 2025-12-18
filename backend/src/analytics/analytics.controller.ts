import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any) {
    if (user.role === UserRole.ACCOUNTANT) {
      return this.analyticsService.getAccountantDashboard(user.organizationId);
    } else if (user.role === UserRole.ADMIN) {
      return this.analyticsService.getAdminDashboard(user.organizationId);
    } else {
      return this.analyticsService.getUserDashboard(user.id, user.organizationId);
    }
  }
}
