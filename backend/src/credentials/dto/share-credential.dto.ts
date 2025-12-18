import { IsString, IsEnum, IsUUID, IsOptional, ValidateIf } from 'class-validator';
import { CredentialPermission } from '@prisma/client';

export class ShareCredentialDto {
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.teamId)
  userId?: string;

  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.userId)
  teamId?: string;

  @IsEnum(CredentialPermission)
  permission: CredentialPermission;
}
