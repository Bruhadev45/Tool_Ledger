/**
 * Update User Role DTO
 *
 * Data transfer object for updating a user's role.
 */

import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
