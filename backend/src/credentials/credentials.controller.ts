import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateCredentialDto, UpdateCredentialDto, ShareCredentialDto } from './dto';

@Controller('credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CredentialsController {
  constructor(private credentialsService: CredentialsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() createDto: CreateCredentialDto) {
    return this.credentialsService.create(user.id, user.organizationId, user.role, createDto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.credentialsService.findAll(user.id, user.organizationId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any, @Query('decrypt') decrypt?: string) {
    return this.credentialsService.findOne(
      id,
      user.id,
      user.organizationId,
      user.role,
      decrypt === 'true',
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateDto: UpdateCredentialDto,
  ) {
    return this.credentialsService.update(id, user.id, user.organizationId, user.role, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.credentialsService.remove(id, user.id, user.organizationId, user.role);
  }

  @Post(':id/share')
  share(@Param('id') id: string, @CurrentUser() user: any, @Body() shareDto: ShareCredentialDto) {
    return this.credentialsService.share(id, user.id, user.organizationId, user.role, shareDto);
  }

  @Post(':id/revoke/user/:userId')
  revokeUserAccess(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.credentialsService.revokeAccess(
      id,
      user.id,
      user.organizationId,
      user.role,
      targetUserId,
    );
  }

  @Post(':id/revoke/team/:teamId')
  revokeTeamAccess(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: any,
  ) {
    return this.credentialsService.revokeTeamAccess(
      id,
      user.id,
      user.organizationId,
      user.role,
      teamId,
    );
  }
}
