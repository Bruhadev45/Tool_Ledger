import { IsString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  credentialId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

// Custom validator: at least one of credentialId or invoiceId must be provided
export function validateCommentDto(dto: CreateCommentDto): boolean {
  return !!(dto.credentialId || dto.invoiceId);
}
