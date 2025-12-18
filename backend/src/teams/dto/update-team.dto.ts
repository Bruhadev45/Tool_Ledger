/**
 * Update Team DTO
 *
 * Data transfer object for updating an existing team.
 * All fields are optional for partial updates.
 */

import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
