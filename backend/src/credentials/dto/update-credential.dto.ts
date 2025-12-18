import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

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
}
