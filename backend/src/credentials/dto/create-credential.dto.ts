import { IsString, IsOptional, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  name: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean; // Free or Paid tool

  @IsOptional()
  @IsBoolean()
  hasAutopay?: boolean; // Autopay enabled or not

  @IsOptional()
  @IsUUID()
  organizationId?: string; // Optional: allows selecting organization (for admins)
}
