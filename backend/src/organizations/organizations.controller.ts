import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get('me')
  getMyOrganization(@CurrentUser() user: any) {
    return this.organizationsService.findOne(user.organizationId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@CurrentUser() user: any) {
    // For now, return all organizations (admin only)
    // In production, you might want to add pagination and filtering
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createDto: CreateOrganizationDto) {
    return this.organizationsService.create(createDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateDto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.organizationsService.remove(id);
    return { message: 'Organization deleted successfully' };
  }

  @Post(':id/users/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addUser(@Param('id') orgId: string, @Param('userId') userId: string) {
    return this.organizationsService.addUser(orgId, userId);
  }

  @Delete(':id/users/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUser(@Param('id') orgId: string, @Param('userId') userId: string) {
    await this.organizationsService.removeUser(orgId, userId);
    return { message: 'User removed from organization successfully' };
  }

  @Post(':id/credentials/:credentialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addCredential(@Param('id') orgId: string, @Param('credentialId') credentialId: string) {
    return this.organizationsService.addCredential(orgId, credentialId);
  }

  @Delete(':id/credentials/:credentialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCredential(@Param('id') orgId: string, @Param('credentialId') credentialId: string) {
    await this.organizationsService.removeCredential(orgId, credentialId);
    return { message: 'Credential removed from organization successfully' };
  }
}
