import { Controller, Get, Post, Param, Patch, Delete, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user.organizationId, user.role);
  }

  @Get('members')
  getMembers(@CurrentUser() user: any) {
    return this.usersService.findOrganizationMembers(user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.findOne(id, user.organizationId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  create(
    @CurrentUser() user: any,
    @Body() body: { email: string; password: string; firstName: string; lastName: string; role: UserRole; teamId?: string },
  ) {
    return this.usersService.create(user.organizationId, body, user.role);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateRole(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { role: UserRole },
  ) {
    return this.usersService.updateRole(id, user.organizationId, body.role, user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { isActive: boolean },
  ) {
    return this.usersService.updateStatus(id, user.organizationId, body.isActive, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    // Prevent users from deleting themselves
    if (id === user.id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    return this.usersService.remove(id, user.organizationId, user.role);
  }
}
