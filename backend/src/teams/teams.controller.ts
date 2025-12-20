import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.teamsService.findAll(user.organizationId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teamsService.findOne(id, user.organizationId, user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  create(@CurrentUser() user: any, @Body() body: { name: string; description?: string }) {
    return this.teamsService.create(user.organizationId, body.name, body.description, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.teamsService.update(
      id,
      user.organizationId,
      body.name,
      body.description,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teamsService.remove(id, user.organizationId, user.role);
  }

  @Post(':id/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  addUser(@Param('id') teamId: string, @Param('userId') userId: string, @CurrentUser() user: any) {
    return this.teamsService.addUser(teamId, userId, user.organizationId, user.role);
  }

  @Delete(':id/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  removeUser(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.removeUser(teamId, userId, user.organizationId, user.role);
  }
}
