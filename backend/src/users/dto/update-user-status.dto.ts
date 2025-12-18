/**
 * Update User Status DTO
 *
 * Data transfer object for activating or deactivating a user account.
 */

import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
