/**
 * Create Team DTO
 *
 * Data transfer object for creating a new team.
 * Used for request validation and type safety.
 */

import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
