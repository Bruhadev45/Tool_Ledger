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
  ForbiddenException,
} from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateCredentialDto, UpdateCredentialDto, ShareCredentialDto } from './dto';
import { UserPayload } from '../shared/types/common.types';

@Controller('credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CredentialsController {
  constructor(private credentialsService: CredentialsService) {}

  /**
   * Block accountants from accessing credentials
   *
   * @param userRole - Role of the user attempting access
   * @throws ForbiddenException if user is an accountant
   */
  private checkAccountantAccess(userRole: UserRole): void {
    if (userRole === UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Accountants do not have access to credentials');
    }
  }

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() createDto: CreateCredentialDto) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.create(user.id, user.organizationId, user.role, createDto);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.findAll(user.id, user.organizationId, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Query('decrypt') decrypt?: string,
  ) {
    this.checkAccountantAccess(user.role);
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
    @CurrentUser() user: UserPayload,
    @Body() updateDto: UpdateCredentialDto,
  ) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.update(id, user.id, user.organizationId, user.role, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.remove(id, user.id, user.organizationId, user.role);
  }

  @Post(':id/share')
  share(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() shareDto: ShareCredentialDto,
  ) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.share(id, user.id, user.organizationId, user.role, shareDto);
  }

  @Post(':id/revoke/user/:userId')
  revokeUserAccess(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: UserPayload,
  ) {
    this.checkAccountantAccess(user.role);
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
    @CurrentUser() user: UserPayload,
  ) {
    this.checkAccountantAccess(user.role);
    return this.credentialsService.revokeTeamAccess(
      id,
      user.id,
      user.organizationId,
      user.role,
      teamId,
    );
  }
}
